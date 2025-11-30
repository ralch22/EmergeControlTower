"""
QA Gate Agent
Reviews content quality, brand voice compliance, and sends Slack approval requests
"""
import os
import httpx
from typing import List, Dict, Any
from ..models import (
    BrandVoice, 
    GeneratedContent, 
    QAResult,
    SlackApprovalPayload,
    ContentStatus,
)
from ..providers.claude import ClaudeProvider
from ..utils import safe_extract_json


class QAAgent:
    """
    Quality assurance agent that reviews all generated content
    for brand voice match, guideline compliance, and overall quality.
    Sends Slack notifications for human approval with one-click buttons.
    """
    
    SYSTEM_PROMPT = """You are a senior content editor and brand guardian.

Your job is to review content for:
1. Brand voice consistency (tone, vocabulary, style)
2. Factual accuracy and claim verification
3. Guideline compliance (forbidden words, required elements)
4. Engagement potential (hooks, CTAs, value delivery)
5. Platform-specific optimization

Score each piece 1-10 and provide specific, actionable feedback.
Be constructive but rigorous - only pass content that's truly client-ready."""

    REVIEW_PROMPT = """Review this content piece:

**Content Type:** {content_type}
**Title:** {title}
**Content:**
{content}

**Brand Voice Requirements:**
- Tone: {tone}
- Target Audience: {audience}
- Forbidden Words: {forbidden}
- Required Elements: {required}

Evaluate:
1. Brand voice match (1-10)
2. Guideline compliance (1-10)
3. Engagement potential (1-10)
4. Overall quality (1-10)

Return JSON:
{{
  "score": 8.5,
  "brand_voice_match": 9,
  "guidelines_compliance": 8,
  "engagement_potential": 8,
  "passed": true,
  "feedback": "Brief overall assessment",
  "issues": ["Issue 1 if any", "Issue 2 if any"],
  "suggestions": ["Improvement suggestion 1"]
}}"""

    def __init__(self):
        self.llm = ClaudeProvider()
        self.slack_webhook = os.environ.get("SLACK_WEBHOOK_URL")
        self.base_url = os.environ.get("APP_BASE_URL", "http://localhost:5000")
    
    async def review_content(
        self,
        content: GeneratedContent,
        brand_voice: BrandVoice,
    ) -> QAResult:
        """Review a single piece of content"""
        
        user = self.REVIEW_PROMPT.format(
            content_type=content.content_type.value,
            title=content.title,
            content=content.content[:3000],
            tone=brand_voice.tone,
            audience=brand_voice.target_audience,
            forbidden=", ".join(brand_voice.forbidden_words) or "None specified",
            required=", ".join(brand_voice.content_goals) or "None specified",
        )
        
        response = await self.llm.generate_json(self.SYSTEM_PROMPT, user)
        review_data = safe_extract_json(response, expect_array=False)
        
        overall_score = review_data.get("score", 0)
        passed = overall_score >= 7.0 and review_data.get("passed", False)
        
        return QAResult(
            content_id=content.id,
            score=overall_score,
            feedback=review_data.get("feedback", ""),
            issues=review_data.get("issues", []),
            passed=passed,
            brand_voice_match=review_data.get("brand_voice_match", 0),
            guidelines_compliance=review_data.get("guidelines_compliance", 0),
        )
    
    async def review_batch(
        self,
        contents: List[GeneratedContent],
        brand_voice: BrandVoice,
    ) -> Dict[str, QAResult]:
        """Review multiple content pieces"""
        import asyncio
        
        tasks = [self.review_content(content, brand_voice) for content in contents]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        qa_results = {}
        for i, result in enumerate(results):
            if isinstance(result, QAResult):
                qa_results[contents[i].id] = result
            else:
                print(f"QA review error for {contents[i].id}: {result}")
                qa_results[contents[i].id] = QAResult(
                    content_id=contents[i].id,
                    score=0,
                    feedback=f"Review failed: {str(result)}",
                    issues=["Automated review failed"],
                    passed=False,
                    brand_voice_match=0,
                    guidelines_compliance=0,
                )
        
        return qa_results
    
    async def send_slack_approval(
        self,
        content: GeneratedContent,
        qa_result: QAResult,
        client_name: str,
    ) -> bool:
        """Send Slack message with approve/reject buttons"""
        
        if not self.slack_webhook:
            print("SLACK_WEBHOOK_URL not set - skipping Slack notification")
            return False
        
        approve_url = f"{self.base_url}/api/content/{content.id}/approve"
        reject_url = f"{self.base_url}/api/content/{content.id}/reject"
        
        preview = content.content[:200] + "..." if len(content.content) > 200 else content.content
        
        message = {
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"🎯 New Content Ready for {client_name}",
                        "emoji": True
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Type:*\n{content.content_type.value}"},
                        {"type": "mrkdwn", "text": f"*QA Score:*\n{qa_result.score}/10"},
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*{content.title}*\n\n{preview}"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Feedback:* {qa_result.feedback}"
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "✅ Approve", "emoji": True},
                            "style": "primary",
                            "url": approve_url,
                            "action_id": f"approve_{content.id}"
                        },
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "❌ Reject", "emoji": True},
                            "style": "danger",
                            "url": reject_url,
                            "action_id": f"reject_{content.id}"
                        }
                    ]
                }
            ]
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.slack_webhook,
                    json=message,
                    timeout=10.0,
                )
                return response.status_code == 200
            except Exception as e:
                print(f"Slack webhook error: {e}")
                return False
    
    async def process_approval(
        self,
        content_id: str,
        approved: bool,
    ) -> ContentStatus:
        """Process approval/rejection from Slack"""
        return ContentStatus.APPROVED if approved else ContentStatus.REJECTED

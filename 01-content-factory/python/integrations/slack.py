"""
Slack Integration for QA approval notifications
"""
import os
import httpx
from typing import Optional


class SlackNotifier:
    """Slack webhook notifier for content approvals"""
    
    def __init__(self):
        self.webhook_url = os.environ.get("SLACK_WEBHOOK_URL")
        self.available = bool(self.webhook_url)
        
        if not self.available:
            print("SLACK_WEBHOOK_URL not set - Slack notifications disabled")
    
    async def send_message(self, text: str) -> bool:
        """Send a simple text message"""
        if not self.available:
            print(f"[Slack] Mock message: {text}")
            return True
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.webhook_url,
                    json={"text": text},
                    timeout=10.0,
                )
                return response.status_code == 200
            except Exception as e:
                print(f"Slack error: {e}")
                return False
    
    async def send_approval_request(
        self,
        content_id: str,
        client_name: str,
        content_type: str,
        title: str,
        preview: str,
        qa_score: float,
        approve_url: str,
        reject_url: str,
    ) -> bool:
        """Send approval request with action buttons"""
        if not self.available:
            print(f"[Slack] Mock approval request: {title} (score: {qa_score})")
            return True
        
        blocks = [
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
                    {"type": "mrkdwn", "text": f"*Type:*\n{content_type}"},
                    {"type": "mrkdwn", "text": f"*QA Score:*\n{qa_score}/10"},
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{title}*\n\n{preview[:500]}..."
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
                        "action_id": f"approve_{content_id}"
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "❌ Reject", "emoji": True},
                        "style": "danger",
                        "url": reject_url,
                        "action_id": f"reject_{content_id}"
                    }
                ]
            }
        ]
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.webhook_url,
                    json={"blocks": blocks},
                    timeout=10.0,
                )
                return response.status_code == 200
            except Exception as e:
                print(f"Slack error: {e}")
                return False
    
    async def send_run_summary(
        self,
        client_name: str,
        run_id: str,
        total_pieces: int,
        passed_pieces: int,
        failed_pieces: int,
    ) -> bool:
        """Send summary after a content run completes"""
        
        emoji = "🎉" if passed_pieces == total_pieces else "⚠️"
        
        message = f"""
{emoji} *Content Run Complete for {client_name}*

*Run ID:* `{run_id}`
*Total Pieces:* {total_pieces}
*Passed QA:* {passed_pieces} ✅
*Failed QA:* {failed_pieces} ❌

Review pending content in the dashboard.
"""
        
        return await self.send_message(message)

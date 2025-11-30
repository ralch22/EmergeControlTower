"""
Topic & Angle Agent
Generates high-impact content topics based on brand voice and performance data
"""
from typing import List
from ..models import BrandVoice, ContentTopic, ContentType
from ..providers.claude import ClaudeProvider
from ..utils import safe_extract_json


class TopicAgent:
    """
    World-class growth marketer agent that generates content topics
    using brand voice database and performance insights.
    """
    
    SYSTEM_PROMPT = """You are a world-class growth marketer for {industry}.
Using the brand voice database and last 90 days performance, generate content ideas that will 3x engagement.

You understand:
- Content marketing best practices and viral content patterns
- SEO keyword research principles and search intent
- Social media engagement patterns across platforms
- B2B and B2C marketing strategies
- Industry-specific content angles that drive conversions

Always return valid JSON arrays with no additional text."""

    USER_PROMPT = """Generate {count} high-impact content topics for the following client:

**Client:** {client_name}
**Industry:** {industry}
**Brand Voice:** {tone}
**Target Audience:** {target_audience}
**Keywords to incorporate:** {keywords}
**Content Goals:** {content_goals}
**Past Winners:** {past_winners}

For each topic, provide:
1. A compelling, clickable title
2. A unique angle or hook that differentiates from competitors
3. Relevant keywords (3-5) for SEO
4. Which content types it's suitable for: {content_types}
5. Priority level (high/medium/low) based on likely engagement

Return ONLY a valid JSON array with this structure:
[
  {{
    "id": "topic_1",
    "title": "...",
    "angle": "...",
    "keywords": ["...", "..."],
    "content_types": ["blog", "linkedin"],
    "priority": "high"
  }}
]"""

    def __init__(self):
        self.llm = ClaudeProvider()
    
    async def generate_topics(
        self,
        brand_voice: BrandVoice,
        count: int = 12,
        content_types: List[ContentType] = None,
    ) -> List[ContentTopic]:
        """Generate content topics for the week"""
        
        if content_types is None:
            content_types = [ContentType.BLOG, ContentType.LINKEDIN, ContentType.TWITTER]
        
        system = self.SYSTEM_PROMPT.format(industry=brand_voice.industry)
        
        user = self.USER_PROMPT.format(
            count=count,
            client_name=brand_voice.client_name,
            industry=brand_voice.industry,
            tone=brand_voice.tone,
            target_audience=brand_voice.target_audience,
            keywords=", ".join(brand_voice.keywords),
            content_goals=", ".join(brand_voice.content_goals),
            past_winners=", ".join(brand_voice.past_winners) if brand_voice.past_winners else "N/A",
            content_types=", ".join([ct.value for ct in content_types]),
        )
        
        response = await self.llm.generate_json(system, user)
        topics_data = safe_extract_json(response, expect_array=True)
        
        topics = []
        for i, topic in enumerate(topics_data):
            topics.append(ContentTopic(
                id=topic.get("id", f"topic_{i+1}"),
                title=topic["title"],
                angle=topic["angle"],
                keywords=topic["keywords"],
                content_types=[ContentType(ct) for ct in topic["content_types"]],
                priority=topic.get("priority", "medium"),
            ))
        
        return topics

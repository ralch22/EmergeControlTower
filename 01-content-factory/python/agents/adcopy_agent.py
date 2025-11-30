"""
Ad Copy Agent
Creates Google and Meta (Facebook/Instagram) ad copies using PAS framework
"""
from typing import List
from ..models import BrandVoice, ContentTopic, BlogPost, AdCopy
from ..providers.claude import ClaudeProvider
from ..utils import safe_extract_json


class AdCopyAgent:
    """
    Expert performance marketer that creates high-converting ad copies
    for Google Ads and Meta platforms using proven frameworks.
    """
    
    SYSTEM_PROMPT = """You are a world-class performance marketer who writes ads that convert.

You master:
- PAS Framework (Problem-Agitate-Solution)
- AIDA Framework (Attention-Interest-Desire-Action)
- Power words that trigger action
- Platform-specific character limits and best practices
- A/B testing copy variations

Google Ads limits: Headlines 30 chars, Descriptions 90 chars
Facebook/Instagram: Headlines 40 chars, Primary text 125 chars (before "See More")

Write ads that speak directly to pain points and desired outcomes."""

    GOOGLE_ADS_PROMPT = """Create 12 Google Ads for this content:

**Topic:** {title}
**Keywords:** {keywords}
**Brand Voice:** {brand_voice}
**Target Audience:** {target_audience}
**Landing Page Goal:** {goal}

For EACH ad, provide:
- 3 Headlines (max 30 chars each)
- 3 Descriptions (max 90 chars each)
- CTA

Return JSON array:
[
  {{
    "id": "google_1",
    "platform": "google",
    "headlines": ["Headline 1", "Headline 2", "Headline 3"],
    "descriptions": ["Description 1...", "Description 2...", "Description 3..."],
    "cta": "Learn More",
    "target_audience": "Who this ad targets"
  }}
]"""

    META_ADS_PROMPT = """Create 12 Facebook/Instagram ads for this content:

**Topic:** {title}
**Keywords:** {keywords}
**Brand Voice:** {brand_voice}
**Target Audience:** {target_audience}
**Campaign Goal:** {goal}

Use PAS framework. For EACH ad, provide:
- 3 Headlines (max 40 chars, hook the scroll)
- 3 Primary texts (compelling copy with CTA)
- CTA button text

Return JSON array:
[
  {{
    "id": "meta_1",
    "platform": "facebook",
    "headlines": ["Headline 1", "Headline 2", "Headline 3"],
    "descriptions": ["Primary text 1...", "Primary text 2...", "Primary text 3..."],
    "cta": "Sign Up",
    "target_audience": "Who this ad targets"
  }}
]"""

    def __init__(self):
        self.llm = ClaudeProvider()
    
    async def generate_google_ads(
        self,
        topic: ContentTopic,
        brand_voice: BrandVoice,
    ) -> List[AdCopy]:
        """Generate Google Ads copies"""
        
        user = self.GOOGLE_ADS_PROMPT.format(
            title=topic.title,
            keywords=", ".join(topic.keywords),
            brand_voice=brand_voice.tone,
            target_audience=brand_voice.target_audience,
            goal=brand_voice.content_goals[0] if brand_voice.content_goals else "Drive conversions",
        )
        
        response = await self.llm.generate_json(self.SYSTEM_PROMPT, user)
        ads_data = safe_extract_json(response, expect_array=True)
        
        ads = []
        for i, ad in enumerate(ads_data):
            ads.append(AdCopy(
                id=ad.get("id", f"google_{topic.id}_{i+1}"),
                topic_id=topic.id,
                platform="google",
                headlines=ad["headlines"],
                descriptions=ad["descriptions"],
                cta=ad.get("cta", "Learn More"),
                target_audience=ad.get("target_audience", brand_voice.target_audience),
            ))
        
        return ads
    
    async def generate_meta_ads(
        self,
        topic: ContentTopic,
        brand_voice: BrandVoice,
    ) -> List[AdCopy]:
        """Generate Meta (Facebook/Instagram) ads copies"""
        
        user = self.META_ADS_PROMPT.format(
            title=topic.title,
            keywords=", ".join(topic.keywords),
            brand_voice=brand_voice.tone,
            target_audience=brand_voice.target_audience,
            goal=brand_voice.content_goals[0] if brand_voice.content_goals else "Drive conversions",
        )
        
        response = await self.llm.generate_json(self.SYSTEM_PROMPT, user)
        ads_data = safe_extract_json(response, expect_array=True)
        
        ads = []
        for i, ad in enumerate(ads_data):
            ads.append(AdCopy(
                id=ad.get("id", f"meta_{topic.id}_{i+1}"),
                topic_id=topic.id,
                platform="facebook",
                headlines=ad["headlines"],
                descriptions=ad["descriptions"],
                cta=ad.get("cta", "Learn More"),
                target_audience=ad.get("target_audience", brand_voice.target_audience),
            ))
        
        return ads
    
    async def generate_all_ads(
        self,
        topic: ContentTopic,
        brand_voice: BrandVoice,
    ) -> List[AdCopy]:
        """Generate both Google and Meta ads"""
        import asyncio
        
        google_task = self.generate_google_ads(topic, brand_voice)
        meta_task = self.generate_meta_ads(topic, brand_voice)
        
        results = await asyncio.gather(google_task, meta_task, return_exceptions=True)
        
        all_ads = []
        for result in results:
            if isinstance(result, list):
                all_ads.extend(result)
            else:
                print(f"Ad generation error: {result}")
        
        return all_ads
    
    async def generate_from_blog(
        self,
        blog: BlogPost,
        brand_voice: BrandVoice,
    ) -> List[AdCopy]:
        """Generate ads from a blog post"""
        topic = ContentTopic(
            id=blog.topic_id,
            title=blog.title,
            angle=blog.meta_description,
            keywords=[],
            content_types=[],
        )
        return await self.generate_all_ads(topic, brand_voice)

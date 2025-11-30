"""
Long-Form Blog Agent
Creates SEO-optimized blog posts with Surfer-style structure
"""
from typing import Optional
from ..models import BrandVoice, ContentTopic, BlogPost
from ..providers.claude import ClaudeProvider
from ..utils import safe_extract_json


class BlogAgent:
    """
    Expert blog writer that creates Surfer-optimized long-form content
    with proper structure, headings, and CTAs.
    """
    
    SYSTEM_PROMPT = """You are an expert SEO content writer who creates engaging, high-converting blog posts.

Your posts always include:
- Catchy hooks that grab attention in the first 2 sentences
- Clear problem statements that resonate with the target audience
- Actionable frameworks and step-by-step guides
- Data, statistics, and quotes for credibility
- Strong CTAs that drive the desired action

You write in the brand voice provided and optimize for both readers and search engines.
Structure posts with proper H2 headings for skimmability."""

    USER_PROMPT = """Write a 1,500-word Surfer-optimized blog post on the following topic:

**Title:** {title}
**Angle:** {angle}
**Target Keywords:** {keywords}

**Brand Voice:** {brand_voice}
**Target Audience:** {target_audience}
**Content Goal:** {content_goal}

Structure Requirements:
1. Catchy hook (2-3 sentences that grab attention)
2. Problem statement (why this matters to the reader)
3. Main content with 8 H2 headings
4. Include stats, quotes, or examples for credibility
5. Strong CTA at the end

Return a JSON object with this structure:
{{
  "title": "Final optimized title",
  "content": "Full blog post content with ## for H2 headings",
  "meta_description": "155-character meta description",
  "headings": ["H2 1", "H2 2", ...],
  "word_count": 1500,
  "cta": "The call-to-action text"
}}"""

    def __init__(self):
        self.llm = ClaudeProvider()
    
    async def generate_blog_post(
        self,
        topic: ContentTopic,
        brand_voice: BrandVoice,
    ) -> BlogPost:
        """Generate a full blog post from a topic"""
        
        user = self.USER_PROMPT.format(
            title=topic.title,
            angle=topic.angle,
            keywords=", ".join(topic.keywords),
            brand_voice=brand_voice.tone,
            target_audience=brand_voice.target_audience,
            content_goal=brand_voice.content_goals[0] if brand_voice.content_goals else "Drive engagement",
        )
        
        response = await self.llm.generate_json(self.SYSTEM_PROMPT, user, max_tokens=6000)
        blog_data = safe_extract_json(response, expect_array=False)
        
        return BlogPost(
            id=f"blog_{topic.id}",
            topic_id=topic.id,
            title=blog_data["title"],
            content=blog_data["content"],
            meta_description=blog_data["meta_description"],
            headings=blog_data["headings"],
            word_count=blog_data.get("word_count", len(blog_data["content"].split())),
            cta=blog_data["cta"],
        )
    
    async def generate_blog_posts(
        self,
        topics: list[ContentTopic],
        brand_voice: BrandVoice,
    ) -> list[BlogPost]:
        """Generate multiple blog posts in parallel"""
        import asyncio
        
        blog_topics = [t for t in topics if "blog" in [ct.value for ct in t.content_types]]
        
        tasks = [self.generate_blog_post(topic, brand_voice) for topic in blog_topics]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        posts = []
        for result in results:
            if isinstance(result, BlogPost):
                posts.append(result)
            else:
                print(f"Blog generation error: {result}")
        
        return posts

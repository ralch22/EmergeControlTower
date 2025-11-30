"""
Social Media Agent
Creates LinkedIn carousels, X/Twitter threads, and Instagram posts with image prompts
"""
from typing import List
from ..models import BrandVoice, ContentTopic, BlogPost, SocialPost, ContentType
from ..providers.claude import ClaudeProvider
from ..utils import safe_extract_json


class SocialAgent:
    """
    Expert social media content creator that generates platform-native content
    including LinkedIn carousels, X threads, and Instagram posts with Midjourney prompts.
    """
    
    SYSTEM_PROMPT = """You are a viral social media content expert who creates platform-native posts that drive massive engagement.

You understand:
- LinkedIn: Professional tone, thought leadership, carousel best practices
- Twitter/X: Thread hooks, punchy sentences, engagement tactics
- Instagram: Visual storytelling, caption hooks, hashtag strategy

Each post must feel native to its platform, not cross-posted.
Include Midjourney image prompts that will create scroll-stopping visuals."""

    LINKEDIN_PROMPT = """Create 8 LinkedIn carousel posts from this blog content:

**Blog Title:** {title}
**Blog Content:** {content}
**Brand Voice:** {brand_voice}
**Target Audience:** {target_audience}

For EACH post, provide:
1. Hook (first line that stops the scroll)
2. Carousel slides (5-8 slides with key points)
3. Full caption with CTA
4. Midjourney prompt for the cover slide

Return JSON array:
[
  {{
    "id": "linkedin_1",
    "hook": "First attention-grabbing line",
    "carousel_slides": ["Slide 1 text", "Slide 2 text", ...],
    "content": "Full caption with hashtags",
    "hashtags": ["#tag1", "#tag2"],
    "media_prompt": "Midjourney prompt for carousel cover: professional, modern..."
  }}
]"""

    TWITTER_PROMPT = """Create 4 X/Twitter threads from this blog content:

**Blog Title:** {title}
**Blog Content:** {content}
**Brand Voice:** {brand_voice}

For EACH thread, provide:
1. Hook tweet (must be provocative/valuable enough to make people click)
2. Thread content (8-12 tweets)
3. CTA tweet at the end

Return JSON array:
[
  {{
    "id": "twitter_1",
    "hook": "Opening hook tweet",
    "content": "Full thread with each tweet separated by \\n\\n",
    "hashtags": ["#tag1"]
  }}
]"""

    INSTAGRAM_PROMPT = """Create 4 Instagram posts from this blog content:

**Blog Title:** {title}
**Blog Content:** {content}
**Brand Voice:** {brand_voice}
**Target Audience:** {target_audience}

For EACH post, provide:
1. Caption with hook, value, and CTA
2. Hashtags (20-30 relevant hashtags)
3. Midjourney prompt for the visual

Return JSON array:
[
  {{
    "id": "instagram_1",
    "content": "Full caption with line breaks",
    "hashtags": ["#tag1", "#tag2", ...],
    "media_prompt": "Midjourney prompt: aesthetic, Instagram-worthy..."
  }}
]"""

    def __init__(self):
        self.llm = ClaudeProvider()
    
    async def generate_from_blog(
        self,
        blog: BlogPost,
        brand_voice: BrandVoice,
        platforms: List[ContentType] = None,
    ) -> List[SocialPost]:
        """Generate social posts from a blog post"""
        
        if platforms is None:
            platforms = [ContentType.LINKEDIN, ContentType.TWITTER, ContentType.INSTAGRAM]
        
        all_posts = []
        
        if ContentType.LINKEDIN in platforms:
            linkedin_posts = await self._generate_linkedin(blog, brand_voice)
            all_posts.extend(linkedin_posts)
        
        if ContentType.TWITTER in platforms:
            twitter_posts = await self._generate_twitter(blog, brand_voice)
            all_posts.extend(twitter_posts)
        
        if ContentType.INSTAGRAM in platforms:
            instagram_posts = await self._generate_instagram(blog, brand_voice)
            all_posts.extend(instagram_posts)
        
        return all_posts
    
    async def _generate_linkedin(
        self,
        blog: BlogPost,
        brand_voice: BrandVoice,
    ) -> List[SocialPost]:
        """Generate LinkedIn carousel posts"""
        
        user = self.LINKEDIN_PROMPT.format(
            title=blog.title,
            content=blog.content[:3000],
            brand_voice=brand_voice.tone,
            target_audience=brand_voice.target_audience,
        )
        
        response = await self.llm.generate_json(self.SYSTEM_PROMPT, user)
        posts_data = safe_extract_json(response, expect_array=True)
        
        posts = []
        for i, post in enumerate(posts_data):
            posts.append(SocialPost(
                id=post.get("id", f"linkedin_{blog.topic_id}_{i+1}"),
                topic_id=blog.topic_id,
                platform="linkedin",
                content=post["content"],
                hashtags=post.get("hashtags", []),
                media_prompt=post.get("media_prompt"),
                carousel_slides=post.get("carousel_slides"),
            ))
        
        return posts
    
    async def _generate_twitter(
        self,
        blog: BlogPost,
        brand_voice: BrandVoice,
    ) -> List[SocialPost]:
        """Generate Twitter/X threads"""
        
        user = self.TWITTER_PROMPT.format(
            title=blog.title,
            content=blog.content[:3000],
            brand_voice=brand_voice.tone,
        )
        
        response = await self.llm.generate_json(self.SYSTEM_PROMPT, user)
        posts_data = safe_extract_json(response, expect_array=True)
        
        posts = []
        for i, post in enumerate(posts_data):
            posts.append(SocialPost(
                id=post.get("id", f"twitter_{blog.topic_id}_{i+1}"),
                topic_id=blog.topic_id,
                platform="twitter",
                content=post["content"],
                hashtags=post.get("hashtags", []),
            ))
        
        return posts
    
    async def _generate_instagram(
        self,
        blog: BlogPost,
        brand_voice: BrandVoice,
    ) -> List[SocialPost]:
        """Generate Instagram posts"""
        
        user = self.INSTAGRAM_PROMPT.format(
            title=blog.title,
            content=blog.content[:3000],
            brand_voice=brand_voice.tone,
            target_audience=brand_voice.target_audience,
        )
        
        response = await self.llm.generate_json(self.SYSTEM_PROMPT, user)
        posts_data = safe_extract_json(response, expect_array=True)
        
        posts = []
        for i, post in enumerate(posts_data):
            posts.append(SocialPost(
                id=post.get("id", f"instagram_{blog.topic_id}_{i+1}"),
                topic_id=blog.topic_id,
                platform="instagram",
                content=post["content"],
                hashtags=post.get("hashtags", []),
                media_prompt=post.get("media_prompt"),
            ))
        
        return posts
    
    async def generate_from_topic(
        self,
        topic: ContentTopic,
        brand_voice: BrandVoice,
    ) -> List[SocialPost]:
        """Generate social posts directly from a topic (without blog)"""
        
        prompt = f"""Create social media posts for this topic:

**Topic:** {topic.title}
**Angle:** {topic.angle}
**Keywords:** {", ".join(topic.keywords)}
**Brand Voice:** {brand_voice.tone}
**Target Audience:** {brand_voice.target_audience}

Create:
- 2 LinkedIn posts with carousel slides
- 2 Twitter/X threads
- 2 Instagram posts

Return JSON array with platform, content, hashtags, media_prompt, carousel_slides fields."""

        response = await self.llm.generate_json(self.SYSTEM_PROMPT, prompt)
        posts_data = json.loads(self._extract_json(response))
        
        posts = []
        for i, post in enumerate(posts_data):
            posts.append(SocialPost(
                id=f"social_{topic.id}_{i+1}",
                topic_id=topic.id,
                platform=post.get("platform", "linkedin"),
                content=post["content"],
                hashtags=post.get("hashtags", []),
                media_prompt=post.get("media_prompt"),
                carousel_slides=post.get("carousel_slides"),
            ))
        
        return posts

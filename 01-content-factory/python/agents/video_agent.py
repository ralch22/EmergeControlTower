"""
Video Agent
Creates video scripts, generates voiceovers with ElevenLabs, and produces videos with Runway/Pika
"""
from typing import Optional
from ..models import BrandVoice, ContentTopic, BlogPost, VideoScript
from ..providers.claude import ClaudeProvider
from ..providers.elevenlabs import ElevenLabsProvider
from ..providers.runway import RunwayProvider
from ..utils import safe_extract_json


class VideoAgent:
    """
    Expert video content creator that produces complete short-form videos
    including script, voiceover, and AI-generated video.
    """
    
    SYSTEM_PROMPT = """You are a viral video content creator who writes scripts that hook viewers in the first 3 seconds.

Your videos:
- Hook within first 3 seconds (pattern interrupt)
- Deliver value in 60 seconds or less
- End with clear CTA
- Work for TikTok, YouTube Shorts, and Instagram Reels

Write conversational, punchy scripts that feel authentic, not corporate."""

    SCRIPT_PROMPT = """Turn this blog content into a 60-second vertical video script:

**Blog Title:** {title}
**Blog Content Summary:** {content}
**Brand Voice:** {brand_voice}
**Target Audience:** {target_audience}

Create a script with:
1. HOOK (0-3 seconds): Pattern interrupt that stops the scroll
2. PROBLEM (3-15 seconds): Identify the pain point
3. SOLUTION (15-45 seconds): Deliver the key insight/framework
4. CTA (45-60 seconds): What should they do next?

Also provide:
- Runway/Pika video generation prompt for visuals
- Key visual moments to emphasize

Return JSON:
{{
  "hook": "Opening hook line",
  "script": "Full 60-second script with [VISUAL: notes]",
  "duration_seconds": 60,
  "cta": "Call to action text",
  "video_prompt": "Runway/Pika prompt for video generation: cinematic, professional...",
  "visual_notes": ["Key moment 1", "Key moment 2"]
}}"""

    def __init__(self):
        self.llm = ClaudeProvider()
        self.voice = ElevenLabsProvider()
        self.video = RunwayProvider()
    
    async def generate_script(
        self,
        topic: ContentTopic,
        brand_voice: BrandVoice,
        blog_content: Optional[str] = None,
    ) -> VideoScript:
        """Generate a video script from topic or blog content"""
        
        content = blog_content or f"{topic.title}\n\n{topic.angle}"
        
        user = self.SCRIPT_PROMPT.format(
            title=topic.title,
            content=content[:2000],
            brand_voice=brand_voice.tone,
            target_audience=brand_voice.target_audience,
        )
        
        response = await self.llm.generate_json(self.SYSTEM_PROMPT, user)
        script_data = safe_extract_json(response, expect_array=False)
        
        return VideoScript(
            id=f"video_{topic.id}",
            topic_id=topic.id,
            hook=script_data["hook"],
            script=script_data["script"],
            duration_seconds=script_data.get("duration_seconds", 60),
            cta=script_data["cta"],
        )
    
    async def generate_voiceover(
        self,
        script: VideoScript,
    ) -> VideoScript:
        """Add voiceover audio to the script"""
        
        audio_bytes = await self.voice.generate_voiceover(script.script)
        
        if audio_bytes:
            script.voiceover_url = f"data:audio/mp3;base64,{audio_bytes[:100]}..."
        
        return script
    
    async def generate_video(
        self,
        script: VideoScript,
        video_prompt: Optional[str] = None,
    ) -> VideoScript:
        """Generate the full video"""
        
        prompt = video_prompt or f"Professional video about: {script.hook}. Cinematic, modern, engaging."
        
        video_url = await self.video.generate_video(
            prompt,
            duration_seconds=min(script.duration_seconds, 8),
        )
        
        if video_url:
            script.video_url = video_url
        
        return script
    
    async def generate_complete_video(
        self,
        topic: ContentTopic,
        brand_voice: BrandVoice,
        blog_content: Optional[str] = None,
    ) -> VideoScript:
        """Generate complete video: script → voiceover → video"""
        
        script = await self.generate_script(topic, brand_voice, blog_content)
        script = await self.generate_voiceover(script)
        script = await self.generate_video(script)
        
        return script
    
    async def generate_from_blog(
        self,
        blog: BlogPost,
        brand_voice: BrandVoice,
    ) -> VideoScript:
        """Generate video from a blog post"""
        topic = ContentTopic(
            id=blog.topic_id,
            title=blog.title,
            angle=blog.meta_description,
            keywords=[],
            content_types=[],
        )
        return await self.generate_complete_video(topic, brand_voice, blog.content)

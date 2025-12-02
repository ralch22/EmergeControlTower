"""
Video Agent
Creates video scripts, generates voiceovers with ElevenLabs, and produces videos with Runway/Pika
"""
import asyncio
from datetime import datetime
from typing import Optional, Callable, Awaitable, Union
from ..models import (
    BrandVoice, 
    ContentTopic, 
    BlogPost, 
    VideoScript,
    IngredientBundle,
    IngredientGenerationResult,
    SceneResult,
    SceneStatus,
)
from ..providers.claude import ClaudeProvider
from ..providers.elevenlabs import ElevenLabsProvider
from ..providers.runway import RunwayProvider
from ..utils import safe_extract_json
from ..brand_validator import build_brand_prompt_context, validate_brand_voice


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

{brand_visual_context}

Create a script with:
1. HOOK (0-3 seconds): Pattern interrupt that stops the scroll
2. PROBLEM (3-15 seconds): Identify the pain point
3. SOLUTION (15-45 seconds): Deliver the key insight/framework
4. CTA (45-60 seconds): What should they do next?

Also provide:
- Runway/Pika video generation prompt for visuals that MUST incorporate the brand visual style, color palette, and cinematic guidelines above
- Key visual moments to emphasize

Return JSON:
{{
  "hook": "Opening hook line",
  "script": "Full 60-second script with [VISUAL: notes]",
  "duration_seconds": 60,
  "cta": "Call to action text",
  "video_prompt": "Runway/Pika prompt for video generation incorporating brand visual style: cinematic, professional...",
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
        brand_profile: Optional[dict] = None,
    ) -> VideoScript:
        """Generate a video script from topic or blog content"""
        
        content = blog_content or f"{topic.title}\n\n{topic.angle}"
        
        brand_visual_context = self._build_brand_visual_context(brand_voice, brand_profile)
        
        user = self.SCRIPT_PROMPT.format(
            title=topic.title,
            content=content[:2000],
            brand_voice=brand_voice.tone,
            target_audience=brand_voice.target_audience,
            brand_visual_context=brand_visual_context,
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
    
    def _build_brand_visual_context(self, brand_voice: BrandVoice, brand_profile: Optional[dict] = None) -> str:
        """Build the visual context section for prompts from brand voice data and optional brand profile"""
        parts = []
        
        # If full brand profile is available, use it for comprehensive context
        if brand_profile and brand_profile.get('visual'):
            v = brand_profile['visual']
            
            # Visual Style
            if v.get('visualStyle'):
                vs = v['visualStyle']
                if vs.get('description'):
                    parts.append(f"Visual Style: {vs['description']}")
                if vs.get('aesthetic'):
                    parts.append(f"Aesthetic: {', '.join(vs['aesthetic'])}")
                if vs.get('moodKeywords'):
                    parts.append(f"Mood: {', '.join(vs['moodKeywords'])}")
                if vs.get('patterns'):
                    parts.append(f"Patterns: {', '.join(vs['patterns'])}")
                if vs.get('motifs'):
                    parts.append(f"Brand Motifs: {', '.join(vs['motifs'])}")
            
            # Color Palette
            if v.get('colorPalette'):
                cp = v['colorPalette']
                if cp.get('darkMode') and cp['darkMode'].get('accent'):
                    accent = cp['darkMode']['accent']
                    parts.append(f"Primary Color: {accent.get('name', 'Accent')} ({accent.get('hex', '')}) - {accent.get('usage', '')}")
                if cp.get('darkMode') and cp['darkMode'].get('background'):
                    bg = cp['darkMode']['background']
                    parts.append(f"Background: {bg.get('name', 'Background')} ({bg.get('hex', '')})")
                if cp.get('additionalColors'):
                    additional = ', '.join([f"{c.get('name', 'Color')} {c.get('hex', '')}" for c in cp['additionalColors']])
                    parts.append(f"Additional Colors: {additional}")
            
            # Typography
            if v.get('typography') and v['typography'].get('fonts'):
                fonts = ', '.join([f.get('family', '') for f in v['typography']['fonts']])
                if fonts:
                    parts.append(f"Fonts: {fonts}")
            
            # Cinematic Guidelines
            if v.get('cinematicGuidelines'):
                cine = v['cinematicGuidelines']
                parts.append(f"Aspect Ratio: {cine.get('aspectRatio', '16:9')}")
                parts.append(f"Resolution: {cine.get('resolution', '1080p')}")
                parts.append(f"Pacing: {cine.get('pacing', 'moderate')}")
                parts.append(f"Motion Style: {cine.get('motionStyle', 'smooth')}")
                if cine.get('transitionStyle'):
                    parts.append(f"Transitions: {cine['transitionStyle']}")
                if cine.get('colorGrading'):
                    parts.append(f"Color Grading: {cine['colorGrading']}")
                if cine.get('soundtrackStyle'):
                    parts.append(f"Soundtrack: {cine['soundtrackStyle']}")
            
            # Reference Assets
            if brand_profile.get('referenceAssets'):
                ra = brand_profile['referenceAssets']
                asset_refs = []
                if ra.get('logos'):
                    for logo in ra['logos']:
                        if logo.get('url'):
                            asset_refs.append(f"Logo: {logo['url']}")
                if ra.get('moodBoards'):
                    for mb in ra['moodBoards']:
                        if mb.get('url'):
                            asset_refs.append(f"Mood Board: {mb['url']}")
                if asset_refs:
                    parts.append(f"Reference Assets: {'; '.join(asset_refs)} - incorporate brand elements from these references")
        
        # Fallback to BrandVoice fields if brand profile not available
        if not parts:
            brand_dict = brand_voice.model_dump() if hasattr(brand_voice, 'model_dump') else {
                'visual_style': getattr(brand_voice, 'visual_style', None),
                'color_palette': getattr(brand_voice, 'color_palette', None),
                'fonts': getattr(brand_voice, 'fonts', None),
                'cinematic_guidelines': getattr(brand_voice, 'cinematic_guidelines', None),
                'reference_assets': getattr(brand_voice, 'reference_assets', None),
            }
            context = build_brand_prompt_context(brand_dict)
            if context:
                parts = context.split('\n')
        
        if parts:
            return f"""**Brand Visual Guidelines:**
{chr(10).join(parts)}"""
        
        return "**Brand Visual Guidelines:** Use professional, modern, clean visuals with high contrast."
    
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
    
    async def generate_from_ingredients(
        self,
        ingredient_bundle: IngredientBundle,
        on_scene_update: Optional[Callable[[SceneResult], Union[None, Awaitable[None]]]] = None,
        on_voiceover_update: Optional[Callable[[str, Optional[str]], Union[None, Awaitable[None]]]] = None,
    ) -> IngredientGenerationResult:
        """
        Generate video content from an ingredient bundle.
        
        This method handles:
        - Generating video clips for each scene in parallel
        - Generating voiceover audio for the script
        - Robust error handling - if one part fails, others continue
        - Status tracking for each scene
        
        Args:
            ingredient_bundle: The ingredient bundle with scenes, voiceover script, etc.
            on_scene_update: Optional callback when a scene status changes
            on_voiceover_update: Optional callback when voiceover status changes
            
        Returns:
            IngredientGenerationResult with all generated asset URLs and status
        """
        result = IngredientGenerationResult(
            bundle_id=ingredient_bundle.id,
            status="generating",
            total_scenes=len(ingredient_bundle.scenes),
            started_at=datetime.now(),
        )
        
        for scene in ingredient_bundle.scenes:
            result.scene_results.append(SceneResult(
                scene_id=scene.id,
                status=SceneStatus.PENDING,
            ))
        
        async def generate_scene_video(scene_index: int) -> None:
            """Generate video for a single scene"""
            scene = ingredient_bundle.scenes[scene_index]
            scene_result = result.scene_results[scene_index]
            
            scene_result.status = SceneStatus.GENERATING
            if on_scene_update:
                callback_result = on_scene_update(scene_result)
                if asyncio.iscoroutine(callback_result):
                    await callback_result
            
            try:
                if scene.imageUrl:
                    video_url = await self.video.generate_from_image(
                        image_url=scene.imageUrl,
                        motion_prompt=scene.prompt,
                    )
                else:
                    video_url = await self.video.generate_video(
                        prompt=scene.prompt,
                        duration_seconds=scene.duration,
                        aspect_ratio=ingredient_bundle.aspectRatio,
                    )
                
                if video_url:
                    scene_result.status = SceneStatus.COMPLETED
                    scene_result.video_url = video_url
                    result.completed_scenes += 1
                else:
                    scene_result.status = SceneStatus.FAILED
                    scene_result.error = "Video generation returned no URL"
                    result.failed_scenes += 1
                    
            except Exception as e:
                scene_result.status = SceneStatus.FAILED
                scene_result.error = str(e)
                result.failed_scenes += 1
                print(f"[VideoAgent] Scene {scene.id} generation failed: {e}")
            
            if on_scene_update:
                callback_result = on_scene_update(scene_result)
                if asyncio.iscoroutine(callback_result):
                    await callback_result
        
        async def generate_voiceover() -> None:
            """Generate voiceover audio from the script"""
            if not ingredient_bundle.voiceoverScript:
                return
            
            if on_voiceover_update:
                callback_result = on_voiceover_update("generating", None)
                if asyncio.iscoroutine(callback_result):
                    await callback_result
            
            try:
                voice_id = self._get_voice_id_for_style(ingredient_bundle.voiceStyle)
                
                audio_bytes = await self.voice.generate_voiceover(
                    text=ingredient_bundle.voiceoverScript,
                    voice_id=voice_id,
                )
                
                if audio_bytes:
                    import base64
                    audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
                    result.voiceover_url = f"data:audio/mp3;base64,{audio_base64}"
                else:
                    result.voiceover_error = "Voiceover generation returned no audio"
                    
            except Exception as e:
                result.voiceover_error = str(e)
                print(f"[VideoAgent] Voiceover generation failed: {e}")
            
            if on_voiceover_update:
                status = "completed" if result.voiceover_url else "failed"
                callback_result = on_voiceover_update(status, result.voiceover_error)
                if asyncio.iscoroutine(callback_result):
                    await callback_result
        
        tasks = []
        
        for i in range(len(ingredient_bundle.scenes)):
            tasks.append(generate_scene_video(i))
        
        if ingredient_bundle.voiceoverScript:
            tasks.append(generate_voiceover())
        
        await asyncio.gather(*tasks, return_exceptions=True)
        
        result.completed_at = datetime.now()
        
        if result.failed_scenes == 0 and result.voiceover_error is None:
            result.status = "completed"
        elif result.completed_scenes > 0 or result.voiceover_url:
            result.status = "partial"
        else:
            result.status = "failed"
        
        return result
    
    def _get_voice_id_for_style(self, voice_style: str) -> Optional[str]:
        """Map voice style to ElevenLabs voice ID"""
        voice_map = {
            "default": None,
            "professional": "21m00Tcm4TlvDq8ikWAM",
            "friendly": "EXAVITQu4vr4xnSDxMaL",
            "energetic": "ErXwobaYiN019PkySvjV",
            "calm": "MF3mGyEYCl7XYWbV9V6O",
            "narrative": "VR6AewLTigWG4xSOukaG",
        }
        return voice_map.get(voice_style.lower())

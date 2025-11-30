"""
Runway Gen-3 / Pika Video AI Provider
"""
import os
import httpx
from typing import Optional


class RunwayProvider:
    """Runway/Pika provider for AI video generation"""
    
    RUNWAY_BASE_URL = "https://api.runwayml.com/v1"
    PIKA_BASE_URL = "https://api.pika.art/v1"
    
    def __init__(self):
        self.runway_key = os.environ.get("RUNWAY_API_KEY")
        self.pika_key = os.environ.get("PIKA_API_KEY")
        self.available = bool(self.runway_key or self.pika_key)
        self.provider = "runway" if self.runway_key else "pika" if self.pika_key else None
        
        if not self.available:
            print("RUNWAY_API_KEY/PIKA_API_KEY not set - Video provider disabled")
    
    async def generate_video(
        self,
        prompt: str,
        duration_seconds: int = 4,
        aspect_ratio: str = "16:9",
    ) -> Optional[str]:
        """Generate video from text prompt, returns video URL"""
        if not self.available:
            print("Video provider not available - returning mock URL")
            return f"https://mock-video.example.com/{prompt[:20].replace(' ', '-')}.mp4"
        
        if self.provider == "runway":
            return await self._generate_runway(prompt, duration_seconds, aspect_ratio)
        else:
            return await self._generate_pika(prompt, duration_seconds)
    
    async def _generate_runway(
        self,
        prompt: str,
        duration: int,
        aspect_ratio: str,
    ) -> Optional[str]:
        """Generate video using Runway Gen-3"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.RUNWAY_BASE_URL}/generations",
                    headers={
                        "Authorization": f"Bearer {self.runway_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "prompt": prompt,
                        "duration": duration,
                        "aspect_ratio": aspect_ratio,
                        "model": "gen3a_turbo",
                    },
                    timeout=120.0,
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get("output_url")
                else:
                    print(f"Runway error: {response.status_code}")
                    return None
                    
            except Exception as e:
                print(f"Runway API error: {e}")
                return None
    
    async def _generate_pika(
        self,
        prompt: str,
        duration: int,
    ) -> Optional[str]:
        """Generate video using Pika"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.PIKA_BASE_URL}/generate",
                    headers={
                        "Authorization": f"Bearer {self.pika_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "prompt": prompt,
                        "style": "cinematic",
                    },
                    timeout=120.0,
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get("video_url")
                else:
                    print(f"Pika error: {response.status_code}")
                    return None
                    
            except Exception as e:
                print(f"Pika API error: {e}")
                return None
    
    async def generate_from_image(
        self,
        image_url: str,
        motion_prompt: str,
    ) -> Optional[str]:
        """Generate video from image with motion"""
        if not self.available:
            return f"https://mock-video.example.com/image-to-video.mp4"
        
        return await self.generate_video(f"{motion_prompt} [Image: {image_url}]")

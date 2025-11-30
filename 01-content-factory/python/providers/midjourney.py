"""
Midjourney / Flux Image AI Provider
"""
import os
import httpx
from typing import Optional


class MidjourneyProvider:
    """Midjourney/Flux provider for AI image generation"""
    
    def __init__(self):
        self.midjourney_key = os.environ.get("MIDJOURNEY_API_KEY")
        self.flux_key = os.environ.get("FLUX_API_KEY")
        self.replicate_key = os.environ.get("REPLICATE_API_KEY")
        
        self.available = bool(self.midjourney_key or self.flux_key or self.replicate_key)
        
        if self.midjourney_key:
            self.provider = "midjourney"
        elif self.flux_key:
            self.provider = "flux"
        elif self.replicate_key:
            self.provider = "replicate"
        else:
            self.provider = None
            print("No image API key set - Image provider disabled")
    
    async def generate_image(
        self,
        prompt: str,
        aspect_ratio: str = "1:1",
        style: str = "professional",
    ) -> Optional[str]:
        """Generate image from prompt, returns image URL"""
        if not self.available:
            print("Image provider not available - returning placeholder")
            return f"https://via.placeholder.com/1024x1024.png?text={prompt[:20].replace(' ', '+')}"
        
        if self.provider == "replicate":
            return await self._generate_replicate_flux(prompt, aspect_ratio)
        elif self.provider == "flux":
            return await self._generate_flux(prompt, aspect_ratio)
        else:
            return await self._generate_midjourney(prompt, aspect_ratio, style)
    
    async def _generate_replicate_flux(
        self,
        prompt: str,
        aspect_ratio: str,
    ) -> Optional[str]:
        """Generate image using Replicate Flux"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://api.replicate.com/v1/predictions",
                    headers={
                        "Authorization": f"Token {self.replicate_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "version": "black-forest-labs/flux-schnell",
                        "input": {
                            "prompt": prompt,
                            "aspect_ratio": aspect_ratio,
                            "num_outputs": 1,
                        },
                    },
                    timeout=60.0,
                )
                
                if response.status_code == 201:
                    prediction = response.json()
                    prediction_id = prediction["id"]
                    
                    for _ in range(30):
                        import asyncio
                        await asyncio.sleep(2)
                        
                        status_response = await client.get(
                            f"https://api.replicate.com/v1/predictions/{prediction_id}",
                            headers={"Authorization": f"Token {self.replicate_key}"},
                        )
                        
                        if status_response.status_code == 200:
                            result = status_response.json()
                            if result["status"] == "succeeded":
                                return result["output"][0]
                            elif result["status"] == "failed":
                                return None
                
                return None
                
            except Exception as e:
                print(f"Replicate API error: {e}")
                return None
    
    async def _generate_flux(
        self,
        prompt: str,
        aspect_ratio: str,
    ) -> Optional[str]:
        """Generate image using Flux API directly"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://api.bfl.ml/v1/flux-pro-1.1",
                    headers={
                        "X-Key": self.flux_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "prompt": prompt,
                        "width": 1024,
                        "height": 1024,
                    },
                    timeout=60.0,
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get("sample")
                return None
                
            except Exception as e:
                print(f"Flux API error: {e}")
                return None
    
    async def _generate_midjourney(
        self,
        prompt: str,
        aspect_ratio: str,
        style: str,
    ) -> Optional[str]:
        """Generate image using Midjourney API proxy"""
        enhanced_prompt = f"{prompt} --ar {aspect_ratio} --style {style}"
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://api.mymidjourney.ai/api/v1/midjourney/imagine",
                    headers={
                        "Authorization": f"Bearer {self.midjourney_key}",
                        "Content-Type": "application/json",
                    },
                    json={"prompt": enhanced_prompt},
                    timeout=120.0,
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get("imageUrl")
                return None
                
            except Exception as e:
                print(f"Midjourney API error: {e}")
                return None
    
    def generate_prompt(
        self,
        subject: str,
        style: str = "professional corporate photography",
        mood: str = "confident",
        colors: str = "brand colors",
    ) -> str:
        """Generate an optimized image prompt"""
        return f"{subject}, {style}, {mood} mood, {colors}, high quality, 8k, professional lighting"

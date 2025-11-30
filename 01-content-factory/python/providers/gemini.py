"""
Google Gemini AI Provider for fast content generation
"""
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
import google.generativeai as genai


_executor = ThreadPoolExecutor(max_workers=10)


class GeminiProvider:
    """Gemini 1.5 Flash provider for fast content generation"""
    
    def __init__(self):
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel("gemini-1.5-flash")
            self.available = True
        else:
            self.model = None
            self.available = False
            print("GEMINI_API_KEY not set - Gemini provider disabled")
    
    def _sync_generate(
        self,
        prompt: str,
        max_tokens: int,
        temperature: float,
    ) -> str:
        """Synchronous generation call"""
        response = self.model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=max_tokens,
                temperature=temperature,
            ),
        )
        return response.text
    
    async def generate(
        self,
        prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """Generate content using Gemini Flash (async wrapper)"""
        if not self.available:
            raise RuntimeError("Gemini provider not available - API key missing")
        
        loop = asyncio.get_event_loop()
        try:
            result = await loop.run_in_executor(
                _executor,
                self._sync_generate,
                prompt,
                max_tokens,
                temperature,
            )
            return result
        except Exception as e:
            print(f"Gemini API error: {e}")
            raise
    
    async def generate_fast(
        self,
        prompt: str,
    ) -> str:
        """Quick generation with default settings"""
        return await self.generate(prompt, max_tokens=2048, temperature=0.5)

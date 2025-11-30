"""
Claude AI Provider using Replit AI Integrations
"""
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
from anthropic import Anthropic
from typing import Optional


_executor = ThreadPoolExecutor(max_workers=10)


class ClaudeProvider:
    """Claude Sonnet provider via Replit AI Integrations"""
    
    def __init__(self):
        base_url = os.environ.get("AI_INTEGRATIONS_ANTHROPIC_BASE_URL")
        api_key = os.environ.get("AI_INTEGRATIONS_ANTHROPIC_API_KEY")
        
        if not api_key:
            raise ValueError("AI_INTEGRATIONS_ANTHROPIC_API_KEY not set")
        
        self.client = Anthropic(
            base_url=base_url,
            api_key=api_key,
        )
        self.model = "claude-sonnet-4-5"
    
    def _sync_generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int,
        temperature: float,
    ) -> str:
        """Synchronous generation call"""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        
        text_block = next(
            (block for block in response.content if block.type == "text"),
            None
        )
        return text_block.text if text_block else ""
    
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """Generate content using Claude Sonnet (async wrapper)"""
        loop = asyncio.get_event_loop()
        try:
            result = await loop.run_in_executor(
                _executor,
                self._sync_generate,
                system_prompt,
                user_prompt,
                max_tokens,
                temperature,
            )
            return result
        except Exception as e:
            print(f"Claude API error: {e}")
            raise
    
    async def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
    ) -> str:
        """Generate JSON content - adds JSON instruction to prompt"""
        enhanced_prompt = f"{user_prompt}\n\nReturn ONLY valid JSON, no other text."
        return await self.generate(
            system_prompt,
            enhanced_prompt,
            max_tokens,
            temperature=0.3,
        )

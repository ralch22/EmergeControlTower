"""
ElevenLabs Voice AI Provider for voiceovers
"""
import os
import httpx
from typing import Optional


class ElevenLabsProvider:
    """ElevenLabs provider for AI voiceovers"""
    
    BASE_URL = "https://api.elevenlabs.io/v1"
    
    def __init__(self):
        self.api_key = os.environ.get("ELEVENLABS_API_KEY")
        self.available = bool(self.api_key)
        self.default_voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
        
        if not self.available:
            print("ELEVENLABS_API_KEY not set - ElevenLabs provider disabled")
    
    async def generate_voiceover(
        self,
        text: str,
        voice_id: Optional[str] = None,
        model_id: str = "eleven_turbo_v2_5",
    ) -> Optional[bytes]:
        """Generate voiceover audio from text"""
        if not self.available:
            print("ElevenLabs not available - returning mock")
            return None
        
        voice = voice_id or self.default_voice_id
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.BASE_URL}/text-to-speech/{voice}",
                    headers={
                        "xi-api-key": self.api_key or "",
                        "Content-Type": "application/json",
                    },
                    json={
                        "text": text,
                        "model_id": model_id,
                        "voice_settings": {
                            "stability": 0.5,
                            "similarity_boost": 0.75,
                        },
                    },
                    timeout=60.0,
                )
                
                if response.status_code == 200:
                    return response.content
                else:
                    print(f"ElevenLabs error: {response.status_code} - {response.text}")
                    return None
                    
            except Exception as e:
                print(f"ElevenLabs API error: {e}")
                return None
    
    async def get_voices(self) -> list:
        """Get list of available voices"""
        if not self.available:
            return []
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/voices",
                    headers={"xi-api-key": self.api_key or ""},
                )
                
                if response.status_code == 200:
                    return response.json().get("voices", [])
                return []
                
            except Exception as e:
                print(f"ElevenLabs API error: {e}")
                return []

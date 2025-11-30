"""
Buffer API Integration for auto-publishing social content
"""
import os
import httpx
from typing import Optional, List
from ..models import GeneratedContent, ContentType


class BufferPublisher:
    """Publisher for auto-posting content to social platforms via Buffer"""
    
    BASE_URL = "https://api.bufferapp.com/1"
    
    def __init__(self):
        self.access_token = os.environ.get("BUFFER_ACCESS_TOKEN")
        self.available = bool(self.access_token)
        
        if not self.available:
            print("BUFFER_ACCESS_TOKEN not set - Buffer publishing disabled")
    
    async def get_profiles(self) -> List[dict]:
        """Get connected social media profiles"""
        if not self.available:
            return []
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/profiles.json",
                    params={"access_token": self.access_token},
                    timeout=10.0,
                )
                
                if response.status_code == 200:
                    return response.json()
                return []
                
            except Exception as e:
                print(f"Buffer profiles error: {e}")
                return []
    
    async def publish(
        self,
        content: GeneratedContent,
        profile_ids: Optional[List[str]] = None,
        scheduled_at: Optional[str] = None,
    ) -> bool:
        """Publish content to Buffer"""
        if not self.available:
            print(f"[Buffer] Mock publish: {content.title}")
            return True
        
        if profile_ids is None:
            profiles = await self.get_profiles()
            profile_ids = [p["id"] for p in profiles if self._matches_platform(p, content.content_type)]
        
        if not profile_ids:
            print(f"[Buffer] No matching profiles for {content.content_type}")
            return False
        
        async with httpx.AsyncClient() as client:
            try:
                payload = {
                    "access_token": self.access_token,
                    "profile_ids[]": profile_ids,
                    "text": content.content[:2000],
                }
                
                if scheduled_at:
                    payload["scheduled_at"] = scheduled_at
                
                media_urls = content.media_urls
                if media_urls:
                    payload["media[link]"] = media_urls[0]
                
                response = await client.post(
                    f"{self.BASE_URL}/updates/create.json",
                    data=payload,
                    timeout=30.0,
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get("success"):
                        print(f"[Buffer] Published: {content.title}")
                        return True
                    else:
                        print(f"[Buffer] Failed: {result.get('message')}")
                        return False
                else:
                    print(f"[Buffer] Error {response.status_code}: {response.text}")
                    return False
                    
            except Exception as e:
                print(f"Buffer publish error: {e}")
                return False
    
    async def publish_batch(
        self,
        contents: List[GeneratedContent],
        schedule_interval_minutes: int = 60,
    ) -> dict:
        """Publish multiple pieces with scheduling"""
        from datetime import datetime, timedelta
        
        results = {"success": 0, "failed": 0}
        
        base_time = datetime.now()
        
        for i, content in enumerate(contents):
            scheduled = (base_time + timedelta(minutes=i * schedule_interval_minutes)).isoformat()
            success = await self.publish(content, scheduled_at=scheduled)
            
            if success:
                results["success"] += 1
            else:
                results["failed"] += 1
        
        return results
    
    def _matches_platform(self, profile: dict, content_type: ContentType) -> bool:
        """Check if Buffer profile matches content type"""
        service = profile.get("service", "").lower()
        
        platform_map = {
            ContentType.LINKEDIN: ["linkedin"],
            ContentType.TWITTER: ["twitter", "x"],
            ContentType.INSTAGRAM: ["instagram"],
            ContentType.FACEBOOK_AD: ["facebook"],
        }
        
        allowed = platform_map.get(content_type, [])
        return service in allowed

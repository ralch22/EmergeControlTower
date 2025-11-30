"""
Dashboard Bridge - Connects Python Content Factory to TypeScript Dashboard
Updates real-time counters and pushes content to the shared database
"""
import os
import httpx
from typing import Optional, List
from .models import GeneratedContent, ContentRunState, ContentStatus


class DashboardBridge:
    """
    Bridge between Python Content Factory and TypeScript Dashboard.
    Sends updates to the Express backend to update KPIs and content.
    """
    
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or os.environ.get("DASHBOARD_URL", "http://localhost:5000")
    
    async def increment_ai_counter(self, count: int = 1) -> bool:
        """Increment the AI Output counter on the dashboard"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/kpis/increment-ai-output",
                    json={"count": count},
                    timeout=10.0,
                )
                return response.status_code == 200
            except Exception as e:
                print(f"Dashboard counter update failed: {e}")
                return False
    
    async def push_content(self, content: GeneratedContent) -> bool:
        """Push generated content to the dashboard database"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/generated-content",
                    json={
                        "id": content.id,
                        "runId": content.run_id,
                        "clientId": content.client_id,
                        "topicId": content.topic_id,
                        "contentType": content.content_type.value,
                        "title": content.title,
                        "content": content.content,
                        "metadata": content.metadata,
                        "status": content.status.value,
                        "qaScore": content.qa_score,
                        "qaFeedback": content.qa_feedback,
                        "mediaUrls": content.media_urls,
                    },
                    timeout=10.0,
                )
                return response.status_code in [200, 201]
            except Exception as e:
                print(f"Push content failed: {e}")
                return False
    
    async def push_content_batch(self, contents: List[GeneratedContent]) -> dict:
        """Push multiple content pieces to the dashboard"""
        results = {"success": 0, "failed": 0}
        
        for content in contents:
            if await self.push_content(content):
                results["success"] += 1
            else:
                results["failed"] += 1
        
        return results
    
    async def push_run_summary(self, run: ContentRunState) -> bool:
        """Push run summary to dashboard"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/content-runs",
                    json={
                        "id": run.run_id,
                        "clientId": run.config.client_id,
                        "status": run.status,
                        "totalPieces": run.total_pieces,
                        "passedPieces": run.passed_pieces,
                        "failedPieces": run.failed_pieces,
                        "errors": run.errors,
                        "startedAt": run.started_at.isoformat() if run.started_at else None,
                        "completedAt": run.completed_at.isoformat() if run.completed_at else None,
                    },
                    timeout=10.0,
                )
                return response.status_code in [200, 201]
            except Exception as e:
                print(f"Push run summary failed: {e}")
                return False
    
    async def add_to_approval_queue(self, content: GeneratedContent, client_name: str) -> bool:
        """Add content to the approval queue on the dashboard"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/approval-queue",
                    json={
                        "type": content.content_type.value,
                        "description": content.title,
                        "client": client_name,
                        "impact": f"QA Score: {content.qa_score}/10" if content.qa_score else "Pending review",
                        "contentId": content.id,
                    },
                    timeout=10.0,
                )
                return response.status_code in [200, 201]
            except Exception as e:
                print(f"Add to approval queue failed: {e}")
                return False
    
    async def update_content_status(
        self,
        content_id: str,
        status: ContentStatus,
    ) -> bool:
        """Update content status in the dashboard"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.patch(
                    f"{self.base_url}/api/generated-content/{content_id}",
                    json={"status": status.value},
                    timeout=10.0,
                )
                return response.status_code == 200
            except Exception as e:
                print(f"Update content status failed: {e}")
                return False


dashboard = DashboardBridge()

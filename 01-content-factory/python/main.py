"""
Content Factory Agent - Main Entry Point
FastAPI server with REST endpoints for content generation

Usage:
  python 01-content-factory/python/main.py

Or run with uvicorn:
  uvicorn 01-content-factory.python.main:app --host 0.0.0.0 --port 8000
"""
import os
import asyncio
from datetime import datetime
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .models import (
    BrandVoice,
    ContentType,
    ContentRunConfig,
    ContentRunState,
    GeneratedContent,
    ContentStatus,
)
from .orchestrator import ContentFactoryOrchestrator, run_content_factory
from .brand_voice_db import brand_voice_db, SAMPLE_BRAND_VOICES
from .dashboard_bridge import dashboard
from .integrations.slack import SlackNotifier


app = FastAPI(
    title="Content Factory Agent",
    description="AI-powered content generation pipeline - produces 40-60 pieces per day",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_runs: dict[str, ContentRunState] = {}
recent_content: List[GeneratedContent] = []
slack = SlackNotifier()


class RunWeekRequest(BaseModel):
    client_name: str
    topic_count: int = 7
    content_types: List[str] = ["blog", "linkedin", "twitter", "facebook_ad", "video_script"]


class RunWeekResponse(BaseModel):
    run_id: str
    status: str
    message: str


class ContentApprovalRequest(BaseModel):
    approved: bool
    feedback: Optional[str] = None


@app.get("/")
async def root():
    """Health check and info"""
    return {
        "service": "Content Factory Agent",
        "version": "1.0.0",
        "status": "running",
        "clients_loaded": len(brand_voice_db.list_all()),
        "active_runs": len(active_runs),
        "recent_pieces": len(recent_content),
    }


@app.get("/api/clients")
async def list_clients():
    """List all available clients with brand voices"""
    voices = brand_voice_db.list_all()
    return [
        {
            "id": v.client_id,
            "name": v.client_name,
            "industry": v.industry,
            "tone": v.tone[:100] + "..." if len(v.tone) > 100 else v.tone,
        }
        for v in voices
    ]


@app.get("/api/clients/{client_id}")
async def get_client(client_id: str):
    """Get detailed brand voice for a client"""
    voice = brand_voice_db.get(client_id)
    if not voice:
        raise HTTPException(status_code=404, detail="Client not found")
    return voice.model_dump()


@app.post("/api/run-week", response_model=RunWeekResponse)
async def run_week_for_client(request: RunWeekRequest, background_tasks: BackgroundTasks):
    """
    Run a full week of content generation for a client.
    Generates 7 topics with all content types (40-60 pieces total).
    """
    voice = brand_voice_db.get_by_name(request.client_name)
    if not voice:
        voice = brand_voice_db.get(request.client_name)
    
    if not voice:
        raise HTTPException(
            status_code=404,
            detail=f"Client '{request.client_name}' not found. Available: {[v.client_name for v in brand_voice_db.list_all()]}"
        )
    
    content_types = [ContentType(ct) for ct in request.content_types]
    
    config = ContentRunConfig(
        client_id=voice.client_id,
        client_name=voice.client_name,
        brand_voice=voice,
        topic_count=request.topic_count,
        content_types=content_types,
        run_type="weekly",
    )
    
    run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{voice.client_id}"
    
    background_tasks.add_task(execute_content_run, config, run_id)
    
    return RunWeekResponse(
        run_id=run_id,
        status="started",
        message=f"Content generation started for {voice.client_name}. Check /api/runs/{run_id} for progress.",
    )


async def execute_content_run(config: ContentRunConfig, run_id: str):
    """Execute the content factory pipeline in the background"""
    global recent_content
    
    async def on_content_created(count: int):
        await dashboard.increment_ai_counter(count)
    
    async def on_progress(state: ContentRunState):
        active_runs[run_id] = state
    
    try:
        orchestrator = ContentFactoryOrchestrator(
            on_progress=on_progress,
            on_content_created=on_content_created,
        )
        
        result = await orchestrator.run(config)
        active_runs[run_id] = result
        
        recent_content = result.generated_content[-10:] + recent_content[:90]
        
        await dashboard.push_run_summary(result)
        await dashboard.push_content_batch(result.generated_content)
        
        for content in result.generated_content:
            if content.status == ContentStatus.PENDING_REVIEW:
                await dashboard.add_to_approval_queue(content, config.client_name)
        
        await slack.send_run_summary(
            config.client_name,
            run_id,
            result.total_pieces,
            result.passed_pieces,
            result.failed_pieces,
        )
        
        print(f"[ContentFactory] Run {run_id} complete: {result.total_pieces} pieces generated")
        
    except Exception as e:
        print(f"[ContentFactory] Run {run_id} failed: {e}")
        active_runs[run_id] = ContentRunState(
            run_id=run_id,
            config=config,
            status="failed",
            errors=[str(e)],
        )


@app.get("/api/runs")
async def list_runs():
    """List all active and recent content runs"""
    return [
        {
            "run_id": run.run_id,
            "client": run.config.client_name,
            "status": run.status,
            "total_pieces": run.total_pieces,
            "passed_pieces": run.passed_pieces,
            "failed_pieces": run.failed_pieces,
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        }
        for run in active_runs.values()
    ]


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str):
    """Get detailed status of a content run"""
    if run_id not in active_runs:
        raise HTTPException(status_code=404, detail="Run not found")
    
    run = active_runs[run_id]
    return {
        "run_id": run.run_id,
        "client": run.config.client_name,
        "status": run.status,
        "total_pieces": run.total_pieces,
        "passed_pieces": run.passed_pieces,
        "failed_pieces": run.failed_pieces,
        "errors": run.errors,
        "topics": [t.model_dump() for t in run.topics],
        "content": [c.model_dump() for c in run.generated_content],
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
    }


@app.get("/api/preview")
async def get_preview():
    """Get last 10 generated content pieces for live preview"""
    return [
        {
            "id": c.id,
            "client_id": c.client_id,
            "type": c.content_type.value,
            "title": c.title,
            "preview": c.content[:200] + "..." if len(c.content) > 200 else c.content,
            "status": c.status.value,
            "qa_score": c.qa_score,
            "media_urls": c.media_urls,
            "created_at": c.created_at.isoformat(),
        }
        for c in recent_content[:10]
    ]


@app.get("/api/content/{content_id}")
async def get_content(content_id: str):
    """Get full content by ID"""
    for content in recent_content:
        if content.id == content_id:
            return content.model_dump()
    
    raise HTTPException(status_code=404, detail="Content not found")


@app.post("/api/content/{content_id}/approve")
async def approve_content(content_id: str):
    """Approve content piece"""
    for content in recent_content:
        if content.id == content_id:
            content.status = ContentStatus.APPROVED
            await dashboard.update_content_status(content_id, ContentStatus.APPROVED)
            return {"status": "approved", "content_id": content_id}
    
    raise HTTPException(status_code=404, detail="Content not found")


@app.post("/api/content/{content_id}/reject")
async def reject_content(content_id: str, request: Optional[ContentApprovalRequest] = None):
    """Reject content piece"""
    for content in recent_content:
        if content.id == content_id:
            content.status = ContentStatus.REJECTED
            if request and request.feedback:
                content.qa_feedback = request.feedback
            await dashboard.update_content_status(content_id, ContentStatus.REJECTED)
            return {"status": "rejected", "content_id": content_id}
    
    raise HTTPException(status_code=404, detail="Content not found")


@app.get("/api/stats")
async def get_stats():
    """Get overall content factory statistics"""
    total_runs = len(active_runs)
    total_pieces = sum(run.total_pieces for run in active_runs.values())
    total_passed = sum(run.passed_pieces for run in active_runs.values())
    total_failed = sum(run.failed_pieces for run in active_runs.values())
    
    return {
        "total_runs": total_runs,
        "total_pieces_generated": total_pieces,
        "total_passed_qa": total_passed,
        "total_failed_qa": total_failed,
        "pass_rate": (total_passed / total_pieces * 100) if total_pieces > 0 else 0,
        "clients_available": len(brand_voice_db.list_all()),
    }


if __name__ == "__main__":
    import uvicorn
    
    print("\n🚀 Content Factory Agent Starting...")
    print(f"📊 Loaded {len(SAMPLE_BRAND_VOICES)} brand voice profiles")
    print("🔗 Dashboard bridge ready")
    print("\nAvailable clients:")
    for voice in SAMPLE_BRAND_VOICES:
        print(f"  - {voice.client_name} ({voice.industry})")
    print("\n")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.environ.get("CONTENT_FACTORY_PORT", "8000")),
        reload=False,
    )

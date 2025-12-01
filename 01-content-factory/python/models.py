"""
Pydantic models for the Content Factory Agent
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class ContentType(str, Enum):
    BLOG = "blog"
    LINKEDIN = "linkedin"
    TWITTER = "twitter"
    INSTAGRAM = "instagram"
    FACEBOOK_AD = "facebook_ad"
    GOOGLE_AD = "google_ad"
    VIDEO_SCRIPT = "video_script"
    CAROUSEL = "carousel"


class ContentStatus(str, Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    PUBLISHED = "published"


class BrandVoice(BaseModel):
    client_id: str
    client_name: str
    industry: str
    tone: str
    forbidden_words: List[str] = []
    target_audience: str
    keywords: List[str] = []
    content_goals: List[str] = []
    past_winners: List[str] = []
    examples: List[str] = []
    
    # Visual and cinematic brand guidelines
    visual_style: Optional[str] = Field(None, description="Overall visual aesthetic (e.g., 'cinematic with warm tones, high contrast, slow-motion transitions')")
    color_palette: Optional[List[str]] = Field(None, description="Hex codes or color names (e.g., ['#FF0000', '#1A2B5C', 'navy blue'])")
    fonts: Optional[List[str]] = Field(None, description="Preferred fonts (e.g., ['Arial', 'Helvetica'])")
    reference_assets: Optional[Dict[str, str]] = Field(None, description="Key-value pairs of asset names to paths/URLs (e.g., {'logo': 'attached_assets/brand/logo.png'})")
    cinematic_guidelines: Optional[str] = Field(None, description="Video-specific rules (e.g., 'Use 16:9 aspect ratio, dramatic lighting, orchestral music')")


class ContentTopic(BaseModel):
    id: str
    title: str
    angle: str
    keywords: List[str]
    content_types: List[ContentType]
    priority: str = "medium"


class BlogPost(BaseModel):
    id: str
    topic_id: str
    title: str
    content: str
    meta_description: str
    headings: List[str]
    word_count: int
    seo_score: Optional[float] = None
    cta: str


class SocialPost(BaseModel):
    id: str
    topic_id: str
    platform: str
    content: str
    hashtags: List[str] = []
    media_prompt: Optional[str] = None
    carousel_slides: Optional[List[str]] = None


class AdCopy(BaseModel):
    id: str
    topic_id: str
    platform: str
    headlines: List[str]
    descriptions: List[str]
    cta: str
    target_audience: str


class VideoScript(BaseModel):
    id: str
    topic_id: str
    hook: str
    script: str
    duration_seconds: int
    voiceover_url: Optional[str] = None
    video_url: Optional[str] = None
    cta: str


class QAResult(BaseModel):
    content_id: str
    score: float
    feedback: str
    issues: List[str] = []
    passed: bool
    brand_voice_match: float
    guidelines_compliance: float


class GeneratedContent(BaseModel):
    id: str
    run_id: str
    client_id: str
    topic_id: str
    content_type: ContentType
    title: str
    content: str
    metadata: Dict[str, Any] = {}
    status: ContentStatus = ContentStatus.DRAFT
    qa_score: Optional[float] = None
    qa_feedback: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    media_urls: List[str] = []


class ContentRunConfig(BaseModel):
    client_id: str
    client_name: str
    brand_voice: BrandVoice
    topic_count: int = 7
    content_types: List[ContentType] = [
        ContentType.BLOG,
        ContentType.LINKEDIN,
        ContentType.TWITTER,
        ContentType.FACEBOOK_AD,
        ContentType.VIDEO_SCRIPT,
    ]
    run_type: str = "weekly"


class ContentRunState(BaseModel):
    run_id: str
    config: ContentRunConfig
    topics: List[ContentTopic] = []
    blog_posts: List[BlogPost] = []
    social_posts: List[SocialPost] = []
    ad_copies: List[AdCopy] = []
    video_scripts: List[VideoScript] = []
    qa_results: Dict[str, QAResult] = {}
    generated_content: List[GeneratedContent] = []
    status: str = "pending"
    total_pieces: int = 0
    passed_pieces: int = 0
    failed_pieces: int = 0
    errors: List[str] = []
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class SlackApprovalPayload(BaseModel):
    content_id: str
    client_name: str
    content_type: str
    title: str
    preview: str
    qa_score: float
    approve_url: str
    reject_url: str


class BufferPublishPayload(BaseModel):
    content_id: str
    platform: str
    content: str
    media_urls: List[str] = []
    scheduled_at: Optional[datetime] = None


class IngredientScene(BaseModel):
    id: str
    prompt: str
    duration: int = 4
    imageUrl: Optional[str] = None
    order: int = 0


class SceneStatus(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


class SceneResult(BaseModel):
    scene_id: str
    status: SceneStatus = SceneStatus.PENDING
    video_url: Optional[str] = None
    error: Optional[str] = None


class IngredientBundle(BaseModel):
    id: str = Field(default_factory=lambda: f"bundle_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    scenes: List[IngredientScene]
    voiceoverScript: str = ""
    voiceStyle: str = "default"
    aspectRatio: str = "16:9"
    resolution: str = "720p"


class IngredientGenerationResult(BaseModel):
    bundle_id: str
    status: str = "pending"
    scene_results: List[SceneResult] = []
    voiceover_url: Optional[str] = None
    voiceover_error: Optional[str] = None
    total_scenes: int = 0
    completed_scenes: int = 0
    failed_scenes: int = 0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

# Emerge Digital Control Tower

## Overview
The Emerge Digital Control Tower is a full-stack web application designed as an agency master dashboard. Its primary purpose is to track business metrics, manage business units ("pods"), monitor phase changes, streamline approval workflows, and handle alerts. The application aims to automate content generation workflows, specifically targeting 40-60 client-ready content pieces per day across various formats like blogs, social media posts, and video. It uses a modern React frontend with shadcn/ui and an Express backend with a PostgreSQL database.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18+ with TypeScript, using Vite for development and build.
- **UI/UX**: shadcn/ui with Radix UI primitives, Tailwind CSS v4 for styling, dark mode enabled, Inter font, and Alpine.js for lightweight interactivity.
- **State Management**: TanStack Query (React Query) for server state, React Hook Form with Zod for form validation.
- **Design Decisions**: Emphasis on fast builds (Vite), consistent UI (shadcn/ui), and custom Vite plugins for Replit-specific tooling and meta image generation.

### Backend
- **Framework**: Express.js with TypeScript in ESM mode.
- **API Design**: RESTful API (`/api` prefix), JSON format, Zod validation for all incoming data, centralized error handling.
- **Build Strategy**: Server bundled with esbuild for reduced cold start times, allowing specific dependencies to be bundled while others are external.

### Data Storage
- **Database**: PostgreSQL via Neon serverless driver, utilizing WebSocket support and connection pooling.
- **ORM**: Drizzle ORM for type-safe queries and migrations, with schema definitions shared between client and server.
- **Data Models**: KPIs (MRR, profit, AI output), Pods (business units), Phase Changes (price tracking), Approval Queue, and Alerts.
- **Storage Layer**: Abstracted `IStorage` interface with a `DatabaseStorage` implementation for CRUD operations.

### Content Factory System (Python LangGraph)
- **Orchestration**: LangGraph StateGraph pipeline for parallel content generation (topic generation, then blog, social, adcopy, video, followed by QA and publish).
- **Core Components**: FastAPI server (`main.py`), LangGraph orchestrator, Pydantic models, and utility functions.
- **Agents**: Specialized agents for Topic Generation, Blog Posts (1500+ words), Social Media (LinkedIn, X, Instagram), Ad Copy (Google/Meta), Video Production (scripting, voiceover, video generation), and QA (quality review with Slack approval).
- **AI Providers**: Primarily Claude Sonnet 4.5, Gemini 1.5 Flash (optional), ElevenLabs for TTS, Runway/Midjourney for media generation.
- **Integrations**: Slack for QA notifications, Buffer for social content publishing.
- **Dashboard Bridge**: Real-time KPI updates and content push to approval queue.

### Ingredients to Video System
- **Schema**: `videoIngredients`, `videoProjects`, `videoScenes`, `videoClips`, `audioTracks` for structured video creation.
- **Video Provider Orchestration**: Multi-provider fallback (Veo 3.1, Runway, etc.) with priority and automatic retry on failure.
- **Reference Image Generation**: Automatic scene images generated when creating video projects, with provider fallback chain:
  1. **Nano Banana Pro** (Gemini `gemini-2.0-flash-exp-image-generation`) - primary, returns base64 data URLs
  2. **Fal AI Flux Pro** (`fal-ai/flux-pro/v1.1`) - first fallback, returns hosted URLs
  3. **Alibaba Dashscope** (`wan2.5-t2i-preview`) - second fallback, returns hosted URLs
- **Enhanced Prompt System**: `buildEnhancedVideoPrompt()` combines visual and narrative context for script-aligned video generation. Includes a force regeneration option.
- **Voiceover Fallback**: ElevenLabs primary, OpenAI TTS fallback.
- **Video Assembly**: Shotstack for timeline-based video assembly, audio layering, transitions, and text overlays. Shotstack Ingest API for permanent audio hosting.
- **API-Python Bridge**: Facilitates communication between the Express backend and the Python content factory for video ingredient generation and status checks.

### Unified Video Orchestrator
- **Full Video Generation**: Single endpoint (`POST /api/video/generate-full`) handles complete flow: topic → script → scenes → clips → voiceover → assembly.
- **Text Generation Fallback**: Script generation uses intelligent fallback: Claude (primary) → DeepSeek R1 (free) → Llama 4 (free) → Mistral (free).
- **Auto-Retry System**: Automatic retry with exponential backoff for failed scenes, provider rotation on failure.
- **API Endpoints**:
  - `POST /api/video/generate-full`: Generate complete video from topic
  - `POST /api/video-projects/:projectId/auto-retry`: Manually trigger retry for failed scenes

### Provider Status System
- **API Endpoint**: `GET /api/providers/status` provides a comprehensive health check of all configured external providers (Alibaba, Gemini, ElevenLabs, Runway, Shotstack, Anthropic) including their status (working, limited, error, not_configured) and actionable remediation steps.
- **Error Handling**: Actionable error messages and model fallback mechanisms (e.g., Alibaba image generation).

## External Dependencies

### Database & ORM
- **Neon**: Serverless PostgreSQL database.
- **Drizzle ORM**: Type-safe ORM for PostgreSQL.
- **@neondatabase/serverless**: Serverless driver for Neon.

### UI & Styling
- **shadcn/ui**: Component library for React.
- **Radix UI**: Low-level UI primitives for accessibility.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.
- **cmdk**: Command palette component.
- **Embla Carousel**: Carousel component.
- **date-fns**: Date utility library.
- **class-variance-authority**: Utility for managing component variants.
- **clsx**, **tailwind-merge**: Utilities for combining CSS classes.

### Form Validation & State
- **Zod**: Runtime type validation.
- **drizzle-zod**: Zod schema generation from Drizzle.
- **React Hook Form**: Form management library.
- **@hookform/resolvers**: Integration for React Hook Form with Zod.
- **TanStack Query (React Query)**: Server state management.

### AI & Content Generation
- **Replit AI Integrations (Anthropic)**: Claude Sonnet 4.5.
- **Google AI**: Gemini 1.5 Flash, `gemini-2.0-flash-exp-image-generation` model.
- **Adobe Firefly**: Professional image generation with custom models support (v3 API).
- **OpenRouter**: Unified AI gateway providing access to 100+ models (DeepSeek R1, Llama 4, Qwen 3, Mistral) - many FREE.
- **ElevenLabs**: Text-to-speech.
- **Runway**: AI video generation.
- **Midjourney (via Replicate)**: Image generation.
- **Alibaba Dashscope**: Image generation (`wan2.5-t2i-preview`, `qwen-image-plus`).

### OpenRouter Integration
- **Unified Gateway**: Single API key for 100+ AI models from DeepSeek, Meta, Alibaba, Mistral, Google.
- **Free Models Available**: DeepSeek R1, Llama 4 Maverick/Scout, Mistral Small 3.1, Gemini 2.5 Pro Exp.
- **Smart Fallback**: Integrated into self-healing provider system with automatic routing.
- **Text Generation Chains**:
  - `text_default`: anthropic → openrouter_deepseek_r1 → openrouter_llama4_maverick → gemini_text
  - `text_free_only`: openrouter_deepseek_r1 → openrouter_llama4_maverick → openrouter_mistral_small → gemini_text
  - `text_reasoning`: openrouter_deepseek_r1 → openrouter_qwen3 → anthropic
  - `text_bulk_content`: openrouter_deepseek_v3 → openrouter_mistral_small → openrouter_llama4_maverick → gemini_text
- **API Endpoints**: `/api/openrouter/test`, `/api/openrouter/models`, `/api/openrouter/generate`, `/api/openrouter/blog`, `/api/openrouter/social`, `/api/openrouter/analyze`.

### ML Self-Healing Provider System
- **Provider Health Monitor**: Tracks real-time provider status, success rates, latency, and cost per request.
- **Smart Router**: ML-based provider ordering based on health metrics, historical patterns, and cost optimization.
- **Rate Limit Detection**: Automatically detects 429 errors and quota limits, temporarily disables providers with cooldown.
- **Error Pattern Learning**: Learns from failures (e.g., Runway duration constraints) to pre-filter incompatible requests.
- **Free Tier Fallbacks**: Prioritizes free providers (Gemini, Veo 3.1) before paid alternatives.
- **Provider Health Dashboard**: Visual UI at `/provider-health` showing provider status, smart routing, and healing actions.

### Quality-Aware Optimization System
- **Database Schema**: `contentQualityReviews` (user ratings), `contentQualityMetrics` (objective metrics), `providerQualityScores` (provider quality tracking), `qualityTierConfigs` (tier settings).
- **Dual-Score Routing**: Combines operational health (uptime, latency, error rates) with quality metrics (user ratings, acceptance rates) for intelligent provider selection.
- **Quality Tiers**: Three execution profiles with configurable weighting:
  - `draft`: Fast/cheap, 30% quality weight, 70% operational
  - `production`: Balanced, 50% quality weight, 50% operational
  - `cinematic_4k`: Quality-first, 70% quality weight, 30% operational
- **Objective Metrics Tracking**: Resolution, bitrate, FPS, color depth, audio loudness, script-to-scene coherence, brand compliance, motion smoothness, artifact detection.
- **Feedback Loop**: User ratings (1-5 scale) with accept/reject flags feed into provider quality scores, progressively improving routing toward 4K cinematic on-brand content.
- **Quality Review UI**: Located at `/quality-review` with:
  - Pending review lists for video projects and content
  - Star rating system (1-5)
  - Accept/reject workflow with feedback
  - Provider quality score display
  - Review history
- **API Endpoints**:
  - `POST /api/quality/reviews`: Submit quality reviews
  - `GET /api/quality/provider-status`: Combined operational + quality scores
  - `GET /api/quality/routing/:serviceType`: Quality-aware provider order
  - `POST /api/quality/provider-feedback`: Update provider quality from review
  - `POST /api/quality/recommend-tier`: Get recommended quality tier
  - `GET /api/quality/dashboard`: Comprehensive quality metrics

### Integrations
- **Shotstack**: Video assembly and audio hosting.
- **Slack**: Webhook notifications.
- **Buffer**: Social media publishing.
- **connect-pg-simple**: PostgreSQL session storage.

### Development & Build Tools
- **Vite**: Frontend build tool.
- **TypeScript**: Language.
- **esbuild**: Backend bundling.
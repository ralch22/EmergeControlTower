# Emerge Digital Control Tower

## Overview
The Emerge Digital Control Tower is a full-stack web application serving as an agency master dashboard. Its core purpose is to track business metrics, manage business units, monitor phase changes, streamline approval workflows, and handle alerts. The application automates content generation, aiming for 40-60 client-ready content pieces daily across various formats, leveraging a modern React frontend with shadcn/ui and an Express backend with a PostgreSQL database. The business vision is to significantly scale content production and management efficiently.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Design Principles
The system emphasizes fast builds (Vite, esbuild), consistent UI (shadcn/ui), type-safety (TypeScript, Zod, Drizzle ORM), and a robust, self-healing AI provider system. It integrates a sophisticated content factory for automated content generation and a comprehensive video production pipeline.

### Frontend
-   **Technology**: React 18+ (TypeScript), Vite, shadcn/ui (Radix UI), Tailwind CSS v4, Alpine.js.
-   **State Management**: TanStack Query for server state, React Hook Form with Zod for validation.
-   **UI/UX**: Dark mode, Inter font, custom Vite plugins for Replit tooling and meta image generation.
-   **Navigation**: Collapsible sidebar with categories: Content Production, Quality & Review, Brand Management, System.

### Backend
-   **Technology**: Express.js (TypeScript, ESM mode).
-   **API**: RESTful, JSON format, Zod validation, centralized error handling.
-   **Build**: Bundled with esbuild for reduced cold start times.

### Data Storage
-   **Database**: PostgreSQL via Neon serverless driver (WebSocket, connection pooling).
-   **ORM**: Drizzle ORM for type-safe queries and migrations.
-   **Data Models**: KPIs, Pods, Phase Changes, Approval Queue, Alerts, content generation-specific schemas (e.g., video ingredients).
-   **Abstraction**: `IStorage` interface with `DatabaseStorage` implementation.

### Content Generation Systems
-   **Content Factory (Python LangGraph)**:
    -   Orchestrates parallel content generation (topic, blog, social, adcopy, video, QA, publish) via a LangGraph StateGraph pipeline.
    -   Utilizes specialized agents (Topic, Blog, Social, Ad Copy, Video, QA).
    -   Integrates with dashboard for KPI updates and approval queue.
-   **Single Content Generation (Quick Create)**:
    -   Generates individual content pieces on-demand through a dedicated API endpoint (`/api/content/generate-single`).
    -   Supports various content types with intelligent text generation fallback (Claude → DeepSeek → Llama → Mistral).
-   **Ingredients to Video System**:
    -   Manages structured video creation (videoIngredients, videoProjects, videoScenes, videoClips, audioTracks).
    -   Multi-provider orchestration for video, reference image generation (Nano Banana Pro, Fal AI Flux Pro, Alibaba Dashscope), and voiceover (ElevenLabs, OpenAI TTS).
    -   Video assembly via Shotstack for timeline-based editing.
-   **Unified Video Orchestrator**:
    -   Handles full video generation workflow from topic to final assembly (`/api/video/generate-full`).
    -   Includes text generation fallback and auto-retry system with exponential backoff for failed scenes.

### AI Provider Management
-   **ML Self-Healing Provider System**: Monitors real-time provider status, latency, cost, and success rates. Uses ML-based routing for optimal provider selection, rate limit detection, and error pattern learning. Prioritizes free tiers.
-   **Quality-Aware Optimization System**: Combines operational health with quality metrics (user ratings, objective metrics like resolution, brand compliance) for intelligent provider routing. Supports quality tiers (draft, production, cinematic_4k) with configurable weighting. UI for quality reviews and feedback loop.
-   **Provider Status API**: `GET /api/providers/status` provides health checks and remediation steps for all external providers.

## External Dependencies

### Database & ORM
-   **Neon**: Serverless PostgreSQL.
-   **Drizzle ORM**: Type-safe ORM.
-   **@neondatabase/serverless**: Neon driver.

### UI & Styling
-   **shadcn/ui**: Component library.
-   **Radix UI**: UI primitives.
-   **Tailwind CSS**: Utility-first CSS.
-   **Lucide React**: Icons.
-   **cmdk**: Command palette.
-   **Embla Carousel**: Carousel.
-   **date-fns**: Date utility.

### Form Validation & State
-   **Zod**: Runtime type validation.
-   **drizzle-zod**: Zod schema from Drizzle.
-   **React Hook Form**: Form management.
-   **TanStack Query**: Server state.

### AI & Content Generation
-   **Anthropic**: Claude Sonnet 4.5.
-   **Google AI**: Gemini 1.5 Flash, image generation models.
-   **Adobe Firefly**: Professional image generation.
-   **OpenRouter**: Unified AI gateway (DeepSeek R1, Llama 4, Qwen 3, Mistral).
-   **ElevenLabs**: Text-to-speech.
-   **Runway API**: Video, image, audio generation (various models for video, image, and ElevenLabs integrations for audio).
-   **Midjourney (via Replicate)**: Image generation.
-   **Alibaba Dashscope**: Image generation.

### Integrations
-   **Shotstack**: Video assembly, audio hosting, browser-based editing (SDK: `@shotstack/shotstack-studio`).
-   **Slack**: Webhook notifications.
-   **Buffer**: Social media publishing.

### Development Tools
-   **Vite**: Frontend build.
-   **TypeScript**: Language.
-   **esbuild**: Backend bundling.
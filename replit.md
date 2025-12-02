# Emerge Digital Control Tower

## Overview
The Emerge Digital Control Tower is an AI content factory designed to automate the generation of 40-60 client-ready content pieces daily. Its purpose is to provide an agency master dashboard for tracking business metrics, managing clients, and streamlining approval workflows. Key capabilities include multi-provider orchestration, dual video workflows (Veo 3 continuous and Runway+Shotstack parallel), WordPress publishing integration, and comprehensive quality assurance with self-learning mechanisms.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Three-Tier Runtime Architecture
The system employs a three-tier architecture:
-   **Frontend**: React + Vite for the user interface, utilizing TanStack Query, shadcn/ui, and Tailwind CSS.
-   **Backend**: Express + Drizzle for RESTful APIs and WebSockets, bundled with esbuild.
-   **Data/Orchestration**: PostgreSQL (Neon) for data storage via Drizzle ORM, and a Python Orchestrator (LangGraph) for content generation pipelines.

### Frontend Layer
-   **Technology**: React 18+ (TypeScript), Vite, shadcn/ui (Radix UI), Tailwind CSS v4.
-   **State Management**: TanStack Query for server state, React Hook Form with Zod for form validation.
-   **UI/UX**: Dark mode default, Inter font, collapsible sidebar navigation.
-   **Navigation Categories**: Content Production, Quality & Review, Brand Management, System.

### Backend Layer
-   **Technology**: Express.js (TypeScript, ESM mode).
-   **API**: RESTful, JSON format, Zod validation, centralized error handling.
-   **WebSocket**: Provides real-time video generation progress updates.

### Data Storage Layer
-   **Database**: PostgreSQL via Neon serverless driver.
-   **ORM**: Drizzle ORM for type-safe queries and migrations.
-   **Schema**: Over 40 tables managing KPIs, clients, content, video projects, quality metrics, and learning data.

### Content Generation Pipeline
The pipeline orchestrates the creation of various content types:
-   **Agents**: Topic Agent, Brand Brief, Dual-Path Router, Blog Agent, Social Agent, Ad Copy Agent, Video Script Agent, Image Generator.
-   **Content Types**: Blog Posts, Social Media posts, Ad Copy, Video Scripts, Images.
-   **QA Agent**: Performs brand compliance checks, forbidden words scans, quality scoring (1-10), and CTA alignment verification.
-   **Publishing Layer**: Integrates with WordPress GraphQL, Buffer (Social), and an Approval Queue.
-   **Content Status Lifecycle**: `draft → pending_review → approved → published` with `rejected` and `publish_failed` states.

### Dual Video Production System
The system supports two video production tracks:
1.  **Continuous Veo 3 Pipeline (Python-based)**: For high-quality cinematic video, utilizing Google Vertex AI Veo 3.1 with sequential processing, rate limiting, and retry logic.
2.  **Parallel Runway + Shotstack Pipeline (TypeScript-based)**: For high-volume bulk video, using Runway Gen4 Turbo/Aleph models for parallel scene generation and Shotstack for assembly.
-   **Route Selection**: A Dual-Path Router selects the appropriate track based on `quality_max`, `balanced`, or `efficiency_max` criteria, influenced by client tier, content priority, budget, deadlines, historical performance, and learning signals.

### AI Provider System
-   **Provider Health Monitor**: Real-time monitoring of AI provider success rates, latency, costs, and rate limits.
-   **Self-Healing Actions**: Automatic quarantine on hard failures, fallback chain activation, and recovery detection.
-   **Quarantine Patterns**: Specific error patterns (e.g., "access denied", "quota exceeded") trigger temporary quarantines for providers.

### Learning & Feedback System
-   **Central Learning Engine**: Implements continuous learning through feedback loops.
-   **Signal Types**: Tracks prompt effectiveness, brand patterns, failure patterns, and success patterns.
-   **Quality Feedback Sources**: QA Agent Review (automated scoring), User Ratings (manual feedback), and Automated Metrics (resolution, brand compliance).

### WordPress Publishing Integration
-   **Security Model**: Strict SSRF protection (blocking IP addresses, internal ranges, requiring HTTPS and GraphQL path).
-   **Publishing Flow**: Validates URLs, tests connections, authenticates, converts content to HTML, and creates posts via GraphQL mutation.

## External Dependencies

### AI & Generation
-   **Anthropic**: Claude Sonnet 4.5 (text)
-   **Google AI**: Gemini 1.5 Flash (text), Veo 2/3 (video), Imagen (image)
-   **Adobe Firefly**: Image generation
-   **OpenRouter**: DeepSeek R1, Llama 4, Qwen 3, Mistral (various models)
-   **ElevenLabs**: Text-to-speech
-   **Runway API**: Gen3/Gen4 (video, images, audio)
-   **Fal AI**: Flux Pro (images), Kling, MiniMax (video)
-   **Alibaba Dashscope**: Image generation

### Video Assembly
-   **Shotstack**: Timeline-based video assembly

### Publishing
-   **WordPress GraphQL**: Blog publishing
-   **Buffer**: Social media scheduling
-   **Slack**: Webhook notifications

### Infrastructure
-   **Neon**: Serverless PostgreSQL
-   **Drizzle ORM**: Type-safe database access
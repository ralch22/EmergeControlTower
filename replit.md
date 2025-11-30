# Emerge Digital Control Tower

## Overview

This is a full-stack web application built as an agency master dashboard for tracking business metrics, managing pods (business units), phase changes, approval workflows, and alerts. The application uses a modern React frontend with shadcn/ui components and an Express backend with PostgreSQL database accessed through Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build Tool**
- React 18+ with TypeScript for type safety
- Vite as the build tool and development server
- Wouter for client-side routing (lightweight alternative to React Router)

**UI Component System**
- shadcn/ui component library with Radix UI primitives
- Tailwind CSS v4 for styling with custom theme configuration
- Dark mode enabled by default (class="dark" in HTML)
- Inter font family from Google Fonts
- Alpine.js included for lightweight interactivity

**State Management**
- TanStack Query (React Query) for server state management
- React Hook Form with Zod resolvers for form validation
- No global client state management library (relies on React Query)

**Design Decisions**
- Chose Vite over Create React App for faster builds and better developer experience
- Used shadcn/ui for consistency and customization flexibility
- Implemented custom Vite plugins for development tooling (Replit-specific plugins for cartographer and dev banner)
- Custom meta images plugin to update OpenGraph images with correct Replit deployment URLs

### Backend Architecture

**Server Framework**
- Express.js with TypeScript running in ESM mode
- HTTP server creation via Node's built-in `http` module
- Custom logging middleware for request/response tracking

**API Design**
- RESTful API endpoints under `/api` prefix
- JSON request/response format
- Zod schema validation on all incoming data
- Centralized error handling with Zod validation errors

**Development vs Production**
- Development: Uses Vite middleware mode with HMR for hot module replacement
- Production: Serves pre-built static files from dist/public directory
- Separate build scripts that bundle server code with esbuild

**Build Strategy**
- Server bundled with esbuild to reduce cold start times (reduces openat syscalls)
- Allowlist of dependencies to bundle (Google AI, Neon, date-fns, Drizzle, etc.)
- All other dependencies marked as external

### Data Storage

**Database**
- PostgreSQL via Neon serverless driver
- WebSocket support for serverless connections
- Connection pooling with @neondatabase/serverless

**ORM & Migrations**
- Drizzle ORM for type-safe database queries
- Schema definitions in shared/schema.ts (accessible to both client and server)
- Drizzle Kit for schema migrations to migrations/ directory
- Schema includes: KPIs, Pods, Phase Changes, Approval Queue, Alerts

**Data Models**
- **KPIs**: Monthly recurring revenue, profit, AI output metrics, pod counts
- **Pods**: Business units with vertical, MRR, health score, and margin metrics
- **Phase Changes**: Price change tracking with client, old/new prices, and completion status
- **Approval Queue**: Items awaiting approval with type, description, and impact
- **Alerts**: System alerts with type, severity, message, and resolution status

**Storage Layer**
- Abstracted storage interface (IStorage) for future flexibility
- DatabaseStorage implementation using Drizzle queries
- Supports CRUD operations for all entities

### External Dependencies

**Database Provider**
- Neon PostgreSQL serverless database (required DATABASE_URL environment variable)
- Uses WebSocket connections for serverless compatibility

**UI Component Libraries**
- Radix UI primitives for accessible components (dialogs, dropdowns, etc.)
- Lucide React for icon system
- cmdk for command palette functionality
- Embla Carousel for carousel components
- date-fns for date formatting and manipulation

**Development Tools**
- Replit-specific plugins for development experience
- Custom Vite plugin for meta image URL updates
- TypeScript with strict mode enabled
- Path aliases for clean imports (@/, @shared/, @assets/)

**Session Management**
- connect-pg-simple for PostgreSQL session storage (imported but not configured in visible code)

**Form Validation**
- Zod for runtime type validation and schema definitions
- drizzle-zod for automatic Zod schema generation from Drizzle tables
- @hookform/resolvers for React Hook Form integration

**Styling Dependencies**
- Tailwind CSS with custom configuration
- class-variance-authority for component variant management
- clsx and tailwind-merge for className utilities

### Content Factory System

**AI Content Generation Pipeline (01-content-factory/)**
- Modular AI agent architecture for content generation
- LangGraph-style orchestrator for parallel content creation
- Anthropic Claude integration via Replit AI Integrations

**Agent Types**
- **Topic Agent**: Generates SEO-optimized content topics from client briefs
- **Blog Agent**: Creates long-form blog posts with headings and CTAs
- **Social Agent**: Generates LinkedIn, Twitter, and Instagram posts
- **Ad Copy Agent**: Creates Facebook and Google ad variations
- **Video Script Agent**: Generates video scripts with hooks and CTAs
- **QA Agent**: Reviews content for quality, brand voice, and guidelines

**Orchestrator (01-content-factory/orchestrator/)**
- ContentPipeline class for managing content generation runs
- Parallel execution of content generation across topics
- Progress callbacks for real-time dashboard updates
- Automatic KPI counter increments as content is generated

**Integrations**
- Slack notifications for content approval workflows
- Buffer auto-publishing for approved social content

**API Endpoints**
- `GET /api/clients` - List content factory clients
- `POST /api/clients` - Create new client
- `GET /api/content-runs` - List content generation runs
- `POST /api/content-factory/run` - Start content generation for a client
- `POST /api/content-factory/run-week` - Generate a week of content (7 topics, all types)

**Database Tables**
- `clients` - Client profiles with brand voice, audience, keywords, goals
- `content_runs` - Tracking for content generation runs
- `generated_content` - Storage for all generated content pieces

**Frontend Features**
- Client dropdown in dashboard header
- "Run Week" button with loading state
- Real-time AI Output counter updates
- Generated content appears in approval queue
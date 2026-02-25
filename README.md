OUTFIX - Project Plan
Project Overview

OUTFIX is a responsive Progressive Web Application (PWA) designed to digitize personal wardrobes and provide context-aware clothing suggestions. The system utilizes a Multi-Criteria Decision Making (MCDM) scoring model to recommend outfits based on local weather data, color harmony, visual pattern constraints, and historical usage patterns.

--Technology Stack
Frontend: SvelteKit (TypeScript), TailwindCSS
Backend: Supabase (PostgreSQL, Auth, Storage)
External APIs: Cloudinary (AI Vision for background removal) and Open-Meteo (Weather Data)

Development Roadmap (Spring 2026)
--Phase 1: Foundation & Security
Week 1 (Feb 26 – Mar 1): Architectural Design Sprint
Project initialization and Supabase relational schema v1 implementation.

Week 2 (Mar 2 – Mar 8): Authentication & Security Layer
Supabase Auth integration and RLS policy enforcement.

Week 3 (Mar 9 – Mar 15): Wardrobe Core (CRUD)
Implementation of Item entities and availability state management.

--Phase 2: Intelligence & Media

Week 4 (Mar 16 – Mar 22): Smart Upload System
Cloudinary integration for background removal and ColorThief for HEX detection.

Week 5 (Mar 23 – Mar 29): Outfit Builder Module
Relational outfit creation using JSONB item linking and preview interfaces.

Week 6 (Mar 30 – Apr 5): Suggestion Engine – Filtration
Implementation of rule-based filters: Seasonal, pattern, and availability.

Week 7 (Apr 6 – Apr 12): Suggestion Engine – Scoring
Coding HSL distance logic and weather relevance (Open-Meteo API).

--Phase 3: Planning & Lifecycle
Week 8 (Apr 13 – Apr 19): Calendar Module
Interactive weekly/monthly interface for manual outfit assignment.

Week 9 (Apr 20 – Apr 26): Laundry Cycle System
Automated "Mark as Worn" logic and status transition triggers.

Week 10 (Apr 27 – May 3): Statistics & Export
Usage analytics dashboard and CSV/Excel data export functionality.

--Phase 4: QA & Finalization

Week 11 (May 4 – May 10): Testing & Optimization
E2E validation and Google Lighthouse performance audits.

Week 12 (May 11 – May 17): MVP Finalization
UI refinement, bug resolution, and final production staging on Vercel.
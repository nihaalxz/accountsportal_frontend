# Phase 1 Frontend Architecture

This document defines the architectural principles and folder structure for the Texas Accounts Portal frontend.

## Directory Structure

```
src/
├── lib/
│   ├── api/             # Typed API client, refresh mechanism, ProblemDetails mapper
│   ├── auth/            # Cookie helpers and session bootstrap controls
│   ├── components/      # Shared presentation components (Skeleton, Spinner, Empty, Error states)
│   ├── components/ui/   # shadcn-svelte UI primitives (buttons, dialogs, inputs)
│   ├── config/          # Centralized environment configuration
│   ├── layout/          # App Shell layout (Sidebar, Header, Bottom Navigation, Overflow Drawer)
│   ├── stores/          # Svelte stores tracking auth context and navigation definitions
│   ├── types/           # Request and response contract DTO types
│   ├── utils/           # Money/Date formatting and UI helpers
│   └── theme/           # Yellow design tokens and css configurations (tokens.css)
├── routes/
│   ├── (public)/        # Public layouts and pages (Login route)
│   ├── (app)/           # Protected workspace routes (Dashboard, admin, shell wrappers)
│   ├── +layout.svelte   # Root SvelteKit layout (handles theme class injection)
│   └── +page.svelte     # Base index page (redirects to Login or Dashboard)
```

## Architecture Boundary Principles

1. **Server vs Client Boundaries**:
    - SSR (Server Side Rendering) is enabled by default to speed up initial loads and optimize SEO.
    - Browser-specific objects (`window`, `document`, `localStorage`, `document.cookie`) must always be wrapped in Svelte's `browser` environment checks to prevent rendering mismatch.

2. **API Isolation**:
    - Component views must never call `fetch` or connect to URLs directly. All service interactions flow through the central `apiFetch` client in `$lib/api/api-client`.

3. **State Management**:
    - The central authentication context is owned by Svelte stores (`$lib/stores/auth`), which serves as the source of truth for logged-in states, token lifecycles, and role-based permissions.

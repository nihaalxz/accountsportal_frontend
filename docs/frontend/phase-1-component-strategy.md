# Phase 1 Component Strategy

This document establishes development guidelines for components, layouts, and page structures.

## Component Categories

1. **Primitive UI Components (`$lib/components/ui/`)**:
    - Installed using `shadcn-svelte` (based on `bits-ui` and Tailwind v4).
    - Designed to be headless, styled using custom theme tokens, and completely reusable. Examples: Button, Input, Dropdown.

2. **Common Presentation Components (`$lib/components/`)**:
    - Shared business-agnostic layouts such as status badges, money formatters, skeletons, empty states, and modal dialog controllers.

3. **Layout Wrappers (`$lib/layout/`)**:
    - Navigation panels, app headers, and shell elements that wrap the protected routes.

4. **Page Routes (`src/routes/`)**:
    - Route files (`+page.svelte`, `+layout.svelte`) orchestrating page states, form actions, and data-fetching triggers.

## Standards

- **Mobile First**: All layouts must start from mobile viewports (e.g. iPhone-sized cards and fixed bottom navigation bars) and scale up using standard responsive breakpoint modifiers (e.g. `lg:`, `xl:` styles).
- **Visible Focus States**: Active focus targets must be clearly highlighted.
- **Semantic HTML**: Standard landmarks (`<main>`, `<nav>`, `<aside>`, `<header>`) are required on all shell elements.

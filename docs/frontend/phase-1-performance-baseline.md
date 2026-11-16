# Phase 1 Performance Baseline

This document governs client loading thresholds, bundle size optimization, and Svelte rendering limits.

## Performance Metrics

1. **Initial Bundle Payload**:
    - The compiled JavaScript vendor chunk must stay under **150kb** (gzipped) for initial boot efficiency.
    - Code splitting is automatically enforced by SvelteKit's file-system router.

2. **SSR vs CSR Render Rules**:
    - Authentication and secure layout groups (`(app)`) bypass SSR rendering checks where browser-specific document states (like cookies or local stores) are requested.
    - Initial loading states use CSS-only placeholders to minimize First Contentful Paint (FCP) delays.

3. **Core Targets**:
    - **First Contentful Paint (FCP)**: < 1.2 seconds on standard desktop profiles.
    - **Time to Interactive (TTI)**: < 1.8 seconds.
    - **Largest Contentful Paint (LCP)**: < 2.0 seconds.

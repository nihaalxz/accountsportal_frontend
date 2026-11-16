# Phase 4 Bundle Delta

This document estimates the bundle footprint changes added by the implementation of Phase 4.

---

## 1. Bundle Footprint Changes

### JavaScript Modules
- **New Feature APIs**: `src/features/staff/api.ts`, `src/features/payroll/api.ts`, `src/features/suppliers/api.ts` add minimal size to the centralized JS footprint.
- **Routing Pages**: New compiled Svelte routes compile to static/dynamic bundles (average of 8KB per route view).

### Assets & Styling
- **Asset footprint**: No heavy third-party CSS files or libraries were added. Standard Tailwind CSS utility generation handles styles.
- **Icon Assets**: Imported from `lucide-svelte` tree-shaken library to prevent importing unused icons.

---

## 2. Recommendations
- **Lazy Loading**: If dashboards grow, sub-routes should be dynamically loaded to optimize initial bundle sizes.

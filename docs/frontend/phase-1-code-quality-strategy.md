# Phase 1 Code Quality Strategy

This document establishes coding standards, linting directives, type strictness, and automated checks.

## TypeScript Strictness

We enforce highly strict compiler options to verify correctness on build:

- `strict: true`: Enables all strict type-checking options.
- `noUncheckedIndexedAccess: true`: Forces array and map lookups to account for undefined values.
- `exactOptionalPropertyTypes: true`: Restricts mapping properties to exact types without permitting implicit undefined assignments.
- `noImplicitOverride: true`: Requires explicit overrides on inherited sub-class functions.

## Linting & Formatting Rules

- **ESLint**: Custom flat configuration utilizing Svelte and TypeScript plugins.
- **Prettier**: Tabs-based formatting, single quotes, print width of 100, utilizing `prettier-plugin-svelte` for clean HTML/logic splitting.

## Verification Scripts

- Check: `npm run check` (calls `svelte-check`)
- Lint: `npm run lint` (runs `eslint .`)
- Format: `npm run format` (runs `prettier --write`)
- Format Check: `npm run format:check` (runs `prettier --check`)

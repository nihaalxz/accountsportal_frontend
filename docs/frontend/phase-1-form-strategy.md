# Phase 1 Form Strategy

This document governs form layout rules, field validation, and error feedback mapping.

## Strategy & Principles

1. **Validation Engine**:
    - Leverage standard HTML5 attributes combined with Svelte state variables and regex helpers for light forms.
    - For complex forms (such as transaction creation), integrate typed schema validators (like Zod or Superforms) to verify inputs before submission.

2. **Server Validation Mapping**:
    - In case of a validation response (`ValidationError` / 400 Bad Request), the client maps the RFC-7807 dictionary list (`errors` block keys) directly to specific fields.
    - Example: A backend error key `"SupplierId"` is mapped to the input field `id="supplierId"` and displays the error message directly under the input wrapper.

3. **User Action Locks**:
    - Form buttons must transition to a loading state and disable submit actions during active HTTP requests.
    - Disabling inputs protects endpoints from concurrent click duplicates.

4. **Dirty-State Warnings**:
    - Complex mutative forms track initial values.
    - If a user triggers route navigation when fields contain unsaved modifications, SvelteKit's navigation hooks warn the user to confirm exit.

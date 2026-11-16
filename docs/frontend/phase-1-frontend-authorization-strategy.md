# Phase 1 Frontend Authorization Strategy

This document details role checks, policy mapping, and layout rendering rules.

## Core Rules

1. **Frontend Authorization is for UX Only**:
    - Disabling buttons, hiding menu links, or redirecting route paths on the client side only improves user experience.
    - All security enforcement remains authoritative on the backend API side.

2. **Unified Navigation Filtering**:
    - The navigation store (`$lib/stores/navigation.ts`) parses the active user's role.
    - If a menu link requires `master_accountant` role clearance and the active user is `Accounts`, the link is removed from the visible Sidebar and mobile Overflow Sheet reactively.

3. **Check Helpers**:
    - `hasRole('master_accountant')`: Resolves permissions for administrators.
    - `hasPermission('all')`: Evaluates to true for administrators.
    - `hasPermission('feature_permission')`: Restricts operations to specific accounting modules.

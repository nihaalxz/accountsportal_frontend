# Phase 1 Auth State Machine

This document defines the states, events, and transitions of the Svelte authentication store.

```mermaid
stateDiagram-v2
    [*] --> Initializing : Application Mount
    Initializing --> Authenticated : Token rotation succeeds & profile resolved
    Initializing --> Unauthenticated : No token cookie or API 401 response
    Unauthenticated --> Authenticating : User clicks Submit on login form
    Authenticating --> Authenticated : Login POST returns valid DTO tokens
    Authenticating --> Unauthenticated : Credentials fail / 401 returned
    Authenticated --> TokenRefreshing : Access token expires / 401 intercepted
    TokenRefreshing --> Authenticated : /refresh rotation succeeded
    TokenRefreshing --> Unauthenticated : /refresh rotation failed (session clears)
    Authenticated --> Unauthenticated : User clicks Logout / server logs out
```

## State Mappings

- **Initializing (`isInitializing: true`)**:
    - The application is restoring the session. A loading shell / splash screen is rendered. Protected page views are blocked during this state to prevent content flashing.
- **Authenticated (`isAuthenticated: true`, `user !== null`)**:
    - The user has a valid access token. User profile properties (`name`, `email`, `userType`, `permissions`) are loaded into the store. Sidebar modules are active.
- **Unauthenticated (`isAuthenticated: false`, `user === null`)**:
    - No active tokens. The SvelteKit layout redirects the user to the `/login` page.
- **SessionError (`sessionError !== null`)**:
    - Used to flag login form failures or display diagnostic notices (such as account deactivations).

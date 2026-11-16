# Authentication Contract

This document details the authentication interface exposed by the `AuthController`.

## Endpoint Details

### 1. User Login

- **Route**: `POST /api/auth/login`
- **Authentication**: `AllowAnonymous`
- **Request Body (JSON)**:
    ```typescript
    interface LoginRequest {
    	email: string; // Required, non-empty
    	password: string; // Required, non-empty
    }
    ```
- **Response Headers**:
    - `Content-Type: application/json`
- **Success Response (200 OK)**:
    ```typescript
    interface LoginResponse {
    	accessToken: string;
    	refreshToken: string;
    	userType: string;
    	name: string;
    	email: string;
    	portalPermissions: string[];
    }
    ```
- **Error Responses**:
    - `400 Bad Request`: Email or password is blank.
    - `401 Unauthorized`: Invalid credentials.
    - `403 Forbidden`: User account is deactivated (`IsActive == false`).

---

### 2. Session Refresh

- **Route**: `POST /api/auth/refresh`
- **Authentication**: `AllowAnonymous`
- **Request Body (JSON)**:
    ```typescript
    interface RefreshTokenRequest {
    	refreshToken: string; // Required, non-empty
    }
    ```
- **Success Response (200 OK)**:
    ```typescript
    interface RefreshTokenResponse {
    	accessToken: string;
    	refreshToken: string;
    }
    ```
- **Error Responses**:
    - `400 Bad Request`: Refresh token is empty.
    - `401 Unauthorized`: Token is invalid, expired, or has been revoked (triggers automatic user logout).

---

### 3. User Logout

- **Route**: `POST /api/auth/logout`
- **Authentication**: `AllowAnonymous`
- **Request Body (JSON)**:
    ```typescript
    interface RefreshTokenRequest {
    	refreshToken: string;
    }
    ```
- **Success Response (200 OK)**:
    ```json
    {
    	"message": "Logged out successfully."
    }
    ```

---

### 4. Fetch Profile context

- **Route**: `GET /api/auth/me`
- **Authentication**: Bearer JWT token required in headers (`Authorization: Bearer <accessToken>`).
- **Success Response (200 OK)**:
    ```typescript
    interface UserProfileResponse {
    	id: number;
    	name: string;
    	email: string;
    	userType: string;
    	portalPermissions: string[];
    	isActive: boolean;
    }
    ```
- **Error Responses**:
    - `401 Unauthorized`: Missing or invalid bearer token.
    - `404 Not Found`: User profile not found in database.

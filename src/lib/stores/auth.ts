import { writable, derived, get } from 'svelte/store';
import { apiFetch, setAccessToken, clearAccessToken } from '$lib/api/api-client';
import { attemptRefresh } from '$lib/api/refresh';
import { deleteCookie, setCookie } from '$lib/auth/cookies';
import { REF_TOKEN_COOKIE_NAME } from '$lib/config';
import type { SessionUser, LoginResponse, UserProfileResponse } from '$lib/types/auth';

// ---------------------------------------------------------------------------
// Store State Interface
// ---------------------------------------------------------------------------
interface AuthState {
	user: SessionUser | null;
	isAuthenticated: boolean;
	isInitializing: boolean;
	sessionError: string | null;
}

const _auth = writable<AuthState>({
	user: null,
	isAuthenticated: false,
	isInitializing: true,
	sessionError: null
});

// Readonly public subscriptions
export const authState = { subscribe: _auth.subscribe };
export const currentUser = derived(_auth, ($a) => $a.user);
export const isAuthenticated = derived(_auth, ($a) => $a.isAuthenticated);
export const isInitializing = derived(_auth, ($a) => $a.isInitializing);

// ---------------------------------------------------------------------------
// RBAC / Authorization Helpers
// ---------------------------------------------------------------------------

/**
 * Checks if the current user has the specified permission.
 * Master Accountants automatically have all permissions (indicated by 'all' or role override).
 */
export function hasPermission(permission: string): boolean {
	const state = get(_auth);
	if (!state.user) return false;

	const role = state.user.userType.toLowerCase();
	if (role === 'master_accountant' || role === 'master accountant') {
		return true; // Super admin bypass
	}

	// Check explicit permissions list
	return state.user.permissions.includes('all') || state.user.permissions.includes(permission);
}

/**
 * Checks if the current user possesses at least one of the listed permissions.
 */
export function hasAnyPermission(...permissions: string[]): boolean {
	return permissions.some((p) => hasPermission(p));
}

/**
 * Checks if the current user matches the specified role name (case-insensitive).
 */
export function hasRole(role: string): boolean {
	const state = get(_auth);
	if (!state.user) return false;

	const normalizedRole = role.toLowerCase().replace(/\s+/g, '_');
	const userRole = state.user.userType.toLowerCase().replace(/\s+/g, '_');

	// Normal Accountant matching (strictly normal accountants, excluding master_accountant)
	if (normalizedRole === 'normal_accountant') {
		return (
			userRole === 'accounts' ||
			userRole === 'accountant' ||
			userRole === 'normal_accountant'
		);
	}

	// General Accountant matching (includes accountant, normal_accountant, accounts, master_accountant)
	if (normalizedRole === 'accounts' || normalizedRole === 'accountant') {
		return (
			userRole === 'accounts' ||
			userRole === 'accountant' ||
			userRole === 'normal_accountant' ||
			userRole === 'master_accountant'
		);
	}

	return userRole === normalizedRole;
}

/**
 * Checks if the current user is a normal accountant (excluding master_accountant).
 */
export function isNormalAccountant(): boolean {
	return hasRole('normal_accountant');
}

// ---------------------------------------------------------------------------
// Lifecycle Actions
// ---------------------------------------------------------------------------

/**
 * Bootstraps the session on application initial mount.
 * Attempts token rotation using the secure cookie. If successful, fetches profile.
 */
export async function bootstrapSession(): Promise<void> {
	_auth.update((s) => ({ ...s, isInitializing: true, sessionError: null }));

	try {
		const token = await attemptRefresh();
		if (!token) {
			_auth.set({
				user: null,
				isAuthenticated: false,
				isInitializing: false,
				sessionError: null
			});
			return;
		}

		// Call GET /api/auth/me to populate user permissions and attributes
		const me = await apiFetch<UserProfileResponse>('/api/auth/me');

		_auth.set({
			user: {
				id: me.id,
				name: me.name,
				email: me.email,
				userType: me.userType,
				permissions: me.portalPermissions,
				profilePicture: me.profilePicture
			},
			isAuthenticated: true,
			isInitializing: false,
			sessionError: null
		});
	} catch (err: unknown) {
		clearAccessToken();
		deleteCookie(REF_TOKEN_COOKIE_NAME);

		const message = err instanceof Error ? err.message : 'Session restoration failed.';
		_auth.set({
			user: null,
			isAuthenticated: false,
			isInitializing: false,
			sessionError: message
		});
	}
}

/**
 * Logs in the user with email and password.
 * Stores access token in-memory and sets refresh token in secure SameSite cookie.
 */
export async function login(email: string, password: string): Promise<void> {
	_auth.update((s) => ({ ...s, sessionError: null }));

	const res = await apiFetch<LoginResponse>('/api/auth/login', {
		method: 'POST',
		body: JSON.stringify({ email, password }),
		skipRefresh: true
	});

	setAccessToken(res.accessToken);

	// Store refresh token in secure SameSite=Strict cookie for 7 days
	const expires = new Date();
	expires.setDate(expires.getDate() + 7);
	setCookie(REF_TOKEN_COOKIE_NAME, res.refreshToken, { expires, sameSite: 'strict' });

	_auth.set({
		user: {
			id: (res as any).id,
			name: res.name,
			email: res.email,
			userType: res.userType,
			permissions: res.portalPermissions,
			profilePicture: res.profilePicture
		},
		isAuthenticated: true,
		isInitializing: false,
		sessionError: null
	});
}

/**
 * Logs out the user by revoking the refresh token server-side and clearing client state.
 */
export async function logout(): Promise<void> {
	try {
		const token = attemptRefresh(); // Best-effort retrieval to invalidate on server
		await apiFetch('/api/auth/logout', {
			method: 'POST',
			body: JSON.stringify({ refreshToken: token }),
			skipRefresh: true
		});
	} catch {
		// Suppress logout network errors to ensure local session is cleared regardless
	} finally {
		clearSession();
	}
}

/**
 * Clears in-memory session and cookies immediately.
 */
export function clearSession(): void {
	clearAccessToken();
	deleteCookie(REF_TOKEN_COOKIE_NAME);
	_auth.set({
		user: null,
		isAuthenticated: false,
		isInitializing: false,
		sessionError: null
	});
}

/**
 * Updates the profile picture of the current user locally.
 */
export function updateCurrentUserProfile(profilePicture?: string): void {
	_auth.update((s) => {
		if (s.user) {
			return {
				...s,
				user: {
					...s.user,
					profilePicture: profilePicture !== undefined ? profilePicture : s.user.profilePicture
				}
			};
		}
		return s;
	});
}

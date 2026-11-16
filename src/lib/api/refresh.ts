import { apiFetch, setAccessToken } from './api-client';
import { getCookie, setCookie, deleteCookie } from '$lib/auth/cookies';
import { REF_TOKEN_COOKIE_NAME } from '$lib/config';

/**
 * Attempts a token refresh via POST /api/auth/refresh.
 * Returns the new access token on success, or null on failure.
 * Automatically rotates the refresh token stored in the secure SameSite cookie.
 */
export async function attemptRefresh(): Promise<string | null> {
	const refreshToken = getCookie(REF_TOKEN_COOKIE_NAME);
	if (!refreshToken) {
		return null;
	}

	try {
		const res = await apiFetch<{ accessToken: string; refreshToken: string }>(
			'/api/auth/refresh',
			{
				method: 'POST',
				body: JSON.stringify({ refreshToken }),
				skipRefresh: true
			}
		);

		if (res?.accessToken && res?.refreshToken) {
			setAccessToken(res.accessToken);
			// Store the rotated refresh token in the secure SameSite cookie (valid for 7 days)
			const expires = new Date();
			expires.setDate(expires.getDate() + 7);
			setCookie(REF_TOKEN_COOKIE_NAME, res.refreshToken, { expires, sameSite: 'strict' });
			return res.accessToken;
		}

		// Refresh failed or payload was invalid — clear context
		deleteCookie(REF_TOKEN_COOKIE_NAME);
		setAccessToken(null);
		return null;
	} catch {
		deleteCookie(REF_TOKEN_COOKIE_NAME);
		setAccessToken(null);
		return null;
	}
}

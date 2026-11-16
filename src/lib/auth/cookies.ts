import { browser } from '$app/environment';

/**
 * Reads a cookie value by name. Returns null if not in browser or not found.
 */
export function getCookie(name: string): string | null {
	if (!browser) return null;
	const nameEQ = encodeURIComponent(name) + '=';
	const ca = document.cookie.split(';');
	for (let i = 0; i < ca.length; i++) {
		let c = ca[i];
		if (c === undefined) continue;
		while (c.charAt(0) === ' ') c = c.substring(1, c.length);
		if (c.indexOf(nameEQ) === 0) {
			return decodeURIComponent(c.substring(nameEQ.length, c.length));
		}
	}
	return null;
}

/**
 * Sets a client-side cookie. Forces SameSite=Strict and Secure by default.
 */
export function setCookie(
	name: string,
	value: string,
	options: {
		expires?: Date | string;
		maxAge?: number;
		path?: string;
		sameSite?: 'strict' | 'lax' | 'none';
	} = {}
): void {
	if (!browser) return;

	const path = options.path ?? '/';
	const sameSite = options.sameSite ?? 'strict';

	let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=${path}; samesite=${sameSite}; secure`;

	if (options.expires) {
		const expiresStr =
			options.expires instanceof Date ? options.expires.toUTCString() : options.expires;
		cookieString += `; expires=${expiresStr}`;
	}

	if (options.maxAge !== undefined) {
		cookieString += `; max-age=${options.maxAge}`;
	}

	document.cookie = cookieString;
}

/**
 * Removes a cookie by setting its expiration to the past.
 */
export function deleteCookie(name: string, path = '/'): void {
	if (!browser) return;
	setCookie(name, '', { expires: 'Thu, 01 Jan 1970 00:00:00 GMT', maxAge: -1, path });
}

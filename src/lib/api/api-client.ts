import { BACKEND_API_URL, SALES_PORTAL_API_URL } from '$lib/config';

import { parseProblemDetails, NetworkError, AuthenticationError } from './problem-details';
import type { ApiError } from './problem-details';

// ---------------------------------------------------------------------------
// In-memory access token storage (never persisted to storage for XSS security)
// ---------------------------------------------------------------------------
let _accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
	_accessToken = token;
}

export function getAccessToken(): string | null {
	return _accessToken;
}

export function clearAccessToken(): void {
	_accessToken = null;
}

const _getCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL_MS = 5000; // 5 seconds cache TTL

// ---------------------------------------------------------------------------
// Concurrent 401-refresh lock to prevent storming the backend
// ---------------------------------------------------------------------------
let _refreshPromise: Promise<string | null> | null = null;

export function setRefreshPromise(p: Promise<string | null> | null): void {
	_refreshPromise = p;
}

export function getRefreshPromise(): Promise<string | null> | null {
	return _refreshPromise;
}

// ---------------------------------------------------------------------------
// Request Options Schema
// ---------------------------------------------------------------------------
export interface RequestOptions extends RequestInit {
	baseUrl?: string;
	params?: Record<string, string | number | boolean | null | undefined>;
	/** Explicitly override the authorization token (skips in-memory lookup) */
	token?: string;
	/** Skip the automatic 401 refresh mechanism (used by the refresh caller itself) */
	skipRefresh?: boolean;
	/** Idempotency key for financial write safety */
	idempotencyKey?: string;
	/** Timeout value in milliseconds */
	timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Core fetch implementation
// ---------------------------------------------------------------------------
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
	const {
		baseUrl = BACKEND_API_URL,
		params,
		token,
		skipRefresh = false,
		idempotencyKey,
		timeoutMs = 15000, // 15 seconds default timeout
		headers,
		signal,
		...rest
	} = options;

	const method = (rest.method || 'GET').toUpperCase();
	const cacheKey = `${method}:${path}:${JSON.stringify(params || {})}`;

	if (method === 'GET') {
		const cached = _getCache[cacheKey];
		if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
			return cached.data as T;
		}
	}

	const doFetch = async (tok: string | null): Promise<Response> => {
		const url = new URL(
			path.startsWith('/') ? path.slice(1) : path,
			baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
		);

		// Serialize query parameters
		if (params) {
			Object.entries(params).forEach(([key, val]) => {
				if (val !== undefined && val !== null) {
					url.searchParams.append(key, String(val));
				}
			});
		}

		const requestHeaders = new Headers(headers);
		if (!requestHeaders.has('Accept')) requestHeaders.set('Accept', 'application/json');
		if (!requestHeaders.has('Content-Type') && rest.body && !(rest.body instanceof FormData)) {
			requestHeaders.set('Content-Type', 'application/json');
		}

		// Set authorization header
		const activeToken = tok ?? getAccessToken();
		if (activeToken) {
			requestHeaders.set('Authorization', `Bearer ${activeToken}`);
		}

		// Set idempotency key
		if (idempotencyKey) {
			requestHeaders.set('Idempotency-Key', idempotencyKey);
		}

		// Correlation ID tracing
		const correlationId =
			typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: Math.random().toString(36).substring(2);
		requestHeaders.set('X-Correlation-ID', correlationId);

		// Timeout signal handling
		let timeoutId: number | undefined;
		let fetchSignal = signal;

		if (!signal && timeoutMs > 0) {
			const controller = new AbortController();
			timeoutId = setTimeout(() => controller.abort(), timeoutMs) as unknown as number;
			fetchSignal = controller.signal;
		}

		try {
			const response = await fetch(url.toString(), {
				headers: requestHeaders,
				signal: fetchSignal,
				...rest
			});
			return response;
		} finally {
			if (timeoutId !== undefined) {
				clearTimeout(timeoutId);
			}
		}
	};

	// -------------------------------------------------------------------------
	// Execute request and capture failures
	// -------------------------------------------------------------------------
	let response: Response;
	try {
		response = await doFetch(token ?? null);
	} catch (err: unknown) {
		if (err instanceof Error && err.name === 'AbortError') {
			if (signal?.aborted) {
				throw err;
			}
			throw new Error('Request timed out or cancelled.', { cause: err });
		}
		throw new NetworkError(undefined, { cause: err });
	}

	// Handle 401 and execute silent token refresh rotation
	if (response.status === 401 && !skipRefresh) {
		if (!_refreshPromise) {
			const { attemptRefresh } = await import('./refresh');
			_refreshPromise = attemptRefresh().finally(() => {
				_refreshPromise = null;
			});
		}

		const newToken = await _refreshPromise;
		if (!newToken) {
			// Clear token states and force session error
			const { clearSession } = await import('$lib/stores/auth');
			clearSession();
			throw new AuthenticationError('Your session has expired. Please log in again.');
		}

		// Retry the original request with the renewed token
		try {
			response = await doFetch(newToken);
		} catch (err: unknown) {
			if (err instanceof Error && err.name === 'AbortError') {
				if (signal?.aborted) {
					throw err;
				}
				throw new Error('Request timed out or cancelled.', { cause: err });
			}
			throw new NetworkError(undefined, { cause: err });
		}
	}

	// 204 No Content
	if (response.status === 204) {
		return null as unknown as T;
	}

	const contentType = response.headers.get('content-type') || '';
	const isJson = contentType.includes('application/json');

	if (!response.ok) {
		let errorBody: unknown = null;
		if (isJson) {
			try {
				errorBody = await response.json();
			} catch {
				/* ignore */
			}
		}
		throw parseProblemDetails(response.status, errorBody);
	}

	const dataPromise = (isJson ? response.json() : response.text()) as Promise<T>;
	return dataPromise.then((data) => {
		if (method === 'GET') {
			_getCache[cacheKey] = { data, timestamp: Date.now() };
		} else {
			for (const k in _getCache) {
				delete _getCache[k];
			}
		}
		return data;
	});
}

export async function apiFetchBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
	const salesBaseUrl = SALES_PORTAL_API_URL || 'http://localhost:5003';
	const { baseUrl = salesBaseUrl, params, token, headers, ...rest } = options;

	const url = new URL(path.startsWith('/') ? path.slice(1) : path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
	if (params) {
		Object.entries(params).forEach(([key, val]) => {
			if (val !== undefined && val !== null) {
				url.searchParams.append(key, String(val));
			}
		});
	}
	const requestHeaders = new Headers(headers);
	const activeToken = token ?? getAccessToken();
	if (activeToken) requestHeaders.set('Authorization', `Bearer ${activeToken}`);
	const response = await fetch(url.toString(), {
		headers: requestHeaders,
		credentials: 'include',
		...rest
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch PDF: ${response.statusText}`);
	}
	return response.blob();
}


// Re-export error types for unified consumption
export type { ApiError };
export {
	ValidationError,
	AuthenticationError,
	AuthorizationError,
	NotFoundError,
	ConflictError,
	ConcurrencyConflictError,
	RateLimitError,
	DownstreamUnavailableError,
	TimeoutError,
	NetworkError,
	UnknownApiError
} from './problem-details';

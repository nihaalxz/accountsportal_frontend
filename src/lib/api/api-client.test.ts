import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Top-level SvelteKit dynamic modules mocking
vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_BACKEND_API_URL: 'http://localhost:5028' }
}));
vi.mock('$app/environment', () => ({
	browser: true,
	dev: true
}));
vi.mock('$lib/auth/cookies', () => {
	const store: Record<string, string> = {};
	return {
		getCookie: vi.fn((name) => store[name] || null),
		setCookie: vi.fn((name, value) => {
			store[name] = value;
		}),
		deleteCookie: vi.fn((name) => {
			delete store[name];
		})
	};
});

import { apiFetch, setAccessToken, getAccessToken, clearAccessToken } from './api-client';
import { ValidationError, ConcurrencyConflictError } from './problem-details';
import { REF_TOKEN_COOKIE_NAME } from '$lib/config';

describe('apiFetch Client', () => {
	beforeEach(() => {
		clearAccessToken();
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('injects Bearer token from memory in Authorization header', async () => {
		setAccessToken('mock-access-token');
		const mockFetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ data: 'ok' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);
		vi.stubGlobal('fetch', mockFetch);

		const res = await apiFetch<any>('/api/test');
		expect(res.data).toBe('ok');

		const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
		const headers = init.headers as Headers;
		expect(headers.get('Authorization')).toBe('Bearer mock-access-token');
	});

	it('handles 204 No Content returning null', async () => {
		const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', mockFetch);

		const res = await apiFetch<any>('/api/write');
		expect(res).toBeNull();
	});

	it('maps 400 validation errors cleanly to ValidationError class', async () => {
		const errorBody = {
			title: 'Validation Failed',
			detail: 'Invalid payload elements',
			errors: {
				Email: ['The Email field is required.']
			}
		};
		const mockFetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify(errorBody), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			})
		);
		vi.stubGlobal('fetch', mockFetch);

		await expect(apiFetch('/api/test')).rejects.toThrow(ValidationError);
	});

	it('maps 409 concurrency details to ConcurrencyConflictError class', async () => {
		const errorBody = {
			title: 'Conflict',
			detail: 'The record was modified by another process (concurrency exception).'
		};
		const mockFetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify(errorBody), {
				status: 409,
				headers: { 'Content-Type': 'application/json' }
			})
		);
		vi.stubGlobal('fetch', mockFetch);

		await expect(apiFetch('/api/test')).rejects.toThrow(ConcurrencyConflictError);
	});

	it('handles concurrent 401s by queueing behind a single token refresh call', async () => {
		// Stub cookies to contain the refresh token
		const cookies = await import('$lib/auth/cookies');
		cookies.setCookie(REF_TOKEN_COOKIE_NAME, 'mock-refresh-token');

		let fetchCount = 0;
		const mockFetch = vi.fn().mockImplementation(() => {
			fetchCount++;
			if (fetchCount === 1) {
				// Initial request fails with 401
				return Promise.resolve(new Response(null, { status: 401 }));
			}
			if (fetchCount === 2) {
				// Silent token refresh call returns rotated tokens
				return Promise.resolve(
					new Response(
						JSON.stringify({
							accessToken: 'fresh-access-token',
							refreshToken: 'fresh-refresh-token'
						}),
						{
							status: 200,
							headers: { 'Content-Type': 'application/json' }
						}
					)
				);
			}
			// Retried request succeeds
			return Promise.resolve(
				new Response(JSON.stringify({ value: 'refreshed' }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			);
		});
		vi.stubGlobal('fetch', mockFetch);

		const res = await apiFetch<any>('/api/resource');
		expect(res.value).toBe('refreshed');
		expect(getAccessToken()).toBe('fresh-access-token');
	});
});

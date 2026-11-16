import { dev } from '$app/environment';
import { env as publicEnv } from '$env/dynamic/public';

const devBackendDefault = 'http://localhost:5028';
const devSalesDefault = 'http://localhost:5003';
const devOperationalDefault = 'http://localhost:5005';

/**
 * Resolves the backend API base URL from the public environment.
 * In dev mode, defaults to http://localhost:5028.
 * In production mode, defaults to https://accountstexas.runasp.net unless overridden.
 */
function getBackendUrl(): string {
	const url = publicEnv.PUBLIC_BACKEND_API_URL;

	if (!url) {
		return dev ? devBackendDefault : 'https://accountstexas.runasp.net';
	}

	try {
		const parsed = new URL(url);
		if (!parsed.protocol.startsWith('http')) {
			throw new Error('PUBLIC_BACKEND_API_URL must use HTTP or HTTPS protocol.');
		}
	} catch (err: unknown) {
		const detail = err instanceof Error ? err.message : String(err);
		throw new Error(
			`Invalid PUBLIC_BACKEND_API_URL configuration value: "${url}". Detail: ${detail}`,
			{
				cause: err
			}
		);
	}

	return url;
}

export const BACKEND_API_URL = getBackendUrl();
export const IS_DEV = dev;
export const REF_TOKEN_COOKIE_NAME = 'accounts_refresh_token';

function getSalesPortalUrl(): string {
	const url = publicEnv.PUBLIC_SALES_PORTAL_API_URL;

	if (!url) {
		return dev ? devSalesDefault : 'https://salestexas.runasp.net';
	}

	try {
		const parsed = new URL(url);
		if (!parsed.protocol.startsWith('http')) {
			throw new Error('PUBLIC_SALES_PORTAL_API_URL must use HTTP or HTTPS protocol.');
		}
	} catch (err: unknown) {
		const detail = err instanceof Error ? err.message : String(err);
		throw new Error(
			`Invalid PUBLIC_SALES_PORTAL_API_URL configuration value: "${url}". Detail: ${detail}`,
			{
				cause: err
			}
		);
	}

	return url;
}

export const SALES_PORTAL_API_URL = getSalesPortalUrl();

function getSignalRHubUrl(): string {
	const url = publicEnv.PUBLIC_SIGNALR_URL || publicEnv.PUBLIC_SALES_PORTAL_API_URL;
	if (url) {
		const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
		return `${baseUrl}/hubs/texas-sync`;
	}
	const fallbackBase = dev ? devSalesDefault : 'https://salestexas.runasp.net';
	return `${fallbackBase}/hubs/texas-sync`;
}

export const REALTIME_SIGNALR_HUB_URL = getSignalRHubUrl();

export function getSalesPortalFileUrl(filePath: string | null | undefined): string | null {
	if (!filePath) return null;
	if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('data:')) {
		return filePath;
	}
	const baseUrl = SALES_PORTAL_API_URL.endsWith('/') ? SALES_PORTAL_API_URL.slice(0, -1) : SALES_PORTAL_API_URL;
	const path = filePath.startsWith('/') ? filePath : `/${filePath}`;
	return `${baseUrl}${path}`;
}

function getOperationalPortalUrl(): string {
	const url = publicEnv.PUBLIC_OPERATIONAL_PORTAL_API_URL;

	if (!url) {
		return dev ? devOperationalDefault : 'https://operationtexas.runasp.net';
	}

	try {
		const parsed = new URL(url);
		if (!parsed.protocol.startsWith('http')) {
			throw new Error('PUBLIC_OPERATIONAL_PORTAL_API_URL must use HTTP or HTTPS protocol.');
		}
	} catch (err: unknown) {
		const detail = err instanceof Error ? err.message : String(err);
		throw new Error(
			`Invalid PUBLIC_OPERATIONAL_PORTAL_API_URL configuration value: "${url}". Detail: ${detail}`,
			{
				cause: err
			}
		);
	}

	return url;
}

export const OPERATIONAL_PORTAL_API_URL = getOperationalPortalUrl();


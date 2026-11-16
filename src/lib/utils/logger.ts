import { IS_DEV } from '$lib/config';

type LogLevel = 'info' | 'warn' | 'error' | 'fatal';

const SENSITIVE_KEYS = [
	'password',
	'token',
	'accesstoken',
	'refreshtoken',
	'card',
	'cvv',
	'secret',
	'key'
];

/**
 * Recursively scrubs credentials and tokens from log telemetry payloads.
 */
function maskPayload(data: any): any {
	if (!data) return data;
	if (typeof data !== 'object') return data;

	const copy = Array.isArray(data) ? [...data] : { ...data };

	for (const key in copy) {
		if (Object.prototype.hasOwnProperty.call(copy, key)) {
			if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
				copy[key] = '[MASKED]';
			} else if (typeof copy[key] === 'object') {
				copy[key] = maskPayload(copy[key]);
			}
		}
	}
	return copy;
}

/**
 * Dispatches masked log payloads to the console during development,
 * and masks data before forwarding in production.
 */
export function log(level: LogLevel, message: string, context?: any) {
	const maskedContext = context ? maskPayload(context) : undefined;

	const payload = {
		timestamp: new Date().toISOString(),
		level,
		message,
		context: maskedContext,
		route: typeof window !== 'undefined' ? window.location.pathname : 'SSR'
	};

	if (IS_DEV) {
		const formattedMsg = `[${payload.timestamp}] [${level.toUpperCase()}] [${payload.route}] ${message}`;
		if (level === 'error' || level === 'fatal') {
			console.error(formattedMsg, maskedContext ?? '');
		} else if (level === 'warn') {
			console.warn(formattedMsg, maskedContext ?? '');
		} else {
			console.log(formattedMsg, maskedContext ?? '');
		}
	} else {
		// Production logs capture boundary
		// Would dispatch to telemetry provider (e.g. Sentry/OpenTelemetry) here
	}
}

export const logger = {
	info: (msg: string, ctx?: any) => log('info', msg, ctx),
	warn: (msg: string, ctx?: any) => log('warn', msg, ctx),
	error: (msg: string, ctx?: any) => log('error', msg, ctx),
	fatal: (msg: string, ctx?: any) => log('fatal', msg, ctx)
};
export type { LogLevel };

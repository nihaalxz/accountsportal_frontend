export class ApiError extends Error {
	public readonly status: number;
	public readonly title: string;
	public readonly detail: string;
	public readonly instance?: string;
	public readonly correlationId?: string;

	constructor(
		status: number,
		title: string,
		detail: string,
		instance?: string,
		correlationId?: string
	) {
		super(`${status} ${title}: ${detail}`);
		this.name = 'ApiError';
		this.status = status;
		this.title = title;
		this.detail = detail;
		this.instance = instance;
		this.correlationId = correlationId;
	}
}

export class ValidationError extends ApiError {
	public readonly errors: Record<string, string[]>;
	constructor(
		detail: string,
		errors: Record<string, string[]>,
		instance?: string,
		correlationId?: string
	) {
		super(400, 'Validation Error', detail, instance, correlationId);
		this.name = 'ValidationError';
		this.errors = errors;
	}
}

export class AuthenticationError extends ApiError {
	constructor(
		detail = 'Not authenticated. Please log in.',
		instance?: string,
		correlationId?: string
	) {
		super(401, 'Unauthorized', detail, instance, correlationId);
		this.name = 'AuthenticationError';
	}
}

export class AuthorizationError extends ApiError {
	constructor(
		detail = 'You do not have permission to access this resource.',
		instance?: string,
		correlationId?: string
	) {
		super(403, 'Forbidden', detail, instance, correlationId);
		this.name = 'AuthorizationError';
	}
}

export class NotFoundError extends ApiError {
	constructor(
		detail = 'The requested resource was not found.',
		instance?: string,
		correlationId?: string
	) {
		super(404, 'Not Found', detail, instance, correlationId);
		this.name = 'NotFoundError';
	}
}

export class ConflictError extends ApiError {
	constructor(
		detail = 'A conflict occurred while processing the request.',
		instance?: string,
		correlationId?: string
	) {
		super(409, 'Conflict', detail, instance, correlationId);
		this.name = 'ConflictError';
	}
}

export class ConcurrencyConflictError extends ConflictError {
	constructor(
		detail = 'The record has been modified by another process. Please reload and try again.',
		instance?: string,
		correlationId?: string
	) {
		super(detail, instance, correlationId);
		this.name = 'ConcurrencyConflictError';
	}
}

export class RateLimitError extends ApiError {
	constructor(
		detail = 'Too many requests. Please wait a moment before trying again.',
		instance?: string,
		correlationId?: string
	) {
		super(429, 'Too Many Requests', detail, instance, correlationId);
		this.name = 'RateLimitError';
	}
}

export class DownstreamUnavailableError extends ApiError {
	constructor(
		detail = 'The service is currently unavailable. Please retry in a moment.',
		instance?: string,
		correlationId?: string
	) {
		super(503, 'Service Unavailable', detail, instance, correlationId);
		this.name = 'DownstreamUnavailableError';
	}
}

export class TimeoutError extends ApiError {
	constructor(
		detail = 'The request timed out. Please try again.',
		instance?: string,
		correlationId?: string
	) {
		super(504, 'Gateway Timeout', detail, instance, correlationId);
		this.name = 'TimeoutError';
	}
}

export class NetworkError extends Error {
	constructor(
		message = 'Network unavailable. Please check your connection.',
		options?: ErrorOptions
	) {
		super(message, options);
		this.name = 'NetworkError';
	}
}

export class UnknownApiError extends ApiError {
	constructor(
		status: number,
		detail = 'An unexpected error occurred.',
		instance?: string,
		correlationId?: string
	) {
		super(status, 'Unknown Error', detail, instance, correlationId);
		this.name = 'UnknownApiError';
	}
}

/**
 * Maps standard RFC-7807 response body + HTTP status → typed custom ApiError classes.
 */
export function parseProblemDetails(status: number, body: unknown): ApiError {
	const b = body as Record<string, unknown> | null | undefined;
	const detail =
		(typeof b?.detail === 'string' ? b.detail : undefined) ??
		(typeof b?.message === 'string' ? b.message : undefined) ??
		(typeof b?.Message === 'string' ? b.Message : undefined) ??
		'An unexpected error occurred.';
	const instance = typeof b?.instance === 'string' ? b.instance : undefined;
	const correlationId =
		typeof b?.traceId === 'string'
			? b.traceId
			: typeof b?.correlationId === 'string'
				? b.correlationId
				: undefined;

	switch (status) {
		case 400:
		case 422: {
			const errors =
				b?.errors && typeof b.errors === 'object'
					? (b.errors as Record<string, string[]>)
					: {};
			return new ValidationError(detail, errors, instance, correlationId);
		}
		case 401:
			return new AuthenticationError(detail, instance, correlationId);
		case 403:
			return new AuthorizationError(detail, instance, correlationId);
		case 404:
			return new NotFoundError(detail, instance, correlationId);
		case 409: {
			// Check if this is a concurrency conflict (indicated by detail text or error types)
			const isConcurrency =
				detail.toLowerCase().includes('concurrency') ||
				detail.toLowerCase().includes('modified') ||
				detail.toLowerCase().includes('rowversion') ||
				detail.toLowerCase().includes('idempotency');
			if (isConcurrency) {
				return new ConcurrencyConflictError(detail, instance, correlationId);
			}
			return new ConflictError(detail, instance, correlationId);
		}
		case 429:
			return new RateLimitError(detail, instance, correlationId);
		case 502:
		case 503:
			return new DownstreamUnavailableError(detail, instance, correlationId);
		case 504:
			return new TimeoutError(detail, instance, correlationId);
		default:
			return new UnknownApiError(status, detail, instance, correlationId);
	}
}

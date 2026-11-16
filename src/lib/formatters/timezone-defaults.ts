import { BAHRAIN_TIMEZONE } from './date';

/**
 * Initializes global client-side timezone defaults for Bahrain (UTC+3 / AST).
 * Patches Date.prototype methods safely with defensive fallback so that any ad-hoc
 * toLocaleString / toLocaleDateString / toLocaleTimeString calls across third-party libs
 * or components automatically respect Asia/Bahrain rather than the visitor's machine timezone.
 */
export function initBahrainTimezoneDefaults(): void {
	if (typeof window === 'undefined') return;
	if ((window as unknown as { __bahrain_timezone_initialized?: boolean }).__bahrain_timezone_initialized) return;
	(window as unknown as { __bahrain_timezone_initialized?: boolean }).__bahrain_timezone_initialized = true;

	const origToLocaleString = Date.prototype.toLocaleString;
	Date.prototype.toLocaleString = function (locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
		try {
			const opts = typeof options === 'object' && options !== null ? { ...options } : {};
			if (!opts.timeZone) {
				opts.timeZone = BAHRAIN_TIMEZONE;
			}
			return origToLocaleString.call(this, locales || 'en-US', opts);
		} catch {
			return origToLocaleString.apply(this, arguments as unknown as [locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions]);
		}
	};

	const origToLocaleDateString = Date.prototype.toLocaleDateString;
	Date.prototype.toLocaleDateString = function (locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
		try {
			const opts = typeof options === 'object' && options !== null ? { ...options } : {};
			if (!opts.timeZone) {
				opts.timeZone = BAHRAIN_TIMEZONE;
			}
			return origToLocaleDateString.call(this, locales || 'en-US', opts);
		} catch {
			return origToLocaleDateString.apply(this, arguments as unknown as [locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions]);
		}
	};

	const origToLocaleTimeString = Date.prototype.toLocaleTimeString;
	Date.prototype.toLocaleTimeString = function (locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
		try {
			const opts = typeof options === 'object' && options !== null ? { ...options } : {};
			if (!opts.timeZone) {
				opts.timeZone = BAHRAIN_TIMEZONE;
			}
			return origToLocaleTimeString.call(this, locales || 'en-US', opts);
		} catch {
			return origToLocaleTimeString.apply(this, arguments as unknown as [locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions]);
		}
	};
}

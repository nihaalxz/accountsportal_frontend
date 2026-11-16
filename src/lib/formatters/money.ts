/**
 * Formats a decimal number or string into a currency representation.
 * Defaults to BHD (Bahraini Dinar) which has 3 decimal places.
 */
export function formatMoney(
	amount: number | string | null | undefined,
	currency = 'BHD',
	locale = 'en-BH'
): string {
	if (amount === null || amount === undefined) {
		return '—';
	}

	const numericValue = typeof amount === 'string' ? parseFloat(amount) : amount;
	if (isNaN(numericValue)) {
		return '—';
	}

	// BHD, KWD, OMR utilize 3 decimal places, others generally utilize 2
	const fractionDigits = ['BHD', 'KWD', 'OMR'].includes(currency.toUpperCase()) ? 3 : 2;

	try {
		return new Intl.NumberFormat(locale, {
			style: 'currency',
			currency: currency.toUpperCase(),
			minimumFractionDigits: fractionDigits,
			maximumFractionDigits: fractionDigits
		}).format(numericValue);
	} catch {
		// Fallback to basic string building if locale/currency code is invalid
		return `${currency.toUpperCase()} ${numericValue.toFixed(fractionDigits)}`;
	}
}

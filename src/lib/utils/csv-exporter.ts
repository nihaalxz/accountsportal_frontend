/**
 * Centralized, robust CSV export utility.
 * Handles UTF-8 BOM encoding for Microsoft Excel, cell escaping for quotes/commas/newlines,
 * and uses Blob + URL.createObjectURL to avoid URL length & hash fragment truncation issues.
 */

import { toast } from '$lib/stores/toast';

export function exportToCSV(
	filename: string,
	headers: string[],
	rows: (string | number | boolean | null | undefined)[][]
): void {
	if (!rows || rows.length === 0) {
		toast.info('No records available to export.');
		return;
	}

	const formatCell = (cell: any): string => {
		if (cell === null || cell === undefined) return '""';
		const str = String(cell).replace(/"/g, '""').replace(/[\r\n]+/g, ' ');
		return `"${str}"`;
	};

	const csvLines = [
		headers.map(formatCell).join(','),
		...rows.map((row) => row.map(formatCell).join(','))
	];

	// \uFEFF is UTF-8 Byte Order Mark (BOM) ensuring Excel opens Unicode characters correctly
	const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], {
		type: 'text/csv;charset=utf-8;'
	});

	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.setAttribute('href', url);
	link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

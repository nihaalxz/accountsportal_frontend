/** SvelteKit param matcher – only matches numeric IDs, leaving static segments like "new" unaffected */
export function match(value: string): boolean {
	return /^\d+$/.test(value);
}

import { writable } from 'svelte/store';

export interface Toast {
	id: string;
	type: 'success' | 'error' | 'warning' | 'info';
	message: string;
	duration?: number;
}

const _toasts = writable<Toast[]>([]);

export const toasts = { subscribe: _toasts.subscribe };

/**
 * Triggers a global toast alert.
 */
export function addToast(message: string, type: Toast['type'] = 'info', duration = 4000): void {
	const id = Math.random().toString(36).substring(2);
	const toast: Toast = { id, type, message, duration };

	_toasts.update((list) => [...list, toast]);

	if (duration > 0) {
		setTimeout(() => {
			removeToast(id);
		}, duration);
	}
}

/**
 * Clears a specific toast by its unique id.
 */
export function removeToast(id: string): void {
	_toasts.update((list) => list.filter((t) => t.id !== id));
}

export const toast = {
	success: (msg: string, dur?: number) => addToast(msg, 'success', dur),
	error: (msg: string, dur?: number) => addToast(msg, 'error', dur),
	warning: (msg: string, dur?: number) => addToast(msg, 'warning', dur),
	info: (msg: string, dur?: number) => addToast(msg, 'info', dur)
};
export type { Toast as ToastType };

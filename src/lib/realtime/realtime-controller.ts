import { notificationDispatcher } from './notification-dispatcher';
import { subscriptionManager } from './subscription-manager';
import { signalRService } from './signalr-service';
import { createDebouncedRefetch } from './debounce-manager';

export class SalesEntriesRealtimeController {
	private debouncedRefetch: () => void;
	private targetEvent = 'SalesEntriesChanged';
	private targetGroup = 'role:accounts';
	private handler: (env: any) => void;
	private unsubscribeDispatcher: (() => void) | null = null;

	constructor(onRefresh: () => Promise<void> | void, delayMs: number = 200) {
		this.debouncedRefetch = createDebouncedRefetch(onRefresh, delayMs);
		this.handler = (envelope: any) => {
			console.log('[SALES ENTRIES CONTROLLER] Received SalesEntriesChanged event:', envelope);
			this.debouncedRefetch();
		};
	}

	public async mount() {
		this.unsubscribeDispatcher = notificationDispatcher.on(this.targetEvent, this.handler);
		await signalRService.startConnection();
		await subscriptionManager.subscribe(this.targetGroup);
		console.log(`[SALES ENTRIES CONTROLLER] Subscribed to SignalR group: ${this.targetGroup}`);
	}

	public async unmount() {
		if (this.unsubscribeDispatcher) {
			this.unsubscribeDispatcher();
			this.unsubscribeDispatcher = null;
		}
		await subscriptionManager.unsubscribe(this.targetGroup);
	}
}

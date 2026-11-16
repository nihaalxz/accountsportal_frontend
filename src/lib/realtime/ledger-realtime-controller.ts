import { signalRService } from './signalr-service';
import { subscriptionManager } from './subscription-manager';
import { notificationDispatcher } from './notification-dispatcher';
import { createDebouncedRefetch } from './debounce-manager';
import { SignalRGroups } from './signalr-service';
import type { NotificationEnvelope } from './signalr-service';

export interface LedgerRealtimeOptions {
    getHeadId: () => number | null | undefined;
    onLedgerChanged: () => void | Promise<void>;
    debounceMs?: number;
}

export class LedgerRealtimeController {
    private getHeadId: () => number | null | undefined;
    private onLedgerChangedCallback: () => void | Promise<void>;
    private debouncedRefetch: () => void;
    private currentSubscribedGroup: string | null = null;
    private unsubscribeDispatcher: (() => void) | null = null;

    constructor(options: LedgerRealtimeOptions) {
        this.getHeadId = options.getHeadId;
        this.onLedgerChangedCallback = options.onLedgerChanged;
        this.debouncedRefetch = createDebouncedRefetch(
            this.onLedgerChangedCallback,
            options.debounceMs ?? 200
        );
    }

    public async mount(): Promise<void> {
        // Register listener for LedgerChanged business event
        this.unsubscribeDispatcher = notificationDispatcher.on(
            'LedgerChanged',
            (envelope: NotificationEnvelope) => {
                const activeHeadId = this.getHeadId();
                if (activeHeadId && envelope.headId === activeHeadId) {
                    console.log(`[REALTIME CONTROLLER] Received LedgerChanged for Head ID ${activeHeadId}. Triggering debounced refresh.`);
                    this.debouncedRefetch();
                }
            }
        );

        await this.syncSubscription();
    }

    public async syncSubscription(): Promise<void> {
        const activeHeadId = this.getHeadId();
        const targetGroup = activeHeadId ? SignalRGroups.CustomerLedger(activeHeadId) : null;

        if (this.currentSubscribedGroup === targetGroup) {
            return;
        }

        // Leave old group if changed
        if (this.currentSubscribedGroup) {
            await subscriptionManager.unsubscribeFromGroup(this.currentSubscribedGroup);
            this.currentSubscribedGroup = null;
        }

        // Join new group
        if (targetGroup) {
            await signalRService.startConnection();
            await subscriptionManager.subscribeToGroup(targetGroup);
            this.currentSubscribedGroup = targetGroup;
            console.log(`[REALTIME CONTROLLER] Subscribed to SignalR group: ${targetGroup}`);
        }
    }

    public async unmount(): Promise<void> {
        if (this.unsubscribeDispatcher) {
            this.unsubscribeDispatcher();
            this.unsubscribeDispatcher = null;
        }

        if (this.currentSubscribedGroup) {
            await subscriptionManager.unsubscribeFromGroup(this.currentSubscribedGroup);
            console.log(`[REALTIME CONTROLLER] Unsubscribed from SignalR group: ${this.currentSubscribedGroup}`);
            this.currentSubscribedGroup = null;
        }
    }
}

import { signalRService } from './signalr-service';
import { subscriptionManager } from './subscription-manager';
import { notificationDispatcher } from './notification-dispatcher';
import { createDebouncedRefetch } from './debounce-manager';
import { SignalRGroups } from './signalr-service';
import type { NotificationEnvelope } from './signalr-service';

export interface OutstandingRealtimeOptions {
    getOwnerId: () => number | null | undefined;
    getOwnerType: () => 'customer' | 'agent' | 'supplier';
    onOutstandingChanged: () => void | Promise<void>;
    debounceMs?: number;
}

export class OutstandingRealtimeController {
    private getOwnerId: () => number | null | undefined;
    private getOwnerType: () => 'customer' | 'agent' | 'supplier';
    private onOutstandingChangedCallback: () => void | Promise<void>;
    private debouncedRefetch: () => void;
    private currentSubscribedGroup: string | null = null;
    private unsubscribeDispatcher: (() => void) | null = null;

    constructor(options: OutstandingRealtimeOptions) {
        this.getOwnerId = options.getOwnerId;
        this.getOwnerType = options.getOwnerType;
        this.onOutstandingChangedCallback = options.onOutstandingChanged;
        this.debouncedRefetch = createDebouncedRefetch(
            this.onOutstandingChangedCallback,
            options.debounceMs ?? 200
        );
    }

    public async mount(): Promise<void> {
        this.unsubscribeDispatcher = notificationDispatcher.on(
            'OutstandingChanged',
            (envelope: NotificationEnvelope) => {
                const ownerId = this.getOwnerId();
                if (ownerId && (envelope.headId === ownerId || envelope.agentId === ownerId)) {
                    console.log(`[OUTSTANDING REALTIME CONTROLLER] Received OutstandingChanged for ${this.getOwnerType()} ID ${ownerId}. Triggering debounced refresh.`);
                    this.debouncedRefetch();
                }
            }
        );

        await this.syncSubscription();
    }

    public async syncSubscription(): Promise<void> {
        const ownerId = this.getOwnerId();
        const ownerType = this.getOwnerType();
        let targetGroup: string | null = null;

        if (ownerId) {
            if (ownerType === 'customer') {
                targetGroup = SignalRGroups.CustomerOutstanding(ownerId);
            } else if (ownerType === 'agent') {
                targetGroup = SignalRGroups.AgentOutstanding(ownerId);
            } else if (ownerType === 'supplier') {
                targetGroup = SignalRGroups.SupplierOutstanding(ownerId);
            }
        }

        if (this.currentSubscribedGroup === targetGroup) {
            return;
        }

        if (this.currentSubscribedGroup) {
            await subscriptionManager.unsubscribeFromGroup(this.currentSubscribedGroup);
            this.currentSubscribedGroup = null;
        }

        if (targetGroup) {
            await signalRService.startConnection();
            await subscriptionManager.subscribeToGroup(targetGroup);
            this.currentSubscribedGroup = targetGroup;
            console.log(`[OUTSTANDING REALTIME CONTROLLER] Subscribed to SignalR group: ${targetGroup}`);
        }
    }

    public async unmount(): Promise<void> {
        if (this.unsubscribeDispatcher) {
            this.unsubscribeDispatcher();
            this.unsubscribeDispatcher = null;
        }

        if (this.currentSubscribedGroup) {
            await subscriptionManager.unsubscribeFromGroup(this.currentSubscribedGroup);
            console.log(`[OUTSTANDING REALTIME CONTROLLER] Unsubscribed from SignalR group: ${this.currentSubscribedGroup}`);
            this.currentSubscribedGroup = null;
        }
    }
}

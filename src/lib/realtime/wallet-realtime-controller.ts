import { signalRService } from './signalr-service';
import { subscriptionManager } from './subscription-manager';
import { notificationDispatcher } from './notification-dispatcher';
import { createDebouncedRefetch } from './debounce-manager';
import { SignalRGroups } from './signalr-service';
import type { NotificationEnvelope } from './signalr-service';

export interface WalletRealtimeOptions {
    getOwnerId: () => number | null | undefined;
    getOwnerType: () => 'customer' | 'agent' | 'supplier';
    onWalletChanged: () => void | Promise<void>;
    debounceMs?: number;
}

export class WalletRealtimeController {
    private getOwnerId: () => number | null | undefined;
    private getOwnerType: () => 'customer' | 'agent' | 'supplier';
    private onWalletChangedCallback: () => void | Promise<void>;
    private debouncedRefetch: () => void;
    private currentSubscribedGroup: string | null = null;
    private unsubscribeDispatcher: (() => void) | null = null;

    constructor(options: WalletRealtimeOptions) {
        this.getOwnerId = options.getOwnerId;
        this.getOwnerType = options.getOwnerType;
        this.onWalletChangedCallback = options.onWalletChanged;
        this.debouncedRefetch = createDebouncedRefetch(
            this.onWalletChangedCallback,
            options.debounceMs ?? 200
        );
    }

    public async mount(): Promise<void> {
        this.unsubscribeDispatcher = notificationDispatcher.on(
            'WalletChanged',
            (envelope: NotificationEnvelope) => {
                const ownerId = this.getOwnerId();
                if (ownerId && (envelope.headId === ownerId || envelope.agentId === ownerId)) {
                    console.log(`[WALLET REALTIME CONTROLLER] Received WalletChanged for ${this.getOwnerType()} ID ${ownerId}. Triggering debounced refresh.`);
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
                targetGroup = SignalRGroups.CustomerWallet(ownerId);
            } else if (ownerType === 'agent') {
                targetGroup = SignalRGroups.AgentWallet(ownerId);
            } else if (ownerType === 'supplier') {
                targetGroup = SignalRGroups.SupplierWallet(ownerId);
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
            console.log(`[WALLET REALTIME CONTROLLER] Subscribed to SignalR group: ${targetGroup}`);
        }
    }

    public async unmount(): Promise<void> {
        if (this.unsubscribeDispatcher) {
            this.unsubscribeDispatcher();
            this.unsubscribeDispatcher = null;
        }

        if (this.currentSubscribedGroup) {
            await subscriptionManager.unsubscribeFromGroup(this.currentSubscribedGroup);
            console.log(`[WALLET REALTIME CONTROLLER] Unsubscribed from SignalR group: ${this.currentSubscribedGroup}`);
            this.currentSubscribedGroup = null;
        }
    }
}

import { signalRService } from './signalr-service';
import { subscriptionManager } from './subscription-manager';
import { notificationDispatcher } from './notification-dispatcher';
import { createDebouncedRefetch } from './debounce-manager';
import { SignalRGroups } from './signalr-service';
import type { NotificationEnvelope } from './signalr-service';

export interface ReceiptRealtimeOptions {
    getHeadId?: () => number | null | undefined;
    isApprovalQueue?: boolean;
    isGlobalList?: boolean;
    onReceiptChanged: () => void | Promise<void>;
    debounceMs?: number;
}

export class ReceiptRealtimeController {
    private getHeadId?: () => number | null | undefined;
    private isApprovalQueue: boolean;
    private isGlobalList: boolean;
    private onReceiptChangedCallback: () => void | Promise<void>;
    private debouncedRefetch: () => void;
    private currentSubscribedGroups: string[] = [];
    private unsubscribeDispatcher: (() => void) | null = null;

    constructor(options: ReceiptRealtimeOptions) {
        this.getHeadId = options.getHeadId;
        this.isApprovalQueue = options.isApprovalQueue ?? false;
        this.isGlobalList = options.isGlobalList ?? false;
        this.onReceiptChangedCallback = options.onReceiptChanged;
        this.debouncedRefetch = createDebouncedRefetch(
            this.onReceiptChangedCallback,
            options.debounceMs ?? 200
        );
    }

    public async mount(): Promise<void> {
        this.unsubscribeDispatcher = notificationDispatcher.on(
            'ReceiptChanged',
            (envelope: NotificationEnvelope) => {
                const headId = this.getHeadId ? this.getHeadId() : null;
                const isMatchingCustomer = headId && envelope.headId === headId;
                const isMatchingScope = this.isApprovalQueue || this.isGlobalList || isMatchingCustomer;

                if (isMatchingScope) {
                    console.log(`[RECEIPT REALTIME CONTROLLER] Received ReceiptChanged for Target ${envelope.targetGroup}. Triggering debounced refresh.`);
                    this.debouncedRefetch();
                }
            }
        );

        await this.syncSubscriptions();
    }

    public async syncSubscriptions(): Promise<void> {
        const targetGroups: string[] = [];

        if (this.isApprovalQueue) {
            targetGroups.push(SignalRGroups.ReceiptApproval);
        }
        if (this.isGlobalList) {
            targetGroups.push(SignalRGroups.ReceiptList);
        }
        if (this.getHeadId) {
            const headId = this.getHeadId();
            if (headId) {
                targetGroups.push(SignalRGroups.CustomerReceipt(headId));
            }
        }

        // Leave old groups that are no longer active
        for (const oldGroup of this.currentSubscribedGroups) {
            if (!targetGroups.includes(oldGroup)) {
                await subscriptionManager.unsubscribeFromGroup(oldGroup);
            }
        }

        // Subscribe to new groups
        if (targetGroups.length > 0) {
            await signalRService.startConnection();
            for (const group of targetGroups) {
                if (!this.currentSubscribedGroups.includes(group)) {
                    await subscriptionManager.subscribeToGroup(group);
                    console.log(`[RECEIPT REALTIME CONTROLLER] Subscribed to SignalR group: ${group}`);
                }
            }
        }

        this.currentSubscribedGroups = targetGroups;
    }

    public async unmount(): Promise<void> {
        if (this.unsubscribeDispatcher) {
            this.unsubscribeDispatcher();
            this.unsubscribeDispatcher = null;
        }

        for (const group of this.currentSubscribedGroups) {
            await subscriptionManager.unsubscribeFromGroup(group);
            console.log(`[RECEIPT REALTIME CONTROLLER] Unsubscribed from SignalR group: ${group}`);
        }
        this.currentSubscribedGroups = [];
    }
}

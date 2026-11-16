import { signalRService } from './signalr-service';
import { subscriptionManager } from './subscription-manager';
import { notificationDispatcher } from './notification-dispatcher';
import { createDebouncedRefetch } from './debounce-manager';
import { SignalRGroups } from './signalr-service';
import type { NotificationEnvelope } from './signalr-service';

export interface OperationalQueueRealtimeOptions {
    queueType?: 'visa' | 'vfs' | 'holiday' | 'transport' | 'otherservices';
    getAssignedUserId?: () => number | null | undefined;
    isOperationsRole?: boolean;
    onQueueChanged: () => void | Promise<void>;
    debounceMs?: number;
}

export class OperationalQueueRealtimeController {
    private queueType?: 'visa' | 'vfs' | 'holiday' | 'transport' | 'otherservices';
    private getAssignedUserId?: () => number | null | undefined;
    private isOperationsRole: boolean;
    private onQueueChangedCallback: () => void | Promise<void>;
    private debouncedRefetch: () => void;
    private currentSubscribedGroups: string[] = [];
    private unsubscribeDispatcher: (() => void) | null = null;

    constructor(options: OperationalQueueRealtimeOptions) {
        this.queueType = options.queueType;
        this.getAssignedUserId = options.getAssignedUserId;
        this.isOperationsRole = options.isOperationsRole ?? true;
        this.onQueueChangedCallback = options.onQueueChanged;
        this.debouncedRefetch = createDebouncedRefetch(
            this.onQueueChangedCallback,
            options.debounceMs ?? 200
        );
    }

    public async mount(): Promise<void> {
        this.unsubscribeDispatcher = notificationDispatcher.on(
            'OperationalQueueChanged',
            (envelope: NotificationEnvelope) => {
                const assignedUserId = this.getAssignedUserId ? this.getAssignedUserId() : null;
                const isMatchingUser = assignedUserId && envelope.agentId === assignedUserId;
                const isMatchingQueueType = !!(this.queueType && envelope.targetGroup && envelope.targetGroup.includes(this.queueType));
                const isMatchingScope = this.isOperationsRole || isMatchingQueueType || isMatchingUser;

                if (isMatchingScope) {
                    console.log(`[OPERATIONAL QUEUE CONTROLLER] Received OperationalQueueChanged for ${envelope.targetGroup}. Triggering debounced refresh.`);
                    this.debouncedRefetch();
                }
            }
        );

        await this.syncSubscriptions();
    }

    public async syncSubscriptions(): Promise<void> {
        const targetGroups: string[] = [];

        if (this.isOperationsRole) {
            targetGroups.push(SignalRGroups.Operations);
        }

        if (this.queueType) {
            switch (this.queueType) {
                case 'visa':
                    targetGroups.push(SignalRGroups.OperationsVisa);
                    break;
                case 'vfs':
                    targetGroups.push(SignalRGroups.OperationsVfs);
                    break;
                case 'holiday':
                    targetGroups.push(SignalRGroups.OperationsHoliday);
                    break;
                case 'transport':
                    targetGroups.push(SignalRGroups.OperationsTransport);
                    break;
                case 'otherservices':
                    targetGroups.push(SignalRGroups.OperationsOtherServices);
                    break;
            }
        }

        if (this.getAssignedUserId) {
            const userId = this.getAssignedUserId();
            if (userId) {
                targetGroups.push(SignalRGroups.OperationsUser(userId));
            }
        }

        // Leave old groups no longer active
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
                    console.log(`[OPERATIONAL QUEUE CONTROLLER] Subscribed to SignalR group: ${group}`);
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
            console.log(`[OPERATIONAL QUEUE CONTROLLER] Unsubscribed from SignalR group: ${group}`);
        }
        this.currentSubscribedGroups = [];
    }
}

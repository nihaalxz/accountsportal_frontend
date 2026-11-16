import { signalRService } from './signalr-service';
import { subscriptionManager } from './subscription-manager';
import { notificationDispatcher } from './notification-dispatcher';
import { createDebouncedRefetch } from './debounce-manager';
import { SignalRGroups } from './signalr-service';
import type { NotificationEnvelope } from './signalr-service';

export interface DashboardWidgetCallbacks {
    onSalesWidgetChanged?: () => void | Promise<void>;
    onFinanceWidgetChanged?: () => void | Promise<void>;
    onWalletWidgetChanged?: () => void | Promise<void>;
    onSummaryWidgetChanged?: () => void | Promise<void>;
    onReceiptsWidgetChanged?: () => void | Promise<void>;
    onOperationsWidgetChanged?: () => void | Promise<void>;
}

export interface DashboardRealtimeOptions {
    widgets?: ('sales' | 'finance' | 'wallet' | 'summary' | 'receipts' | 'operations')[];
    getUserId?: () => number | null | undefined;
    callbacks: DashboardWidgetCallbacks;
    debounceMs?: number;
}

export class DashboardRealtimeController {
    private widgets: ('sales' | 'finance' | 'wallet' | 'summary' | 'receipts' | 'operations')[];
    private getUserId?: () => number | null | undefined;
    private callbacks: DashboardWidgetCallbacks;
    private debouncedCallbacks: Map<string, () => void> = new Map();
    private currentSubscribedGroups: string[] = [];
    private unsubscribeDispatcher: (() => void) | null = null;

    constructor(options: DashboardRealtimeOptions) {
        this.widgets = options.widgets ?? ['sales', 'finance', 'wallet', 'summary', 'receipts', 'operations'];
        this.getUserId = options.getUserId;
        this.callbacks = options.callbacks;

        const debounceTime = options.debounceMs ?? 200;

        if (this.callbacks.onSalesWidgetChanged) {
            this.debouncedCallbacks.set('dashboard:sales', createDebouncedRefetch(this.callbacks.onSalesWidgetChanged, debounceTime));
        }
        if (this.callbacks.onFinanceWidgetChanged) {
            this.debouncedCallbacks.set('dashboard:finance', createDebouncedRefetch(this.callbacks.onFinanceWidgetChanged, debounceTime));
        }
        if (this.callbacks.onWalletWidgetChanged) {
            this.debouncedCallbacks.set('dashboard:wallet', createDebouncedRefetch(this.callbacks.onWalletWidgetChanged, debounceTime));
        }
        if (this.callbacks.onSummaryWidgetChanged) {
            this.debouncedCallbacks.set('dashboard:summary', createDebouncedRefetch(this.callbacks.onSummaryWidgetChanged, debounceTime));
        }
        if (this.callbacks.onReceiptsWidgetChanged) {
            this.debouncedCallbacks.set('dashboard:receipts', createDebouncedRefetch(this.callbacks.onReceiptsWidgetChanged, debounceTime));
        }
        if (this.callbacks.onOperationsWidgetChanged) {
            this.debouncedCallbacks.set('dashboard:operations', createDebouncedRefetch(this.callbacks.onOperationsWidgetChanged, debounceTime));
        }
    }

    public async mount(): Promise<void> {
        this.unsubscribeDispatcher = notificationDispatcher.on(
            'DashboardChanged',
            (envelope: NotificationEnvelope) => {
                const targetGroup = envelope.targetGroup ?? '';
                const debounced = this.debouncedCallbacks.get(targetGroup);

                if (debounced) {
                    console.log(`[DASHBOARD CONTROLLER] Triggering widget refresh for ${targetGroup}`);
                    debounced();
                } else if (targetGroup.startsWith('dashboard:user:')) {
                    const userId = this.getUserId ? this.getUserId() : null;
                    if (userId && targetGroup === SignalRGroups.DashboardUser(userId)) {
                        console.log(`[DASHBOARD CONTROLLER] Triggering user-specific widget refresh for ${targetGroup}`);
                        for (const callback of this.debouncedCallbacks.values()) {
                            callback();
                        }
                    }
                }
            }
        );

        await this.syncSubscriptions();
    }

    public async syncSubscriptions(): Promise<void> {
        const targetGroups: string[] = [];

        for (const widget of this.widgets) {
            switch (widget) {
                case 'sales':
                    targetGroups.push(SignalRGroups.DashboardSales);
                    break;
                case 'finance':
                    targetGroups.push(SignalRGroups.DashboardFinance);
                    break;
                case 'wallet':
                    targetGroups.push(SignalRGroups.DashboardWallet);
                    break;
                case 'summary':
                    targetGroups.push(SignalRGroups.DashboardSummary);
                    break;
                case 'receipts':
                    targetGroups.push(SignalRGroups.DashboardReceipts);
                    break;
                case 'operations':
                    targetGroups.push(SignalRGroups.DashboardOperations);
                    break;
            }
        }

        if (this.getUserId) {
            const userId = this.getUserId();
            if (userId) {
                targetGroups.push(SignalRGroups.DashboardUser(userId));
            }
        }

        for (const oldGroup of this.currentSubscribedGroups) {
            if (!targetGroups.includes(oldGroup)) {
                await subscriptionManager.unsubscribeFromGroup(oldGroup);
            }
        }

        if (targetGroups.length > 0) {
            await signalRService.startConnection();
            for (const group of targetGroups) {
                if (!this.currentSubscribedGroups.includes(group)) {
                    await subscriptionManager.subscribeToGroup(group);
                    console.log(`[DASHBOARD CONTROLLER] Subscribed to SignalR group: ${group}`);
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
            console.log(`[DASHBOARD CONTROLLER] Unsubscribed from SignalR group: ${group}`);
        }
        this.currentSubscribedGroups = [];
    }
}

import * as signalR from '@microsoft/signalr';
import { notificationDispatcher } from './notification-dispatcher';
import { subscriptionManager } from './subscription-manager';
import { BACKEND_API_URL, REALTIME_SIGNALR_HUB_URL } from '$lib/config';
import { getAccessToken } from '$lib/api/api-client';

export interface NotificationEnvelope {
	eventId: string;
	correlationId: string;
	eventName: string;
	referenceType: string;
	referenceId: string;
	headId?: number | null;
	agentId?: number | null;
	priority?: string;
	producer: string;
	timestamp: string;
	targetGroup?: string | null;
}

export class SignalRService {
	private connection: signalR.HubConnection | null = null;
	private isEnabled: boolean = false;
	private isConnected: boolean = false;
	private isInitializing: boolean = false;

	constructor() {
		// Feature flag check
		this.isEnabled = typeof window !== 'undefined' && 
			(window as any).ENABLE_REALTIME_SYNC !== false;
	}

	public async initialize(hubUrl: string, getToken: () => string | Promise<string>) {
		if (!this.isEnabled) {
			console.log('Realtime sync is disabled via ENABLE_REALTIME_SYNC feature flag.');
			return;
		}

		if (this.isConnected || this.isInitializing) {
			return;
		}

		this.isInitializing = true;

		try {
			this.connection = new signalR.HubConnectionBuilder()
				.withUrl(hubUrl, {
					accessTokenFactory: getToken
				})
				.withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
				.configureLogging(signalR.LogLevel.Warning)
				.build();

			subscriptionManager.setConnection(this.connection);

			this.connection.on('OnSignal', (envelope: any) => {
				console.log('[SIGNALR] OnSignal received:', envelope);
				notificationDispatcher.dispatch(envelope);
			});

			this.connection.onreconnected(async () => {
				this.isConnected = true;
				await subscriptionManager.resubscribeAll();
			});

			this.connection.onclose(() => {
				this.isConnected = false;
			});

			await this.connection.start();
			this.isConnected = true;
			console.log('SignalR connection established successfully to:', hubUrl);
		} catch (err) {
			console.warn('Failed to start SignalR connection:', err);
			this.isConnected = false;
		} finally {
			this.isInitializing = false;
		}
	}

	public async startConnection(): Promise<void> {
		if (this.isConnected || this.isInitializing) return;

		const hubUrl = REALTIME_SIGNALR_HUB_URL;
		const getToken = async () => {
    let token = getAccessToken();

    console.log("========== SIGNALR AUTH ==========");
    console.log("Access token exists:", !!token);
    console.log("Access token length:", token?.length);
    console.log("==================================");

    if (!token) {
        const { attemptRefresh } = await import('$lib/api/refresh');
        token = await attemptRefresh();

        console.log("Refresh returned token:", !!token);
        console.log("Refresh token length:", token?.length);
    }

    return token || '';
};

		await this.initialize(hubUrl, getToken);
	}

	public async stop() {
		if (this.connection) {
			await this.connection.stop();
			this.isConnected = false;
		}
	}

	public isConnectionActive(): boolean {
		return this.isConnected;
	}
}

export const signalRService = new SignalRService();

export const SignalRGroups = {
	Accounts: 'role:accounts',
	Sales: 'role:sales',
	Operations: 'role:operations',
	GlobalAll: 'global:all',
	User: (userId: string | number) => `user:${userId}`,
	CustomerLedger: (headId: number) => `ledger:customer:${headId}`,
	SupplierLedger: (supplierId: number) => `ledger:supplier:${supplierId}`,
	AgentLedger: (agentId: number) => `ledger:agent:${agentId}`,
	Wallet: (headId: number) => `wallet:${headId}`,
	CustomerWallet: (headId: number) => `wallet:customer:${headId}`,
	AgentWallet: (agentId: number) => `wallet:agent:${agentId}`,
	SupplierWallet: (supplierId: number) => `wallet:supplier:${supplierId}`,
	CustomerOutstanding: (headId: number) => `outstanding:customer:${headId}`,
	AgentOutstanding: (agentId: number) => `outstanding:agent:${agentId}`,
	SupplierOutstanding: (supplierId: number) => `outstanding:supplier:${supplierId}`,
	ReceiptApproval: 'receipt:approval',
	ReceiptList: 'receipt:list',
	CustomerReceipt: (headId: number) => `receipt:customer:${headId}`,
	AgentReceipt: (agentId: number) => `receipt:agent:${agentId}`,
	SupplierReceipt: (supplierId: number) => `receipt:supplier:${supplierId}`,
	OperationsVisa: 'operations:visa',
	OperationsVfs: 'operations:vfs',
	OperationsHoliday: 'operations:holiday',
	OperationsTransport: 'operations:transport',
	OperationsOtherServices: 'operations:otherservices',
	OperationsUser: (userId: number) => `operations:user:${userId}`,
	DashboardSales: 'dashboard:sales',
	DashboardFinance: 'dashboard:finance',
	DashboardWallet: 'dashboard:wallet',
	DashboardSummary: 'dashboard:summary',
	DashboardReceipts: 'dashboard:receipts',
	DashboardOperations: 'dashboard:operations',
	DashboardUser: (userId: number) => `dashboard:user:${userId}`
};

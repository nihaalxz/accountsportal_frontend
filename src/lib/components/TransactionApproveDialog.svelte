<script lang="ts">
	/**
	 * TransactionApproveDialog — confirmation dialog for transaction approval.
	 * Gated to master_accountant role.
	 */
	import { approveTransaction } from '$features/financial-transactions/api';
	import { hasRole } from '$lib/stores/auth';
	import { addToast } from '$lib/stores/toast';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';

	interface Props {
		transactionId: number | null;
		open: boolean;
		onConfirm?: () => void;
		onClose?: () => void;
	}

	let { transactionId, open = $bindable(false), onConfirm, onClose }: Props = $props();

	async function handleApprove() {
		if (!transactionId) return;

		if (!hasRole('master_accountant')) {
			addToast('Only a Master Accountant can approve transactions.', 'error');
			return;
		}

		try {
			await approveTransaction(transactionId);
			addToast(`Transaction #${transactionId} has been successfully approved.`, 'success');
			if (onConfirm) onConfirm();
		} catch (err: any) {
			const message = err.message || 'Failed to approve transaction.';
			addToast(message, 'error');
			throw err; // throw so ConfirmationDialog shows the error state
		}
	}

	function handleCancel() {
		if (onClose) onClose();
		open = false;
	}
</script>

<ConfirmationDialog
	bind:open
	title="Approve Transaction"
	message="Are you sure you want to approve transaction #{transactionId}? This will post the transaction and finalize the ledger entries."
	confirmLabel="Approve"
	onConfirm={handleApprove}
	onCancel={handleCancel}
/>

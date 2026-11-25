<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { hasRole } from '$lib/stores/auth';
	import { apiFetch } from '$lib/api/api-client';
	import {
		createExpense,
		getExpenseHeaders
	} from '$features/expenses/api';
	import { createSupplierPayment } from '$features/suppliers/api';
	import { getAccounts } from '$features/cash-accounts/api';
	import { getBanks } from '$features/bank-accounts/api';
	import {
		createContraTransaction,
		createOutgoingTransaction
	} from '$features/financial-transactions/api';
	import { createIdempotentOperation } from '$lib/utils/idempotency';
	import type { ExpenseHeaderResponse, ExpensePaymentMethod } from '$features/expenses/types';
	import { getBucketDirection, getBucketSourceLabel, getBucketHelpText } from '$features/expenses/types';
	import type { AccountResponse } from '$features/cash-accounts/types';
	import type { BankResponse } from '$features/bank-accounts/types';
	import { Button } from '$lib/components/ui/button';
	import { addToast } from '$lib/stores/toast';
	import { getBahrainDateString } from '$lib/formatters/date';
	import { getSalaryProfiles, createSalaryPayment } from '$features/payroll/services/payroll-api';
	import type { SalaryProfile, CreateSalaryPaymentPayload } from '$features/payroll/types';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import MoneyDisplay from '$lib/components/MoneyDisplay.svelte';
	import {
		ArrowLeft,
		Wallet,
		Building2,
		HelpCircle,
		UserCheck,
		ArrowUpRight,
		ArrowDownLeft,
		CreditCard,
		Receipt,
		FileText,
		Sparkles,
		CheckCircle2,
		Coins,
		Landmark,
		Calculator,
		ArrowRightLeft,
		Users,
		User,
		ShieldCheck,
		AlertCircle
	} from 'lucide-svelte';

	import { page } from '$app/stores';

	interface SupplierOption {
		id: number;
		name: string;
		code: string;
		wallet: number;
	}

	interface AgentOption {
		id: number;
		firstName: string;
		lastName: string;
		fullName?: string;
		phoneNo?: string;
		emailId?: string;
		wallet: number;
	}

	interface CustomerHeadOption {
		id: number;
		firstName?: string;
		lastName?: string;
		name?: string;
		type?: string;
		clientType?: string;
		phone?: string;
		wallet: number;
	}

	// Active mode tab: 'general' | 'supplier' | 'head' | 'salary' | 'contra'
	let activeTab = $state<'general' | 'supplier' | 'head' | 'salary' | 'contra'>('general');

	const idempotentOp = createIdempotentOperation();

	let expenseCategoryIdVal = $state('');
	let amount = $state<string>('');
	let description = $state('');
	let paymentMethod = $state<ExpensePaymentMethod>('cash');
	let sourceAccountIdVal = $state('');
	let sourceBankIdVal = $state('');
	let notes = $state('');
	let expenseDate = $state(getBahrainDateString());

	// Contra fields
	let contraForm = $state({
		sourceType: 'account' as 'account' | 'bank',
		sourceAccountId: '' as string | number,
		sourceBankId: '' as string | number,
		destinationType: 'account' as 'account' | 'bank',
		destinationAccountId: '' as string | number,
		destinationBankId: '' as string | number,
		amount: '' as string | number,
		description: ''
	});

	// Supplier fields
	let supplierIdVal = $state('');
	let supplierPaymentType = $state('supplier_wallet');
	let referenceNumber = $state('');

	// Head Balance (Agents & Customers) fields
	let headEntityType = $state<'customer' | 'agent'>('customer');
	let headOperationType = $state<'withdraw'>('withdraw');
	let headCustomerId = $state<string | number>('');
	let headAgentId = $state<string | number>('');
	let headPaymentMethod = $state<'cash' | 'bank'>('cash');
	let headSourceAccountId = $state<string | number>('');
	let headSourceBankId = $state<string | number>('');
	let headAmount = $state<string>('');
	let headReference = $state('');
	let headDescription = $state('');
	let headNotes = $state('');

	// Salary Payout fields
	let salaryProfiles = $state<SalaryProfile[]>([]);
	let selectedSalaryProfileId = $state<number>(0);
	const todayStr = getBahrainDateString();

	let salaryForm = $state<CreateSalaryPaymentPayload>({
		salaryProfileId: 0,
		payrollMonth: new Date().getMonth() + 1,
		payrollYear: new Date().getFullYear(),
		basicSalary: 0,
		incentive: 0,
		bonus: 0,
		allowance: 0,
		deduction: 0,
		paymentMethod: 'Cash Account',
		cashAccountId: null,
		bankAccountId: null,
		transactionReference: '',
		paymentDate: todayStr,
		status: 'Pending',
		remarks: ''
	});

	const months = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];

	let categories = $state<ExpenseHeaderResponse[]>([]);
	let cashAccounts = $state<AccountResponse[]>([]);
	let bankAccounts = $state<BankResponse[]>([]);
	let suppliers = $state<SupplierOption[]>([]);
	let agentsList = $state<AgentOption[]>([]);
	let headsList = $state<CustomerHeadOption[]>([]);
	let isSubmitting = $state(false);
	let isLoadingData = $state(true);

	const isSupplierTransaction = $derived(activeTab === 'supplier');
	const isHeadTransaction = $derived(activeTab === 'head');

	const selectedSupplier = $derived(
		suppliers.find((s) => String(s.id) === supplierIdVal) || null
	);

	const selectedCategory = $derived(
		categories.find((c) => String(c.id) === expenseCategoryIdVal) || null
	);

	const categoryBucket = $derived(selectedCategory?.category || 'Expenses');
	const direction = $derived.by(() => {
		if (activeTab === 'head') {
			return 'outgoing';
		}
		return getBucketDirection(categoryBucket, isSupplierTransaction ? supplierPaymentType : undefined);
	});
	const sourceLabel = $derived(getBucketSourceLabel(categoryBucket, isSupplierTransaction ? supplierPaymentType : undefined));
	const helpText = $derived(getBucketHelpText(categoryBucket, isSupplierTransaction ? supplierPaymentType : undefined));

	const selectedCashAccount = $derived(
		cashAccounts.find((a) => String(a.id) === sourceAccountIdVal) || null
	);

	const selectedBankAccount = $derived(
		bankAccounts.find((b) => String(b.id) === sourceBankIdVal) || null
	);

	// ─── Head Balance Derived States ─────────────────────────────────────────────
	const agentOptions = $derived(
		agentsList.map((a) => {
			const name = a.fullName || `${a.firstName || ''} ${a.lastName || ''}`.trim() || `Agent #${a.id}`;
			return {
				id: a.id,
				name,
				subtext: `AGENT • Phone: ${a.phoneNo || 'N/A'} • Balance: ${Number(a.wallet || 0).toFixed(3)} BHD`
			};
		})
	);

	const customerOptions = $derived(
		headsList
			.filter((h) => {
				const t = (h.type || h.clientType || '').toLowerCase();
				return t !== 'agent' && t !== 'b2b' && t !== 'b2b_agent';
			})
			.map((h) => {
				const name = `${h.firstName || ''} ${h.lastName || ''}`.trim() || h.name || `Customer #${h.id}`;
				return {
					id: h.id,
					name,
					subtext: `CUSTOMER • Balance: ${Number(h.wallet || 0).toFixed(3)} BHD`
				};
			})
	);

	const selectedAgent = $derived(
		agentsList.find((a) => String(a.id) === String(headAgentId)) || null
	);

	const selectedCustomer = $derived(
		headsList.find((h) => String(h.id) === String(headCustomerId)) || null
	);

	const selectedHeadEntity = $derived(
		headEntityType === 'agent' ? selectedAgent : selectedCustomer
	);

	const selectedHeadEntityName = $derived.by(() => {
		if (headEntityType === 'agent' && selectedAgent) {
			return selectedAgent.fullName || `${selectedAgent.firstName || ''} ${selectedAgent.lastName || ''}`.trim() || `Agent #${selectedAgent.id}`;
		}
		if (headEntityType === 'customer' && selectedCustomer) {
			return `${selectedCustomer.firstName || ''} ${selectedCustomer.lastName || ''}`.trim() || selectedCustomer.name || `Customer #${selectedCustomer.id}`;
		}
		return '';
	});

	const selectedHeadEntityBalance = $derived(
		Number(selectedHeadEntity?.wallet || 0)
	);

	const calculatedHeadBalanceAfter = $derived.by(() => {
		const numAmt = parseFloat(headAmount || '0') || 0;
		return selectedHeadEntityBalance - numAmt;
	});

	const selectedHeadCashAccount = $derived(
		cashAccounts.find((a) => String(a.id) === String(headSourceAccountId)) || null
	);

	const selectedHeadBankAccount = $derived(
		bankAccounts.find((b) => String(b.id) === String(headSourceBankId)) || null
	);

	const calculatedSalaryNet = $derived.by(() => {
		const basic = Number(salaryForm.basicSalary) || 0;
		const inc = Number(salaryForm.incentive) || 0;
		const bonus = Number(salaryForm.bonus) || 0;
		const allow = Number(salaryForm.allowance) || 0;
		const ded = Number(salaryForm.deduction) || 0;
		return Math.max(0, basic + inc + bonus + allow - ded);
	});

	async function loadDropdowns() {
		try {
			const [headersList, cashList, bankList, supplierList, salaryProfList, agentsRes, headsRes] = await Promise.all([
				getExpenseHeaders().catch(() => []),
				getAccounts().catch(() => []),
				getBanks().catch(() => []),
				apiFetch<SupplierOption[]>('/api/supplier').catch(() => []),
				getSalaryProfiles().catch(() => []),
				apiFetch<any[]>('/api/agent').catch(() => []),
				apiFetch<any>('/api/sales-entries/heads?pageSize=500').catch(() => [])
			]);
			categories = Array.isArray(headersList) ? headersList : (headersList as any)?.items || [];
			cashAccounts = (Array.isArray(cashList) ? cashList : (cashList as any)?.items || []).filter((a: any) => a.isActive);
			bankAccounts = (Array.isArray(bankList) ? bankList : (bankList as any)?.items || []).filter((b: any) => b.isActive);
			suppliers = Array.isArray(supplierList) ? supplierList : (supplierList as any)?.items || [];
			salaryProfiles = Array.isArray(salaryProfList) ? salaryProfList : (salaryProfList as any)?.items || [];
			agentsList = Array.isArray(agentsRes) ? agentsRes : (agentsRes as any)?.items || [];
			headsList = Array.isArray(headsRes) ? headsRes : (headsRes as any)?.items || [];

			if (cashAccounts.length > 0) {
				if (!salaryForm.cashAccountId) salaryForm.cashAccountId = cashAccounts[0]?.id ?? null;
				if (!sourceAccountIdVal) sourceAccountIdVal = String(cashAccounts[0]?.id ?? '');
				if (!headSourceAccountId) headSourceAccountId = String(cashAccounts[0]?.id ?? '');
			}
			if (bankAccounts.length > 0) {
				if (!salaryForm.bankAccountId) salaryForm.bankAccountId = bankAccounts[0]?.id ?? null;
				if (!sourceBankIdVal) sourceBankIdVal = String(bankAccounts[0]?.id ?? '');
				if (!headSourceBankId) headSourceBankId = String(bankAccounts[0]?.id ?? '');
			}
		} catch (err: any) {
			addToast(err.message || 'Failed to load form dropdown data.', 'error');
		} finally {
			isLoadingData = false;
		}
	}

	function handleTabSwitch(tab: 'general' | 'supplier' | 'head' | 'salary' | 'contra') {
		activeTab = tab;
		if (tab === 'supplier' && !supplierPaymentType) {
			supplierPaymentType = 'supplier_wallet';
		}
		if (tab === 'head') {
			updateHeadDescription();
		}
	}

	function updateHeadDescription() {
		const entName = selectedHeadEntityName || (headEntityType === 'agent' ? 'Agent' : 'Customer');
		headDescription = `Withdrawal from ${headEntityType === 'agent' ? 'Agent' : 'Customer'} balance for ${entName}`;
	}

	async function handleHeadSubmit() {
		const selectedId = headEntityType === 'agent' ? headAgentId : headCustomerId;
		if (!selectedId) {
			addToast(`Please select a ${headEntityType === 'agent' ? 'Agent' : 'Customer Head'}.`, 'error');
			return;
		}

		if (selectedHeadEntity && selectedHeadEntityBalance <= 0) {
			addToast('Cannot withdraw negative balance or zero balance.', 'error');
			return;
		}

		const numAmt = parseFloat(headAmount);
		if (isNaN(numAmt) || numAmt <= 0) {
			addToast('Amount must be greater than zero.', 'error');
			return;
		}

		if (selectedHeadEntity && numAmt > selectedHeadEntityBalance) {
			addToast(`Withdrawal amount cannot exceed available balance (${selectedHeadEntityBalance.toFixed(3)} BHD).`, 'error');
			return;
		}

		if (headPaymentMethod === 'cash' && !headSourceAccountId) {
			addToast('Please select a Cash Account.', 'error');
			return;
		}

		if (headPaymentMethod === 'bank' && !headSourceBankId) {
			addToast('Please select a Bank Account.', 'error');
			return;
		}

		isSubmitting = true;
		try {
			const recipientType = headEntityType === 'agent' ? 'Agent' : 'Head';
			const recipientId = Number(selectedId);
			const desc = headDescription.trim() || `Wallet withdrawal for ${selectedHeadEntityName}`;

			// Outgoing transaction: Paid out from Cash/Bank -> Debits Agent or Customer Wallet
			const payload = {
				sourceAccountId: headPaymentMethod === 'cash' ? Number(headSourceAccountId) : null,
				sourceBankId: headPaymentMethod === 'bank' ? Number(headSourceBankId) : null,
				amount: numAmt,
				paymentMethod: headPaymentMethod === 'cash' ? 'cash' : 'bank',
				referenceType: 'wallet_withdrawal',
				referenceId: headReference.trim() || null,
				description: desc,
				recipientType,
				recipientId
			};

			await createOutgoingTransaction(payload, idempotentOp.key);
			idempotentOp.retire();

			const isMaster = hasRole('master_accountant');
			if (isMaster) {
				addToast(`Successfully processed withdrawal of ${numAmt.toFixed(3)} BHD for ${selectedHeadEntityName}.`, 'success');
				goto('/payments');
			} else {
				addToast('Head balance withdrawal request submitted for Master Accountant approval.', 'info');
				goto('/payments');
			}
		} catch (err: any) {
			addToast(err.message || 'Failed to process head balance withdrawal.', 'error');
		} finally {
			isSubmitting = false;
		}
	}

	async function handleContraSubmit() {
		if (contraForm.sourceType === 'account' && !contraForm.sourceAccountId) {
			addToast('Source Cash Account is required.', 'error');
			return;
		}
		if (contraForm.sourceType === 'bank' && !contraForm.sourceBankId) {
			addToast('Source Bank Account is required.', 'error');
			return;
		}
		if (contraForm.destinationType === 'account' && !contraForm.destinationAccountId) {
			addToast('Destination Cash Account is required.', 'error');
			return;
		}
		if (contraForm.destinationType === 'bank' && !contraForm.destinationBankId) {
			addToast('Destination Bank Account is required.', 'error');
			return;
		}
		const numAmt = Number(contraForm.amount);
		if (isNaN(numAmt) || numAmt <= 0) {
			addToast('Amount must be greater than zero.', 'error');
			return;
		}

		if (
			contraForm.sourceType === contraForm.destinationType &&
			(contraForm.sourceType === 'account'
				? String(contraForm.sourceAccountId) === String(contraForm.destinationAccountId)
				: String(contraForm.sourceBankId) === String(contraForm.destinationBankId))
		) {
			addToast('Source and Destination cannot be the exact same account.', 'error');
			return;
		}

		isSubmitting = true;
		try {
			const payload = {
				sourceAccountId:
					contraForm.sourceType === 'account' ? Number(contraForm.sourceAccountId) : null,
				sourceBankId:
					contraForm.sourceType === 'bank' ? Number(contraForm.sourceBankId) : null,
				destinationAccountId:
					contraForm.destinationType === 'account'
						? Number(contraForm.destinationAccountId)
						: null,
				destinationBankId:
					contraForm.destinationType === 'bank'
						? Number(contraForm.destinationBankId)
						: null,
				amount: numAmt,
				description: contraForm.description.trim() || null
			};

			await createContraTransaction(payload, idempotentOp.key);
			idempotentOp.retire();

			const isMaster = hasRole('master_accountant');
			if (isMaster) {
				addToast('Contra transfer processed and balances updated.', 'success');
				goto('/payments');
			} else {
				addToast('Contra transfer submitted for Master Accountant approval.', 'info');
				goto('/payments');
			}
		} catch (err: any) {
			addToast(err.message || 'Failed to post contra transfer.', 'error');
		} finally {
			isSubmitting = false;
		}
	}

	function onSalaryProfileSelected(profId: number) {
		selectedSalaryProfileId = profId;
		salaryForm.salaryProfileId = profId;
		const prof = (salaryProfiles || []).find((p) => p && p.id === profId);
		if (prof) {
			salaryForm.basicSalary = prof.basicSalary || 0;
			salaryForm.incentive = prof.defaultMonthlyIncentive || 0;
		}
	}

	function handleSalaryPaymentMethodChange(method: 'Cash Account' | 'Bank Account') {
		salaryForm.paymentMethod = method;
		if (method === 'Cash Account') {
			salaryForm.bankAccountId = null;
			if (cashAccounts.length > 0) salaryForm.cashAccountId = cashAccounts[0]?.id ?? null;
		} else {
			salaryForm.cashAccountId = null;
			if (bankAccounts.length > 0) salaryForm.bankAccountId = bankAccounts[0]?.id ?? null;
		}
	}

	function handleSupplierChange(id: string) {
		supplierIdVal = id;
		const sup = suppliers.find((s) => String(s.id) === id);
		if (sup) {
			if (sup.wallet < 0 && !amount) {
				amount = Math.abs(sup.wallet).toFixed(3);
			}
			if (supplierPaymentType === 'supplier_refund') {
				description = `Refund from ${sup.name}`;
			} else {
				description = sup.wallet < 0 ? `Settling balance for ${sup.name}` : `Supplier payment for ${sup.name}`;
			}
		}
	}

	function handleSupplierOperationChange(type: string) {
		supplierPaymentType = (type === 'supplier_credit' || type === 'supplier_advance') ? 'supplier_wallet' : type;
		if (selectedSupplier) {
			if (supplierPaymentType === 'supplier_refund') {
				description = `Refund received from ${selectedSupplier.name}`;
			} else {
				if (selectedSupplier.wallet < 0 && !amount) {
					amount = Math.abs(selectedSupplier.wallet).toFixed(3);
				}
				description = selectedSupplier.wallet < 0 ? `Settling balance for ${selectedSupplier.name}` : `Supplier payment for ${selectedSupplier.name}`;
			}
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (activeTab === 'head') {
			await handleHeadSubmit();
			return;
		}

		if (activeTab === 'contra') {
			await handleContraSubmit();
			return;
		}

		if (activeTab === 'salary') {
			if (!salaryForm.salaryProfileId || salaryForm.salaryProfileId === 0) {
				addToast('Please select an employee profile.', 'error');
				return;
			}
			if (salaryForm.paymentMethod === 'Cash Account' && !salaryForm.cashAccountId) {
				addToast('Please select a Cash Account.', 'error');
				return;
			}
			if (salaryForm.paymentMethod === 'Bank Account' && !salaryForm.bankAccountId) {
				addToast('Please select a Bank Account.', 'error');
				return;
			}

			isSubmitting = true;
			try {
				const isMaster = hasRole('master_accountant');
				const targetStatus = isMaster ? 'Paid' : 'Pending';
				const payload: CreateSalaryPaymentPayload = {
					...salaryForm,
					status: targetStatus,
					paymentDate: salaryForm.paymentDate || getBahrainDateString(),
					cashAccountId: salaryForm.paymentMethod === 'Cash Account' ? salaryForm.cashAccountId : null,
					bankAccountId: salaryForm.paymentMethod === 'Bank Account' ? salaryForm.bankAccountId : null
				};
				await createSalaryPayment(payload);
				addToast(
					isMaster
						? 'Salary payout processed and auto-approved.'
						: 'Salary payout submitted for Master Accountant approval.',
					'success'
				);
				goto('/payments');
			} catch (err: any) {
				addToast(err.message || 'Failed to process salary payout.', 'error');
			} finally {
				isSubmitting = false;
			}
			return;
		}

		const parsedAmount = parseFloat(amount);
		if (isNaN(parsedAmount) || parsedAmount < 0) {
			addToast('Amount must be zero or a positive number.', 'error');
			return;
		}

		if (!description.trim()) {
			addToast('Please enter a description.', 'error');
			return;
		}

		if (paymentMethod === 'cash' && !sourceAccountIdVal) {
			addToast(`Please select a ${sourceLabel} Cash Account.`, 'error');
			return;
		}

		if ((paymentMethod === 'bank' || paymentMethod === 'bank_transfer') && !sourceBankIdVal) {
			addToast(`Please select a ${sourceLabel} Bank Account.`, 'error');
			return;
		}

		if (isSupplierTransaction) {
			if (!supplierIdVal) {
				addToast('Please select a Supplier.', 'error');
				return;
			}

			isSubmitting = true;
			try {
				const supplierId = parseInt(supplierIdVal);
				const sourceAccountIdStr =
					paymentMethod === 'cash'
						? (sourceAccountIdVal ? `account_${sourceAccountIdVal}` : null)
						: (sourceBankIdVal ? `bank_${sourceBankIdVal}` : null);

				await createSupplierPayment({
					supplierId,
					amount: parsedAmount,
					paymentMethod,
					sourceAccountId: sourceAccountIdStr,
					referenceNumber: referenceNumber.trim() ? referenceNumber.trim() : null,
					serviceType: supplierPaymentType,
					description: description.trim(),
					supplierName: selectedSupplier?.name || ''
				}, idempotentOp.key);
				idempotentOp.retire();

				const isMaster = hasRole('master_accountant');
				const returnUrl = $page.url.searchParams.get('supplierId') ? '/suppliers' : '/payments';

				if (isMaster) {
					addToast('Supplier payment recorded and approved successfully.', 'success');
					goto(returnUrl);
				} else {
					addToast('Supplier payment request submitted for Master Accountant approval.', 'info');
					goto(returnUrl);
				}
			} catch (err: any) {
				addToast(err.message || 'Failed to log supplier transaction.', 'error');
			} finally {
				isSubmitting = false;
			}
			return;
		}

		if (!expenseCategoryIdVal) {
			addToast('Please select an Account Category Header.', 'error');
			return;
		}

		isSubmitting = true;
		try {
			const categoryId = parseInt(expenseCategoryIdVal);
			const sourceAccountId = paymentMethod === 'cash' ? parseInt(sourceAccountIdVal) : null;
			const sourceBankId =
				paymentMethod === 'bank' || paymentMethod === 'bank_transfer'
					? parseInt(sourceBankIdVal)
					: null;

			await createExpense({
				expenseCategoryId: categoryId,
				amount: parsedAmount,
				description: description.trim(),
				paymentMethod,
				sourceAccountId,
				sourceBankId,
				notes: notes.trim() ? notes.trim() : null,
				expenseDate: expenseDate || getBahrainDateString()
			});

			addToast('Financial transaction recorded successfully.', 'success');
			goto('/payments');
		} catch (err: any) {
			addToast(err.message || 'Failed to log transaction.', 'error');
		} finally {
			isSubmitting = false;
		}
	}

	onMount(async () => {
		await loadDropdowns();

		const queryTab = $page.url.searchParams.get('tab');
		const queryProfileId = $page.url.searchParams.get('profileId');
		if (queryTab === 'contra' || queryTab === 'transfer') {
			activeTab = 'contra';
		} else if (queryTab === 'head' || queryTab === 'wallet' || queryTab === 'agent' || queryTab === 'customer') {
			activeTab = 'head';
			headOperationType = 'withdraw';

			const queryAgentId = $page.url.searchParams.get('agentId');
			const queryHeadId = $page.url.searchParams.get('headId') || $page.url.searchParams.get('customerId');
			if (queryAgentId) {
				headEntityType = 'agent';
				headAgentId = queryAgentId;
			} else if (queryHeadId) {
				headEntityType = 'customer';
				headCustomerId = queryHeadId;
			}
			updateHeadDescription();
		} else if (queryTab === 'salary' || queryProfileId) {
			activeTab = 'salary';
			if (queryProfileId) {
				const profId = parseInt(queryProfileId, 10);
				if (!isNaN(profId)) {
					onSalaryProfileSelected(profId);
				}
			}
		}

		const querySupplierId = $page.url.searchParams.get('supplierId');
		const queryType = $page.url.searchParams.get('type');

		if (querySupplierId) {
			activeTab = 'supplier';
			supplierIdVal = querySupplierId;
			if (queryType) {
				supplierPaymentType = (queryType === 'supplier_credit' || queryType === 'supplier_advance') ? 'supplier_wallet' : queryType;
			}

			const foundSup = suppliers.find((s) => String(s.id) === querySupplierId);
			if (foundSup) {
				if (foundSup.wallet < 0) {
					amount = Math.abs(foundSup.wallet).toFixed(3);
					description = `Settling balance for ${foundSup.name}`;
				} else {
					description = `Supplier payment for ${foundSup.name}`;
				}
			}
		}
	});
</script>

<svelte:head>
	<title>Log Transaction — Accounts Portal</title>
</svelte:head>

<div class="max-w-2xl mx-auto space-y-6 pb-12">
	<!-- Header -->
	<div class="space-y-2">
		<button
			onclick={() => goto('/payments')}
			class="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
		>
			<ArrowLeft class="h-3.5 w-3.5" />
			Back to Treasury Payments
		</button>
		<div class="flex items-center justify-between">
			<div class="space-y-1">
				<h1 class="text-xl font-bold text-foreground tracking-tight">Log Financial Transaction</h1>
				<p class="text-xs text-muted-foreground">
					Record treasury payouts, general expenses, head balance deposits/withdrawals, or supplier wallet & credit settlements.
				</p>
			</div>
			{#if direction === 'incoming'}
				<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-xs">
					<ArrowDownLeft class="h-3.5 w-3.5" /> Incoming Receipt
				</span>
			{:else}
				<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 shadow-xs">
					<ArrowUpRight class="h-3.5 w-3.5" /> Outgoing Payout
				</span>
			{/if}
		</div>
	</div>

	<!-- Mode Switcher Tabs -->
	<div class="bg-muted/40 p-1 rounded-2xl border border-border/80 flex flex-wrap sm:flex-nowrap items-center gap-1">
		<button
			type="button"
			onclick={() => handleTabSwitch('general')}
			class="flex-1 py-2 px-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer {activeTab === 'general' ? 'bg-card text-foreground shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'}"
		>
			<Receipt class="h-3.5 w-3.5 text-primary" />
			<span>General</span>
		</button>
		<button
			type="button"
			onclick={() => handleTabSwitch('supplier')}
			class="flex-1 py-2 px-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer {activeTab === 'supplier' ? 'bg-purple-600 text-white shadow-sm font-bold' : 'text-muted-foreground hover:text-foreground'}"
		>
			<Coins class="h-3.5 w-3.5" />
			<span>Supplier</span>
		</button>
		<button
			type="button"
			onclick={() => handleTabSwitch('head')}
			class="flex-1 py-2 px-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer {activeTab === 'head' ? 'bg-emerald-600 text-white shadow-sm font-bold' : 'text-muted-foreground hover:text-foreground'}"
		>
			<Users class="h-3.5 w-3.5" />
			<span>Head Balance</span>
		</button>
		<button
			type="button"
			onclick={() => handleTabSwitch('salary')}
			class="flex-1 py-2 px-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer {activeTab === 'salary' ? 'bg-amber-600 text-white shadow-sm font-bold' : 'text-muted-foreground hover:text-foreground'}"
		>
			<Wallet class="h-3.5 w-3.5" />
			<span>Salary</span>
		</button>
		<button
			type="button"
			onclick={() => handleTabSwitch('contra')}
			class="flex-1 py-2 px-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer {activeTab === 'contra' ? 'bg-amber-500 text-white shadow-sm font-bold' : 'text-muted-foreground hover:text-foreground'}"
		>
			<ArrowRightLeft class="h-3.5 w-3.5" />
			<span>Contra</span>
		</button>
	</div>

	<!-- Form Card -->
	<form
		onsubmit={handleSubmit}
		class="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-5 text-xs"
	>
		<!-- ════════════════════════════════════════════════════════════════════════ -->
		<!-- TAB 1: HEAD BALANCE WITHDRAWAL (AGENTS & CUSTOMERS)                      -->
		<!-- ════════════════════════════════════════════════════════════════════════ -->
		{#if activeTab === 'head'}
			<div class="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl space-y-4 animate-in fade-in duration-200">
				<div class="flex items-center justify-between pb-2 border-b border-border/60">
					<div class="flex items-center gap-2">
						<Users class="h-4 w-4 text-rose-600" />
						<span class="font-bold text-foreground">Head Balance Withdrawal</span>
					</div>
					<span class="text-[11px] text-muted-foreground font-medium">Agents & Customers</span>
				</div>

				<!-- Step 1: Entity Type Selector (Customer vs Agent) -->
				<div class="space-y-1.5 pt-1">
					<span class="block font-semibold text-muted-foreground">1. Select Entity Type</span>
					<div class="grid grid-cols-2 gap-2 bg-muted/30 p-1 rounded-xl">
						<button
							type="button"
							class={['py-2 text-center rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5',
								headEntityType === 'customer'
									? 'bg-card text-foreground font-bold shadow-xs border border-border'
									: 'text-muted-foreground hover:text-foreground'
							].join(' ')}
							onclick={() => {
								headEntityType = 'customer';
								updateHeadDescription();
							}}
						>
							<User class="h-3.5 w-3.5 text-primary" />
							<span>Customer</span>
						</button>
						<button
							type="button"
							class={['py-2 text-center rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5',
								headEntityType === 'agent'
									? 'bg-card text-foreground font-bold shadow-xs border border-border'
									: 'text-muted-foreground hover:text-foreground'
							].join(' ')}
							onclick={() => {
								headEntityType = 'agent';
								updateHeadDescription();
							}}
						>
							<Building2 class="h-3.5 w-3.5 text-primary" />
							<span>Agents</span>
						</button>
					</div>
				</div>

				<!-- Step 2: Entity Picker -->
				<div class="space-y-1.5 pt-1">
					{#if headEntityType === 'customer'}
						<label for="head-customer-select" class="block font-semibold text-foreground">
							Select Customer <span class="text-red-500">*</span>
						</label>
						<SearchableSelect
							id="head-customer-select"
							options={customerOptions}
							bind:value={headCustomerId}
							placeholder="-- Search & Select Customer --"
							searchPlaceholder="Search customer name, phone, or balance..."
							required
							onchange={() => updateHeadDescription()}
						/>
					{:else}
						<label for="head-agent-select" class="block font-semibold text-foreground">
							Select Agent <span class="text-red-500">*</span>
						</label>
						<SearchableSelect
							id="head-agent-select"
							options={agentOptions}
							bind:value={headAgentId}
							placeholder="-- Search & Select Agent --"
							searchPlaceholder="Search agent name, phone, or balance..."
							required
							onchange={() => updateHeadDescription()}
						/>
					{/if}
				</div>

				<!-- Live Balance Preview Banner -->
				{#if selectedHeadEntity}
					{#if selectedHeadEntityBalance <= 0}
						<div class="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in duration-200">
							<AlertCircle class="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
							<div>
								<div class="font-bold">Cannot withdraw negative balance or zero balance</div>
								<div class="text-[11px] opacity-90 mt-0.5">
									{selectedHeadEntityName} has {selectedHeadEntityBalance < 0 ? 'a negative' : 'a zero'} balance of <strong class="font-mono">{selectedHeadEntityBalance.toFixed(3)} BHD</strong>. Payout withdrawals can only be made from positive wallet credit.
								</div>
							</div>
						</div>
					{/if}

					<div class="p-3 bg-background border border-border rounded-xl space-y-2">
						<div class="flex items-center justify-between text-xs pb-1.5 border-b border-border/60">
							<span class="font-bold text-foreground">{selectedHeadEntityName}</span>
							<span class="text-[10px] uppercase font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
								{headEntityType}
							</span>
						</div>
						<div class="grid grid-cols-3 gap-2 text-center">
							<div class="p-2 bg-muted/40 rounded-lg">
								<span class="text-[10px] text-muted-foreground block font-medium">Current Balance</span>
								<span class="text-xs font-bold font-mono {selectedHeadEntityBalance <= 0 ? 'text-rose-600' : 'text-foreground'} block">
									<MoneyDisplay amount={selectedHeadEntityBalance} />
								</span>
							</div>
							<div class="p-2 bg-muted/40 rounded-lg">
								<span class="text-[10px] text-muted-foreground block font-medium">Txn Amount</span>
								<span class="text-xs font-bold font-mono text-rose-600 block">
									-{parseFloat(headAmount || '0').toFixed(3)} BHD
								</span>
							</div>
							<div class="p-2 bg-muted/40 rounded-lg">
								<span class="text-[10px] text-muted-foreground block font-medium">Balance After</span>
								<span class="text-xs font-bold font-mono text-primary block">
									<MoneyDisplay amount={calculatedHeadBalanceAfter} />
								</span>
							</div>
						</div>
					</div>
				{/if}

				<!-- Step 3: Paying Company Account (Cash / Bank) -->
				<div class="space-y-3 pt-2 border-t border-border/50">
					<div class="space-y-1.5">
						<span class="block font-semibold text-muted-foreground">
							Paying Company Account
						</span>
						<div class="grid grid-cols-2 gap-2 bg-muted/30 p-1 rounded-xl">
							<button
								type="button"
								class={['py-2 text-center rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5',
									headPaymentMethod === 'cash'
										? 'bg-card text-foreground font-bold shadow-xs border border-border'
										: 'text-muted-foreground hover:text-foreground'
								].join(' ')}
								onclick={() => headPaymentMethod = 'cash'}
							>
								<Coins class="h-3.5 w-3.5 text-primary" />
								<span>Cash Account</span>
							</button>
							<button
								type="button"
								class={['py-2 text-center rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5',
									headPaymentMethod === 'bank'
										? 'bg-card text-foreground font-bold shadow-xs border border-border'
										: 'text-muted-foreground hover:text-foreground'
								].join(' ')}
								onclick={() => headPaymentMethod = 'bank'}
							>
								<Landmark class="h-3.5 w-3.5 text-primary" />
								<span>Bank Account</span>
							</button>
						</div>
					</div>

					{#if headPaymentMethod === 'cash'}
						<div class="space-y-1.5 animate-in fade-in duration-200">
							<label for="head-cash-acc" class="font-semibold text-foreground flex items-center justify-between">
								<span>Cash Drawer Account</span>
								{#if selectedHeadCashAccount}
									<span class="text-[10px] font-mono text-emerald-600 font-bold">
										Bal: {selectedHeadCashAccount.currentBalance.toFixed(3)} BHD
									</span>
								{/if}
							</label>
							<select
								id="head-cash-acc"
								bind:value={headSourceAccountId}
								class="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/30"
							>
								<option value="">-- Select Cash Account --</option>
								{#each cashAccounts as acc}
									<option value={String(acc.id)}>
										{acc.name} ({acc.currentBalance.toFixed(3)} BHD)
									</option>
								{/each}
							</select>
						</div>
					{:else}
						<div class="space-y-1.5 animate-in fade-in duration-200">
							<label for="head-bank-acc" class="font-semibold text-foreground flex items-center justify-between">
								<span>Bank Account</span>
								{#if selectedHeadBankAccount}
									<span class="text-[10px] font-mono text-emerald-600 font-bold">
										Bal: {selectedHeadBankAccount.currentBalance.toFixed(3)} BHD
									</span>
								{/if}
							</label>
							<select
								id="head-bank-acc"
								bind:value={headSourceBankId}
								class="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/30"
							>
								<option value="">-- Select Bank Account --</option>
								{#each bankAccounts as b}
									<option value={String(b.id)}>
										{b.bankName} ({b.accountNumber}) — Bal: {b.currentBalance.toFixed(3)} BHD
									</option>
								{/each}
							</select>
						</div>
					{/if}
				</div>

				<!-- Step 4: Amount & Reference Number -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
					<div class="space-y-1.5">
						<label for="head-amount-input" class="font-semibold text-foreground flex items-center justify-between">
							<span>Amount (BHD) <span class="text-red-500">*</span></span>
							{#if selectedHeadEntity && selectedHeadEntityBalance > 0}
								<button
									type="button"
									onclick={() => headAmount = selectedHeadEntityBalance.toFixed(3)}
									class="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
								>
									Max ({selectedHeadEntityBalance.toFixed(3)})
								</button>
							{/if}
						</label>
						<input
							id="head-amount-input"
							type="number"
							step="0.001"
							min="0.001"
							placeholder="0.000"
							class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/30 font-mono font-bold"
							bind:value={headAmount}
							required
						/>
					</div>

					<div class="space-y-1.5">
						<label for="head-ref-input" class="font-semibold text-foreground">
							Reference / Cheque / Slip No.
						</label>
						<input
							id="head-ref-input"
							type="text"
							placeholder="e.g. SLIP-9923 / CHQ-1048"
							class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/30"
							bind:value={headReference}
						/>
					</div>
				</div>

				<!-- Description -->
				<div class="space-y-1.5">
					<label for="head-desc-input" class="font-semibold text-foreground">Description / Narrative <span class="text-red-500">*</span></label>
					<input
						id="head-desc-input"
						type="text"
						required
						placeholder="Purpose of head balance withdrawal..."
						class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/30 text-foreground"
						bind:value={headDescription}
					/>
				</div>
			</div>

		<!-- ════════════════════════════════════════════════════════════════════════ -->
		<!-- TAB 2: CONTRA TRANSFER                                                  -->
		<!-- ════════════════════════════════════════════════════════════════════════ -->
		{:else if activeTab === 'contra'}
			<div class="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-4 animate-in fade-in duration-200">
				<!-- SOURCE FUNDING ACCOUNT -->
				<div class="border border-border/80 p-4 rounded-xl bg-background space-y-3">
					<h3 class="font-bold text-muted-foreground uppercase tracking-wider text-[10px] pb-1 border-b border-border/50">
						SOURCE FUNDING ACCOUNT
					</h3>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<span class="block font-semibold text-muted-foreground mb-1.5">Source Type</span>
							<div class="flex gap-2 bg-muted/30 p-1 rounded-xl">
								<button
									type="button"
									class="flex-1 py-2 text-center rounded-lg font-semibold transition-all cursor-pointer {contraForm.sourceType === 'account' ? 'bg-card text-foreground shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'}"
									onclick={() => contraForm.sourceType = 'account'}
								>
									Cash Account
								</button>
								<button
									type="button"
									class="flex-1 py-2 text-center rounded-lg font-semibold transition-all cursor-pointer {contraForm.sourceType === 'bank' ? 'bg-card text-foreground shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'}"
									onclick={() => contraForm.sourceType = 'bank'}
								>
									Bank Account
								</button>
							</div>
						</div>

						{#if contraForm.sourceType === 'account'}
							<div>
								<label for="contra-src-acc" class="block font-semibold text-muted-foreground mb-1.5">Cash Account</label>
								<select
									id="contra-src-acc"
									bind:value={contraForm.sourceAccountId}
									class="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
								>
									<option value="">Select Cash Account</option>
									{#each cashAccounts as a}
										<option value={a.id}>{a.name} ({a.currentBalance.toFixed(3)} BHD)</option>
									{/each}
								</select>
							</div>
						{:else}
							<div>
								<label for="contra-src-bank" class="block font-semibold text-muted-foreground mb-1.5">Bank Account</label>
								<select
									id="contra-src-bank"
									bind:value={contraForm.sourceBankId}
									class="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
								>
									<option value="">Select Bank Account</option>
									{#each bankAccounts as b}
										<option value={b.id}>{b.bankName} ({b.accountNumber}) - {b.currentBalance.toFixed(3)} BHD</option>
									{/each}
								</select>
							</div>
						{/if}
					</div>
				</div>

				<!-- DESTINATION FUNDING ACCOUNT -->
				<div class="border border-border/80 p-4 rounded-xl bg-background space-y-3">
					<h3 class="font-bold text-muted-foreground uppercase tracking-wider text-[10px] pb-1 border-b border-border/50">
						DESTINATION RECEIVING ACCOUNT
					</h3>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<span class="block font-semibold text-muted-foreground mb-1.5">Destination Type</span>
							<div class="flex gap-2 bg-muted/30 p-1 rounded-xl">
								<button
									type="button"
									class="flex-1 py-2 text-center rounded-lg font-semibold transition-all cursor-pointer {contraForm.destinationType === 'account' ? 'bg-card text-foreground shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'}"
									onclick={() => contraForm.destinationType = 'account'}
								>
									Cash Account
								</button>
								<button
									type="button"
									class="flex-1 py-2 text-center rounded-lg font-semibold transition-all cursor-pointer {contraForm.destinationType === 'bank' ? 'bg-card text-foreground shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'}"
									onclick={() => contraForm.destinationType = 'bank'}
								>
									Bank Account
								</button>
							</div>
						</div>

						{#if contraForm.destinationType === 'account'}
							<div>
								<label for="contra-dst-acc" class="block font-semibold text-muted-foreground mb-1.5">Cash Account</label>
								<select
									id="contra-dst-acc"
									bind:value={contraForm.destinationAccountId}
									class="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
								>
									<option value="">Select Cash Account</option>
									{#each cashAccounts as a}
										<option value={a.id}>{a.name} ({a.currentBalance.toFixed(3)} BHD)</option>
									{/each}
								</select>
							</div>
						{:else}
							<div>
								<label for="contra-dst-bank" class="block font-semibold text-muted-foreground mb-1.5">Bank Account</label>
								<select
									id="contra-dst-bank"
									bind:value={contraForm.destinationBankId}
									class="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
								>
									<option value="">Select Bank Account</option>
									{#each bankAccounts as b}
										<option value={b.id}>{b.bankName} ({b.accountNumber}) - {b.currentBalance.toFixed(3)} BHD</option>
									{/each}
								</select>
							</div>
						{/if}
					</div>
				</div>

				<!-- AMOUNT & DESCRIPTION -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
						<label for="contra-amount" class="block font-semibold text-muted-foreground mb-1.5">Amount (BHD) <span class="text-red-500">*</span></label>
						<input
							id="contra-amount"
							type="number"
							step="0.001"
							min="0.001"
							placeholder="0.000"
							bind:value={contraForm.amount}
							class="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/30"
							required
						/>
					</div>
					<div>
						<label for="contra-desc" class="block font-semibold text-muted-foreground mb-1.5">Description (Optional)</label>
						<input
							id="contra-desc"
							type="text"
							placeholder="e.g. Bank cash deposit / Drawer transfer"
							bind:value={contraForm.description}
							class="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
						/>
					</div>
				</div>
			</div>

		<!-- ════════════════════════════════════════════════════════════════════════ -->
		<!-- TAB 3: SALARY PAYOUT                                                    -->
		<!-- ════════════════════════════════════════════════════════════════════════ -->
		{:else if activeTab === 'salary'}
			<div class="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-4 animate-in fade-in duration-200">
				<!-- Employee Profile Selection -->
				<div class="space-y-1.5">
					<label for="salaryProfile" class="font-semibold text-foreground flex items-center justify-between">
						<span>Employee Profile <span class="text-red-500">*</span></span>
						{#if salaryProfiles.length === 0}
							<span class="text-[10px] text-amber-600">No profiles found</span>
						{/if}
					</label>
					<select
						id="salaryProfile"
						class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-foreground"
						value={selectedSalaryProfileId}
						onchange={(e) => onSalaryProfileSelected(parseInt(e.currentTarget.value, 10))}
						required
					>
						<option value={0}>-- Select Employee --</option>
						{#each salaryProfiles as profile}
							<option value={profile.id}>
								{profile.employeeName} ({profile.employeeCode}) - Base: {profile.basicSalary?.toFixed(3)} BHD
							</option>
						{/each}
					</select>
				</div>

				<!-- Payroll Month, Year & Payment Date -->
				<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
					<div class="space-y-1.5">
						<label for="payrollMonth" class="font-semibold text-foreground">Payroll Month</label>
						<select
							id="payrollMonth"
							class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-foreground"
							bind:value={salaryForm.payrollMonth}
						>
							{#each months as month, idx}
								<option value={idx + 1}>{month}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-1.5">
						<label for="payrollYear" class="font-semibold text-foreground">Payroll Year</label>
						<input
							id="payrollYear"
							type="number"
							class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-foreground"
							bind:value={salaryForm.payrollYear}
						/>
					</div>
					<div class="space-y-1.5">
						<label for="salaryPaymentDate" class="font-semibold text-foreground">Payment Date</label>
						<input
							id="salaryPaymentDate"
							type="date"
							class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-foreground"
							bind:value={salaryForm.paymentDate}
						/>
					</div>
				</div>

				<!-- Financial Breakdown Fields -->
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-xl border border-border/60">
					<div class="space-y-1">
						<label for="basicSalary" class="text-[11px] font-semibold text-muted-foreground">Basic Salary</label>
						<input
							id="basicSalary"
							type="number"
							step="0.001"
							class="h-8 w-full bg-background border border-border rounded-lg px-2.5 text-xs text-foreground font-mono"
							bind:value={salaryForm.basicSalary}
						/>
					</div>
					<div class="space-y-1">
						<label for="incentive" class="text-[11px] font-semibold text-muted-foreground">Incentive</label>
						<input
							id="incentive"
							type="number"
							step="0.001"
							class="h-8 w-full bg-background border border-border rounded-lg px-2.5 text-xs text-foreground font-mono"
							bind:value={salaryForm.incentive}
						/>
					</div>
					<div class="space-y-1">
						<label for="bonus" class="text-[11px] font-semibold text-muted-foreground">Bonus</label>
						<input
							id="bonus"
							type="number"
							step="0.001"
							class="h-8 w-full bg-background border border-border rounded-lg px-2.5 text-xs text-foreground font-mono"
							bind:value={salaryForm.bonus}
						/>
					</div>
					<div class="space-y-1">
						<label for="allowance" class="text-[11px] font-semibold text-muted-foreground">Allowance</label>
						<input
							id="allowance"
							type="number"
							step="0.001"
							class="h-8 w-full bg-background border border-border rounded-lg px-2.5 text-xs text-foreground font-mono"
							bind:value={salaryForm.allowance}
						/>
					</div>
					<div class="space-y-1">
						<label for="deduction" class="text-[11px] font-semibold text-muted-foreground">Deductions</label>
						<input
							id="deduction"
							type="number"
							step="0.001"
							class="h-8 w-full bg-background border border-border rounded-lg px-2.5 text-xs text-rose-600 font-mono"
							bind:value={salaryForm.deduction}
						/>
					</div>
					<div class="space-y-1 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20 flex flex-col justify-center">
						<span class="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">Net Payable</span>
						<span class="text-xs font-bold font-mono text-foreground">
							{calculatedSalaryNet.toFixed(3)} BHD
						</span>
					</div>
				</div>

				<!-- Payment Account / Method for Salary -->
				<div class="space-y-3">
					<div class="space-y-1.5">
						<span class="font-semibold text-foreground">Payment Method</span>
						<div class="grid grid-cols-2 gap-2 bg-muted/30 p-1 rounded-xl">
							<button
								type="button"
								class="py-2 text-center rounded-lg font-semibold transition-all cursor-pointer {salaryForm.paymentMethod === 'Cash Account' ? 'bg-card text-foreground shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'}"
								onclick={() => handleSalaryPaymentMethodChange('Cash Account')}
							>
								Cash Account
							</button>
							<button
								type="button"
								class="py-2 text-center rounded-lg font-semibold transition-all cursor-pointer {salaryForm.paymentMethod === 'Bank Account' ? 'bg-card text-foreground shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'}"
								onclick={() => handleSalaryPaymentMethodChange('Bank Account')}
							>
								Bank Account
							</button>
						</div>
					</div>

					{#if salaryForm.paymentMethod === 'Cash Account'}
						<div class="space-y-1.5">
							<label for="salaryCashAcc" class="font-semibold text-foreground">Cash Drawer Account</label>
							<select
								id="salaryCashAcc"
								class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/20"
								bind:value={salaryForm.cashAccountId}
							>
								<option value={null}>-- Select Cash Drawer --</option>
								{#each cashAccounts as acc}
									<option value={acc.id}>{acc.name} ({acc.currentBalance.toFixed(3)} BHD)</option>
								{/each}
							</select>
						</div>
					{:else}
						<div class="space-y-1.5">
							<label for="salaryBankAcc" class="font-semibold text-foreground">Bank Account</label>
							<select
								id="salaryBankAcc"
								class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/20"
								bind:value={salaryForm.bankAccountId}
							>
								<option value={null}>-- Select Bank Account --</option>
								{#each bankAccounts as bank}
									<option value={bank.id}>{bank.bankName} ({bank.currentBalance.toFixed(3)} BHD)</option>
								{/each}
							</select>
						</div>
					{/if}
				</div>

				<!-- Remarks -->
				<div class="space-y-1.5">
					<label for="salaryRemarks" class="font-semibold text-foreground">Remarks / Memo</label>
					<input
						id="salaryRemarks"
						type="text"
						placeholder="e.g. Regular monthly payroll with bonus"
						class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-foreground"
						bind:value={salaryForm.remarks}
					/>
				</div>
			</div>

		<!-- ════════════════════════════════════════════════════════════════════════ -->
		<!-- TAB 4 & 5: GENERAL EXPENSE / INCOME & SUPPLIER WALLET / CREDIT          -->
		<!-- ════════════════════════════════════════════════════════════════════════ -->
		{:else}
			{#if isSupplierTransaction}
				<!-- Supplier Selection & Operation Mode -->
				<div class="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-4 animate-in fade-in duration-200">
					<div class="space-y-1.5">
						<label for="supplierId" class="font-semibold text-foreground flex items-center justify-between">
							<span>Supplier <span class="text-red-500">*</span></span>
							{#if selectedSupplier}
								<span class="text-[11px] font-mono font-bold {selectedSupplier.wallet > 0 ? 'text-emerald-600 dark:text-emerald-400' : selectedSupplier.wallet < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}">
									Balance: {selectedSupplier.wallet > 0 ? '+' : ''}{selectedSupplier.wallet.toFixed(3)} BHD ({selectedSupplier.wallet > 0 ? 'Surplus' : selectedSupplier.wallet < 0 ? 'Debt' : 'Settled'})
								</span>
							{/if}
						</label>
						<select
							id="supplierId"
							class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-foreground disabled:opacity-50"
							disabled={isLoadingData}
							value={supplierIdVal}
							onchange={(e) => handleSupplierChange(e.currentTarget.value)}
							required
						>
							<option value="">-- Select Supplier --</option>
							{#each suppliers as supplier}
								<option value={String(supplier.id)}>
									{supplier.name} ({supplier.code})
								</option>
							{/each}
						</select>
					</div>

					<!-- Supplier Operation Type -->
					<div class="space-y-1.5">
						<span class="font-semibold text-foreground">Supplier Payment Purpose</span>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
							<button
								type="button"
								class="p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 {supplierPaymentType === 'supplier_wallet' ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-background border-border text-foreground hover:bg-muted/40'}"
								onclick={() => handleSupplierOperationChange('supplier_wallet')}
							>
								<div class="flex items-center gap-1.5 font-bold text-xs">
									<Wallet class="h-3.5 w-3.5" />
									<span>Supplier Payment</span>
								</div>
								<span class="text-[10px] opacity-80 leading-tight">Payout / Top-up / Settlement</span>
							</button>

							<button
								type="button"
								class="p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 {supplierPaymentType === 'supplier_refund' ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-background border-border text-foreground hover:bg-muted/40'}"
								onclick={() => handleSupplierOperationChange('supplier_refund')}
							>
								<div class="flex items-center gap-1.5 font-bold text-xs">
									<ArrowDownLeft class="h-3.5 w-3.5" />
									<span>Supplier Refund</span>
								</div>
								<span class="text-[10px] opacity-80 leading-tight">Refund received back from supplier</span>
							</button>
						</div>
					</div>
				</div>
			{:else}
				<!-- General Expense Category Header -->
				<div class="space-y-1.5">
					<label for="expenseCategoryId" class="font-semibold text-foreground flex items-center justify-between">
						<span>Account Category Header <span class="text-red-500">*</span></span>
						{#if selectedCategory}
							<span class="text-[10px] font-bold text-primary px-2 py-0.5 rounded bg-primary/10">
								{categoryBucket}
							</span>
						{/if}
					</label>
					<select
						id="expenseCategoryId"
						class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground disabled:opacity-50"
						disabled={isLoadingData}
						bind:value={expenseCategoryIdVal}
						required
					>
						<option value="">-- Select Category --</option>
						{#each categories as cat}
							<option value={String(cat.id)}>
								{cat.name} ({cat.category || 'Expenses'})
							</option>
						{/each}
					</select>
					<p class="text-[11px] text-muted-foreground">{helpText}</p>
				</div>
			{/if}

			<!-- Amount & Payment Method -->
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div class="space-y-1.5">
					<label for="amount" class="font-semibold text-foreground flex items-center justify-between">
						<span>Amount (BHD) <span class="text-red-500">*</span></span>
						{#if isSupplierTransaction && selectedSupplier && selectedSupplier.wallet < 0}
							<button
								type="button"
								onclick={() => amount = Math.abs(selectedSupplier.wallet).toFixed(3)}
								class="text-[10px] text-purple-600 font-bold hover:underline cursor-pointer"
							>
								Clear Total Debt ({Math.abs(selectedSupplier.wallet).toFixed(3)})
							</button>
						{/if}
					</label>
					<input
						id="amount"
						type="number"
						step="0.001"
						min="0"
						required
						placeholder="0.000"
						class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-mono font-bold"
						bind:value={amount}
					/>
				</div>

				<div class="space-y-1.5">
					<span class="font-semibold text-foreground">Payment Method</span>
					<div class="grid grid-cols-2 gap-2 bg-muted/30 p-1 rounded-xl">
						<button
							type="button"
							class="py-2 text-center rounded-lg font-semibold transition-all cursor-pointer {paymentMethod === 'cash' ? 'bg-card text-foreground shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'}"
							onclick={() => paymentMethod = 'cash'}
						>
							Cash Account
						</button>
						<button
							type="button"
							class="py-2 text-center rounded-lg font-semibold transition-all cursor-pointer {paymentMethod === 'bank' ? 'bg-card text-foreground shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground'}"
							onclick={() => paymentMethod = 'bank'}
						>
							Bank Account
						</button>
					</div>
				</div>
			</div>

			{#if !isSupplierTransaction}
				<div class="space-y-1.5">
					<label for="expenseDate" class="font-semibold text-foreground">
						Payment / Expense Date <span class="text-red-500">*</span>
					</label>
					<input
						id="expenseDate"
						type="date"
						required
						class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
						bind:value={expenseDate}
					/>
				</div>
			{/if}

			<!-- Dynamic Source / Destination Account Selectors -->
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				{#if paymentMethod === 'cash'}
					<div class="space-y-1.5 animate-in fade-in duration-200">
						<label for="sourceAccountId" class="font-semibold text-foreground flex items-center justify-between">
							<span>{sourceLabel} Cash Account</span>
							{#if selectedCashAccount}
								<span class="text-[10px] font-mono text-emerald-600 font-bold">
									Bal: {selectedCashAccount.currentBalance.toFixed(3)} BHD
								</span>
							{/if}
						</label>
						<select
							id="sourceAccountId"
							class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground disabled:opacity-50"
							disabled={isLoadingData}
							bind:value={sourceAccountIdVal}
						>
							<option value="">-- Select {sourceLabel} Cash Account --</option>
							{#each cashAccounts as acc}
								<option value={String(acc.id)}>
									{acc.name} ({acc.currentBalance.toFixed(3)} BHD)
								</option>
							{/each}
						</select>
					</div>
				{:else}
					<div class="space-y-1.5 animate-in fade-in duration-200">
						<label for="sourceBankId" class="font-semibold text-foreground flex items-center justify-between">
							<span>{sourceLabel} Bank Account</span>
							{#if selectedBankAccount}
								<span class="text-[10px] font-mono text-emerald-600 font-bold">
									Bal: {selectedBankAccount.currentBalance.toFixed(3)} BHD
								</span>
							{/if}
						</label>
						<select
							id="sourceBankId"
							class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground disabled:opacity-50"
							disabled={isLoadingData}
							bind:value={sourceBankIdVal}
						>
							<option value="">-- Select {sourceLabel} Bank Account --</option>
							{#each bankAccounts as bank}
								<option value={String(bank.id)}>
									{bank.bankName} ({bank.currentBalance.toFixed(3)} BHD)
								</option>
							{/each}
						</select>
					</div>
				{/if}

				{#if isSupplierTransaction}
					<div class="space-y-1.5 animate-in fade-in duration-200">
						<label for="supplierRefNumber" class="font-semibold text-foreground">
							Supplier Invoice / Ref No. (Optional)
						</label>
						<input
							id="supplierRefNumber"
							type="text"
							placeholder="e.g. INV-99482 / Booking Ref"
							class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/30"
							bind:value={referenceNumber}
						/>
					</div>
				{/if}
			</div>

			<!-- Description -->
			<div class="space-y-1.5">
				<label for="description" class="font-semibold text-foreground">Description / Purpose</label>
				<input
					id="description"
					type="text"
					required
					placeholder={isSupplierTransaction ? "e.g. Supplier wallet top-up / Credit debt settlement" : "e.g. Office rent payment / Equipment purchase"}
					class="h-10 w-full bg-background border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
					bind:value={description}
				/>
			</div>

			<!-- Notes -->
			<div class="space-y-1.5">
				<label for="notes" class="font-semibold text-muted-foreground">Notes / Remarks (Optional)</label>
				<textarea
					id="notes"
					rows="2"
					placeholder="Add internal voucher notes or remarks..."
					class="w-full bg-background border border-border rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground resize-y"
					bind:value={notes}
				></textarea>
			</div>

			<!-- LIVE SUMMARY PREVIEW CARD -->
			{#if amount !== '' && amount !== null && (selectedSupplier || selectedCategory)}
				<div class="p-3.5 bg-primary/5 border border-primary/20 rounded-xl text-xs space-y-1.5 animate-in fade-in duration-200">
					<div class="flex items-center gap-1.5 font-bold text-primary">
						<Sparkles class="h-4 w-4" />
						<span>Transaction Impact Preview</span>
					</div>
					<p class="text-[11px] text-foreground font-medium leading-relaxed">
						{#if isSupplierTransaction && selectedSupplier}
							Posting <strong class="font-mono text-purple-700 dark:text-purple-300">{parseFloat(amount || '0').toFixed(3)} BHD</strong> via
							<strong>{paymentMethod === 'cash' ? (selectedCashAccount?.name || 'Cash Account') : (selectedBankAccount?.bankName || 'Bank Account')}</strong>
							to {selectedSupplier.name} ({supplierPaymentType === 'supplier_refund' ? 'Supplier Refund' : 'Supplier Payment'}).
						{:else if selectedCategory}
							Posting <strong class="font-mono text-primary">{parseFloat(amount || '0').toFixed(3)} BHD</strong> under
							<strong>{selectedCategory.name} ({categoryBucket})</strong> via
							<strong>{paymentMethod === 'cash' ? (selectedCashAccount?.name || 'Cash Account') : (selectedBankAccount?.bankName || 'Bank Account')}</strong>.
						{/if}
					</p>
				</div>
			{/if}
		{/if}

		<!-- Action Buttons -->
		<div class="flex items-center justify-end gap-3 pt-4 border-t border-border">
			<Button
				variant="outline"
				class="rounded-xl px-5 py-4.5 font-semibold cursor-pointer"
				disabled={isSubmitting}
				onclick={() => goto('/payments')}
			>
				Cancel
			</Button>
			<Button
				type="submit"
				class={['rounded-xl px-6 py-4.5 font-semibold cursor-pointer shadow-sm',
					activeTab === 'head' ? (selectedHeadEntity && selectedHeadEntityBalance <= 0 ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700 text-white font-bold') :
					activeTab === 'contra' ? 'bg-amber-500 hover:bg-amber-600 text-white font-bold' :
					activeTab === 'salary' ? 'bg-amber-600 hover:bg-amber-700 text-white' :
					isSupplierTransaction ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''
				].join(' ')}
				disabled={isSubmitting || isLoadingData || (activeTab === 'head' && selectedHeadEntity && selectedHeadEntityBalance <= 0)}
			>
				{isSubmitting ? 'Posting...' :
					activeTab === 'head' && selectedHeadEntity && selectedHeadEntityBalance <= 0 ? 'Cannot Withdraw (Zero/Negative Balance)' :
					activeTab === 'head' ? 'Post Balance Withdrawal' :
					activeTab === 'contra' ? 'Post Contra Transfer' :
					activeTab === 'salary' ? 'Post Salary Payout' :
					isSupplierTransaction ? 'Post Supplier Transaction' : 'Log Transaction'}
			</Button>
		</div>
	</form>
</div>

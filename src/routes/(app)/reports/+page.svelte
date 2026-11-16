<script lang="ts">
	import { goto } from '$app/navigation';
	import { FileText, BarChart2, BookOpen, ChevronRight, TrendingUp, BarChart3 } from 'lucide-svelte';

	const reportLinks = [
		{
			title: 'Profit & Loss Report (Income Statement)',
			description:
				'Comprehensive operational financial statement detailing service revenues, direct supplier costs, overhead expenses, and net profit margins.',
			route: '/reports/profit-loss',
			icon: TrendingUp
		},
		{
			title: 'Salesmen Performance Report',
			description:
				'Audit individual sales team bookings, leads generated, gross booking margins, and finalized profit attribution.',
			route: '/reports/salesmen',
			icon: BarChart3
		},
		{
			title: 'Ledger Account Statement',
			description:
				'Run detailed ledger account statements showing opening, closing and chronological running balances.',
			route: '/reports/statement',
			icon: BookOpen
		},
		{
			title: 'Operational Expense Report',
			description:
				'Compile company expenditure reports, categorize claims, and audit categorical operational costs.',
			route: '/reports/expenses',
			icon: FileText
		}
	];
</script>

<svelte:head>
	<title>Reports Hub — Accounts Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col gap-1">
		<h1 class="text-xl font-bold text-foreground">Reporting Hub</h1>
		<p class="text-xs text-muted-foreground">
			Access financial ledger statements, audit reports, and corporate expense analyses.
		</p>
	</div>

	<!-- Links Grid -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
		{#each reportLinks as link}
			<button
				onclick={() => goto(link.route)}
				class="bg-card border border-border hover:border-primary/40 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all text-left flex flex-col justify-between gap-6 cursor-pointer group text-xs"
			>
				<div class="space-y-3">
					<div
						class="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:scale-105 transition-transform"
					>
						<link.icon class="h-5 w-5" />
					</div>
					<div class="space-y-1">
						<h3
							class="font-bold text-foreground text-sm group-hover:text-primary transition-colors"
						>
							{link.title}
						</h3>
						<p class="text-muted-foreground leading-relaxed">{link.description}</p>
					</div>
				</div>
				<div class="flex items-center text-primary font-semibold gap-1.5 self-end">
					<span>Run Report</span>
					<ChevronRight
						class="h-4 w-4 group-hover:translate-x-0.5 transition-transform"
					/>
				</div>
			</button>
		{/each}
	</div>
</div>

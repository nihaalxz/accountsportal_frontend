<script lang="ts">
	import { page } from '$app/stores';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb';

	const segmentLabels: Record<string, string> = {
		dashboard: 'Dashboard',
		transactions: 'Transactions',
		suppliers: 'Suppliers',
		agents: 'Agents',
		'cash-bank': 'Cash & Bank',
		payments: 'Payments',
		accounting: 'Accounting',
		'chart-of-accounts': 'Chart of Accounts',
		periods: 'Accounting Periods',
		journals: 'Journal Entries',
		ledger: 'General Ledger',
		reconciliation: 'Reconciliation',
		reports: 'Reports',
		payroll: 'Payroll',
		staff: 'Staff Profiles',
		admin: 'Administration'
	};

	const breadcrumbs = $derived(() => {
		const paths = $page.url.pathname.split('/').filter(Boolean);
		let accum = '';

		return paths.map((segment, idx) => {
			accum += `/${segment}`;
			const label = segmentLabels[segment] || segment.replace(/-/g, ' ');
			return {
				label,
				route: accum,
				isLast: idx === paths.length - 1
			};
		});
	});

	const activeBreadcrumbs = $derived(breadcrumbs());
</script>

{#if activeBreadcrumbs.length > 0}
	<Breadcrumb.Root class="select-none">
		<Breadcrumb.List>
			<Breadcrumb.Item>
				<Breadcrumb.Link href="/dashboard">Home</Breadcrumb.Link>
			</Breadcrumb.Item>
			{#each activeBreadcrumbs as bc (bc.route)}
				<Breadcrumb.Separator />
				<Breadcrumb.Item>
					{#if bc.isLast}
						<Breadcrumb.Page>{bc.label}</Breadcrumb.Page>
					{:else}
						<Breadcrumb.Link href={bc.route}>{bc.label}</Breadcrumb.Link>
					{/if}
				</Breadcrumb.Item>
			{/each}
		</Breadcrumb.List>
	</Breadcrumb.Root>
{/if}

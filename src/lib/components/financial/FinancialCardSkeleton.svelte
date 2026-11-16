<script lang="ts">
	/** FinancialCardSkeleton — loading skeleton for card-based financial lists (mobile) */
	interface Props {
		count?: number;
	}
	let { count = 4 }: Props = $props();
</script>

<div class="animate-pulse space-y-3" aria-busy="true" aria-label="Loading financial data...">
	{#each { length: count } as _}
		<div class="bg-card border border-border rounded-2xl p-4 space-y-3">
			<!-- Top row: type chip + amount -->
			<div class="flex items-center justify-between">
				<div class="h-4 w-24 bg-muted rounded-full"></div>
				<div class="h-5 w-20 bg-muted rounded-lg"></div>
			</div>
			<!-- Middle row: reference + date -->
			<div class="flex items-center justify-between">
				<div class="h-3 w-32 bg-muted/70 rounded"></div>
				<div class="h-3 w-16 bg-muted/70 rounded"></div>
			</div>
			<!-- Bottom row: status badge -->
			<div class="h-5 w-16 bg-muted/60 rounded-full"></div>
		</div>
	{/each}
</div>

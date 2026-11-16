<script lang="ts">
	/** FinancialTableSkeleton — loading skeleton for tabular financial data */
	interface Props {
		rows?: number;
		columns?: number;
	}
	let { rows = 5, columns = 6 }: Props = $props();
</script>

<div class="animate-pulse" aria-busy="true" aria-label="Loading financial data...">
	<!-- Header skeleton -->
	<div class="flex gap-4 px-4 py-3 border-b border-border mb-1">
		{#each { length: columns } as _, i}
			<div
				class={[
					'h-3 bg-muted rounded',
					i === 0 ? 'w-16' : i === columns - 1 ? 'w-20' : 'flex-1'
				].join(' ')}
			></div>
		{/each}
	</div>

	<!-- Row skeletons -->
	{#each { length: rows } as _}
		<div class="flex gap-4 px-4 py-4 border-b border-border/50">
			{#each { length: columns } as _, i}
				<div
					class={[
						'h-4 rounded bg-muted/70',
						i === 0 ? 'w-12' : i === 1 ? 'w-20' : i === columns - 1 ? 'w-24' : 'flex-1',
						i % 2 === 0 ? 'opacity-80' : 'opacity-60'
					].join(' ')}
				></div>
			{/each}
		</div>
	{/each}
</div>

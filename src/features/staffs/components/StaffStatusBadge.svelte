<script lang="ts">
	let props = $props<{ isActive: boolean }>();
</script>

{#if props.isActive}
	<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-200/60 text-[10px] font-bold">
		<span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
		Active
	</span>
{:else}
	<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-700 border border-red-200/60 text-[10px] font-bold">
		<span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>
		Inactive
	</span>
{/if}

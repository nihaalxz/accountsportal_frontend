<script lang="ts">
	import { RefreshCw } from 'lucide-svelte';
	let { message = 'Loading staff records...' }: { message?: string } = $props();
</script>

<div class="p-20 flex flex-col items-center justify-center gap-3 text-muted-foreground bg-card border border-border rounded-2xl">
	<div class="h-12 w-12 rounded-full bg-violet-500/10 flex items-center justify-center">
		<RefreshCw class="h-6 w-6 animate-spin text-violet-600" />
	</div>
	<p class="text-xs font-medium">{message}</p>
</div>

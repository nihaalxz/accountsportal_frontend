<script lang="ts">
	import { Users } from 'lucide-svelte';
	let { message = 'No staff records found.' }: { message?: string } = $props();
</script>

<div class="p-16 text-center text-muted-foreground border border-border rounded-2xl bg-card">
	<Users class="h-8 w-8 mx-auto mb-2 opacity-40" />
	<p class="text-xs font-medium">{message}</p>
</div>

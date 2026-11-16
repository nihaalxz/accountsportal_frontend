<script lang="ts">
	import { Search, ChevronDown, Check, X } from 'lucide-svelte';

	interface Option {
		id: string | number;
		name: string;
		subtext?: string;
	}

	let {
		options = [],
		value = $bindable(),
		placeholder = '-- Select --',
		searchPlaceholder = 'Search...',
		id = '',
		disabled = false,
		required = false,
		onchange
	}: {
		options: Option[];
		value: string | number;
		placeholder?: string;
		searchPlaceholder?: string;
		id?: string;
		disabled?: boolean;
		required?: boolean;
		onchange?: (val: any) => void;
	} = $props();

	let open = $state(false);
	let searchQuery = $state('');
	let containerRef = $state<HTMLDivElement | null>(null);

	const selectedOption = $derived(
		options.find((opt) => String(opt.id) === String(value)) || null
	);

	const filteredOptions = $derived(
		options.filter((opt) => {
			if (!searchQuery.trim()) return true;
			const q = searchQuery.toLowerCase().trim();
			return (
				opt.name.toLowerCase().includes(q) ||
				(opt.subtext && opt.subtext.toLowerCase().includes(q))
			);
		})
	);

	function selectOption(opt: Option) {
		value = opt.id;
		open = false;
		searchQuery = '';
		if (onchange) onchange(opt.id);
	}

	function handleOutsideClick(e: MouseEvent) {
		if (containerRef && !containerRef.contains(e.target as Node)) {
			open = false;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
		}
	}
</script>

<svelte:window onclick={handleOutsideClick} onkeydown={handleKeyDown} />

<div class="relative w-full text-xs" bind:this={containerRef}>
	<!-- Trigger Button -->
	<button
		type="button"
		{id}
		{disabled}
		onclick={() => {
			if (!disabled) open = !open;
		}}
		class={[
			'h-9.5 w-full bg-background border rounded-xl px-3 flex items-center justify-between transition-all font-medium text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20',
			open ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground/40',
			disabled ? 'opacity-50 cursor-not-allowed bg-muted/30' : ''
		].join(' ')}
	>
		<span class="truncate pr-2 text-foreground">
			{#if selectedOption}
				{selectedOption.name}
			{:else}
				<span class="text-muted-foreground font-normal">{placeholder}</span>
			{/if}
		</span>
		<ChevronDown class="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 {open ? 'rotate-180 text-primary' : ''}" />
	</button>

	<!-- Dropdown Panel -->
	{#if open}
		<div
			class="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-scaleUp p-1 space-y-1"
		>
			<!-- Search Bar -->
			<div class="relative p-1">
				<Search class="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder={searchPlaceholder}
					class="h-8 w-full bg-muted/40 border border-border/80 rounded-lg pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
					autofocus
				/>
				{#if searchQuery}
					<button
						type="button"
						onclick={() => (searchQuery = '')}
						class="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded"
					>
						<X class="h-3 w-3" />
					</button>
				{/if}
			</div>

			<!-- Options List -->
			<div class="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar pr-0.5">
				{#if filteredOptions.length === 0}
					<div class="py-4 text-center text-xs text-muted-foreground font-medium">
						No results found
					</div>
				{:else}
					{#each filteredOptions as opt (opt.id)}
						{@const isSelected = String(opt.id) === String(value)}
						<button
							type="button"
							onclick={() => selectOption(opt)}
							class={[
								'w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer text-xs',
								isSelected ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted text-foreground'
							].join(' ')}
						>
							<div class="truncate">
								<div class="truncate">{opt.name}</div>
								{#if opt.subtext}
									<div class="text-[10px] text-muted-foreground truncate">{opt.subtext}</div>
								{/if}
							</div>
							{#if isSelected}
								<Check class="h-3.5 w-3.5 text-primary shrink-0 ml-2" />
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Search, ChevronDown, Check, X } from 'lucide-svelte';

	interface PartyOption {
		id: number;
		label: string;
		wallet?: number;
	}

	let {
		items = [],
		selectedId = $bindable(0),
		placeholder = '-- Select Party --',
		id = ''
	}: {
		items: PartyOption[];
		selectedId: number;
		placeholder?: string;
		id?: string;
	} = $props();

	let isOpen = $state(false);
	let searchTerm = $state('');
	let containerRef: HTMLDivElement | null = $state(null);
	let searchInputRef: HTMLInputElement | null = $state(null);

	let selectedItem = $derived(items.find(i => i.id === selectedId));

	let filteredItems = $derived.by(() => {
		const term = searchTerm.trim().toLowerCase();
		if (!term) return items;
		return items.filter(
			i => i.label.toLowerCase().includes(term) || String(i.id).includes(term)
		);
	});

	function toggleOpen() {
		isOpen = !isOpen;
		if (isOpen) {
			searchTerm = '';
			setTimeout(() => {
				searchInputRef?.focus();
			}, 50);
		}
	}

	function selectItem(item: PartyOption) {
		selectedId = item.id;
		isOpen = false;
		searchTerm = '';
	}

	function clearSelection(e: MouseEvent) {
		e.stopPropagation();
		selectedId = 0;
		searchTerm = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			isOpen = false;
		}
	}

	function handleClickOutside(e: MouseEvent) {
		if (containerRef && !containerRef.contains(e.target as Node)) {
			isOpen = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		document.removeEventListener('click', handleClickOutside);
		document.removeEventListener('keydown', handleKeydown);
	});
</script>

<div class="relative w-full text-xs" bind:this={containerRef} {id}>
	<!-- Trigger Select Box -->
	<button
		type="button"
		onclick={toggleOpen}
		class="h-10 w-full bg-background border border-border rounded-xl px-3 flex items-center justify-between gap-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 hover:border-primary/40 transition-colors cursor-pointer text-left"
		aria-haspopup="listbox"
		aria-expanded={isOpen}
	>
		{#if selectedItem}
			<div class="flex items-center justify-between gap-2 flex-1 min-w-0">
				<span class="font-medium truncate">
					{selectedItem.label} <span class="text-muted-foreground font-mono">(ID: {selectedItem.id})</span>
				</span>
				<span class="shrink-0 bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold">
					BHD {(selectedItem.wallet ?? 0).toFixed(3)}
				</span>
			</div>
		{:else}
			<span class="text-muted-foreground/70">{placeholder}</span>
		{/if}

		<div class="flex items-center gap-1 shrink-0 ml-1 text-muted-foreground">
			{#if selectedId > 0}
				<span
					role="button"
					tabindex="0"
					onclick={clearSelection}
					onkeydown={(e) => e.key === 'Enter' && clearSelection(e as any)}
					class="p-0.5 hover:bg-muted hover:text-foreground rounded-md transition-colors cursor-pointer"
					title="Clear selection"
				>
					<X class="h-3.5 w-3.5" />
				</span>
			{/if}
			<ChevronDown class="h-4 w-4 transition-transform duration-150 {isOpen ? 'rotate-180 text-primary' : ''}" />
		</div>
	</button>

	<!-- Dropdown Menu Popup -->
	{#if isOpen}
		<div
			class="absolute top-full left-0 right-0 mt-1.5 z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100 space-y-1"
		>
			<!-- Sticky Searchbar inside Dropdown -->
			<div class="p-2 border-b border-border bg-muted/20">
				<div class="relative">
					<Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
					<input
						bind:this={searchInputRef}
						type="text"
						bind:value={searchTerm}
						placeholder="Search party by name or ID..."
						class="h-8 w-full bg-background border border-border rounded-lg pl-8 pr-7 text-xs text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
					/>
					{#if searchTerm}
						<button
							type="button"
							onclick={() => searchTerm = ''}
							class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
						>
							<X class="h-3 w-3" />
						</button>
					{/if}
				</div>
			</div>

			<!-- Scrollable Options List -->
			<div class="max-h-56 overflow-y-auto p-1 space-y-0.5" role="listbox">
				{#if filteredItems.length === 0}
					<div class="p-4 text-center text-muted-foreground text-xs font-medium">
						No matching parties found.
					</div>
				{:else}
					{#each filteredItems as item (item.id)}
						<button
							type="button"
							onclick={() => selectItem(item)}
							class="w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer {selectedId === item.id ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted/60 text-foreground'}"
							role="option"
							aria-selected={selectedId === item.id}
						>
							<div class="min-w-0 flex-1">
								<div class="font-medium truncate">{item.label}</div>
								<div class="text-[10px] text-muted-foreground font-mono">ID: {item.id}</div>
							</div>
							<div class="flex items-center gap-2 shrink-0">
								<span class="bg-muted/70 text-muted-foreground px-2 py-0.5 rounded-md font-mono text-[10px]">
									BHD {(item.wallet ?? 0).toFixed(3)}
								</span>
								{#if selectedId === item.id}
									<Check class="h-3.5 w-3.5 text-primary" />
								{/if}
							</div>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>

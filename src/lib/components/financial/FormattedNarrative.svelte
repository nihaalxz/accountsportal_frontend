<script lang="ts">
	interface Props {
		text: string | null | undefined;
		class?: string;
	}

	let { text = '', class: className = '' }: Props = $props();

	let tokens = $derived.by(() => {
		if (!text) return [];
		const regex = /(\b\d+\.\d{3}(?:\s*BHD)?\b|\bTX[A-Z0-9]+\b)/gi;
		const parts: { text: string; isBold: boolean; isDocNo?: boolean; isAmount?: boolean }[] = [];
		let lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = regex.exec(text)) !== null) {
			if (match.index > lastIndex) {
				parts.push({ text: text.slice(lastIndex, match.index), isBold: false });
			}
			const matchedStr = match[0];
			const isDocNo = /^TX/i.test(matchedStr);
			const isAmount = /^\d/.test(matchedStr);
			parts.push({ text: matchedStr, isBold: true, isDocNo, isAmount });
			lastIndex = regex.lastIndex;
		}

		if (lastIndex < text.length) {
			parts.push({ text: text.slice(lastIndex), isBold: false });
		}

		return parts;
	});
</script>

<span class={className}>
	{#if !text}
		<span class="text-muted-foreground/60">—</span>
	{:else}
		{#each tokens as token}
			{#if token.isBold}
				{#if token.isAmount}
					<strong class="font-mono font-bold text-foreground">{token.text}</strong>
				{:else if token.isDocNo}
					<strong class="font-mono font-bold text-foreground">{token.text}</strong>
				{:else}
					<strong class="font-bold text-foreground">{token.text}</strong>
				{/if}
			{:else}
				<span>{token.text}</span>
			{/if}
		{/each}
	{/if}
</span>

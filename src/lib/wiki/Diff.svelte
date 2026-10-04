<script lang="ts">
	import type { DiffPart } from '$lib/server/wiki';

	// with `choose`, each change gets an accept checkbox named "accept"
	let { parts, choose = false }: { parts: DiffPart[]; choose?: boolean } = $props();
</script>

<div class="space-y-3">
	{#each parts as part, i (i)}
		{#if part.kind === 'same'}
			<details class="text-sm" style="color: var(--muted)">
				<summary class="cursor-pointer">Unchanged</summary>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- rendered server-side by $lib/wiki/markdown, raw HTML escaped -->
				<div class="wiki-prose opacity-70">{@html part.html}</div>
			</details>
		{:else}
			<section
				class="card space-y-2"
				style:border-color={part.conflict ? 'var(--critical)' : undefined}
			>
				{#if choose}
					<label class="flex items-center gap-2 text-sm font-medium">
						<input
							type="checkbox"
							name="accept"
							value={part.id}
							checked={!part.conflict}
							disabled={part.conflict}
							class="rounded"
						/>
						{part.conflict
							? 'Conflict: this part of the page was edited since. Make this change by hand.'
							: 'Accept this change'}
					</label>
				{/if}
				{#if part.words}
					<p class="wiki-words text-sm whitespace-pre-wrap">
						{#each part.words as w, j (j)}
							{#if w.added}<ins>{w.value}</ins>{:else if w.removed}<del>{w.value}</del
								>{:else}{w.value}{/if}
						{/each}
					</p>
				{:else}
					{#if part.removed}
						<div class="wiki-removed wiki-prose">
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- rendered server-side by $lib/wiki/markdown, raw HTML escaped -->
							{@html part.removed}
						</div>
					{/if}
					{#if part.added}
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- rendered server-side by $lib/wiki/markdown, raw HTML escaped -->
						<div class="wiki-added wiki-prose">{@html part.added}</div>
					{/if}
				{/if}
			</section>
		{/if}
	{/each}
</div>

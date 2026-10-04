<script lang="ts">
	import type { SearchHit } from '$lib/server/wiki';

	// `active` / `onpick` drive keyboard navigation in the search dialog; the
	// results page leaves them out and uses plain links
	let {
		hits,
		q,
		active = -1,
		onpick
	}: { hits: SearchHit[]; q: string; active?: number; onpick?: (href: string) => void } = $props();

	const offsets = $derived(
		hits.reduce<number[]>(
			(acc, h, i) => [...acc, i ? acc[i - 1] + 1 + hits[i - 1].sections.length : 0],
			[]
		)
	);

	function click(e: MouseEvent, href: string) {
		if (!onpick || e.metaKey || e.ctrlKey) return;
		e.preventDefault();
		onpick(href);
	}
</script>

<p class="mb-3 text-sm font-semibold">
	{hits.length
		? `${hits.length} ${hits.length === 1 ? 'result' : 'results'} for ${q}`
		: `No results for ${q}`}
</p>
<ul class="space-y-3">
	{#each hits as hit, i (hit.slug)}
		{@const base = `/wiki/${hit.topic}/${hit.slug}`}
		<li class="search-hit overflow-hidden rounded-lg">
			<a
				href={base}
				data-row={offsets[i]}
				class="search-row flex items-center gap-3 px-4 py-3 text-base font-semibold"
				class:active={active === offsets[i]}
				onclick={(e) => click(e, base)}
			>
				<svg
					viewBox="0 0 24 24"
					width="20"
					height="20"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					aria-hidden="true"
					><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path
						d="M14 3v5h5M9 13h6M9 17h6"
					/></svg
				>
				{hit.title}
			</a>
			{#each hit.sections as s, j (s.anchor + j)}
				{@const href = base + (s.anchor ? '#' + s.anchor : '')}
				<a
					{href}
					data-row={offsets[i] + 1 + j}
					class="search-row search-section block py-2.5 pr-4 pl-12"
					class:active={active === offsets[i] + 1 + j}
					class:last={j === hit.sections.length - 1}
					onclick={(e) => click(e, href)}
				>
					<span class="block font-semibold">{s.heading}</span>
					{#if s.snippet}
						<span class="wiki-snippet mt-0.5 block text-sm" style="color: var(--ink-2)">
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped server-side, only <mark> added -->
							{@html s.snippet}
						</span>
					{/if}
				</a>
			{/each}
		</li>
	{/each}
</ul>

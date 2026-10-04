<script lang="ts">
	import { page as nav } from '$app/state';

	let { data } = $props();
</script>

<svelte:head><title>{data.topic.title} · Wiki</title></svelte:head>

<header class="border-b px-4 pt-8 pb-6 md:px-12" style="border-color: var(--hairline)">
	<div class="mx-auto flex max-w-[46rem] items-end gap-4">
		<div>
			<nav class="mb-2 text-sm" style="color: var(--ink-2)">
				<a href="/wiki" class="hover:underline">Wiki</a>
			</nav>
			<h1 class="text-4xl font-bold tracking-tight md:text-5xl">{data.topic.title}</h1>
		</div>
		{#if data.email}
			<a href="/wiki/{data.topic.slug}/new" class="ml-auto shrink-0 text-sm hover:underline"
				>+ New page</a
			>
		{/if}
	</div>
</header>

<div class="px-4 py-8 md:px-12">
	<div class="mx-auto max-w-[46rem]">
		{#if nav.url.searchParams.has('suggested')}
			<p class="callout callout-tip mb-6">
				Thanks! The board will review your new page before it goes live.
			</p>
		{/if}
		{#if data.topic.intro}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- server-rendered, raw HTML escaped -->
			<div class="wiki-prose mb-8">{@html data.topic.intro}</div>
		{/if}
		<div class="grid gap-3 sm:grid-cols-2">
			{#each data.topic.pages as p (p.id)}
				<a href="/wiki/{data.topic.slug}/{p.slug}" class="wiki-pager">
					<span class="text-base font-semibold" style="color: var(--ink)">{p.title}</span>
					{#if p.private}<span class="text-xs">🔒 Residents only</span>{/if}
				</a>
			{:else}
				<p style="color: var(--ink-2)">No pages yet.</p>
			{/each}
		</div>
	</div>
</div>

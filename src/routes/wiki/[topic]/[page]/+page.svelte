<script lang="ts">
	import { page as nav } from '$app/state';
	import Toc from '$lib/wiki/Toc.svelte';

	let { data } = $props();
	const page = $derived(data.page);
	const edited = $derived(
		page.locked
			? ''
			: page.editedAt.toLocaleDateString('en-GB', {
					day: 'numeric',
					month: 'long',
					year: 'numeric'
				})
	);
	// reading order follows the sidebar
	const order = $derived(
		data.tree.flatMap((t) =>
			t.pages.map((p) => ({ title: p.title, href: `/wiki/${t.slug}/${p.slug}` }))
		)
	);
	const at = $derived(order.findIndex((p) => p.href === `/wiki/${page.topicSlug}/${page.slug}`));
	const prev = $derived(order[at - 1]);
	const next = $derived(order[at + 1]);
</script>

<svelte:head>
	{#if page.locked}
		<title>Residents only · Wiki</title>
		<meta name="robots" content="noindex" />
	{:else}
		<title>{page.title} · Wiki</title>
		<meta name="description" content={page.description} />
	{/if}
</svelte:head>

{#if page.locked}
	<header class="border-b px-4 pt-8 pb-6 md:px-12" style="border-color: var(--hairline)">
		<div class="mx-auto max-w-[46rem]">
			<nav class="mb-2 text-sm" style="color: var(--ink-2)">
				<a href="/wiki" class="hover:underline">Wiki</a>
				<span aria-hidden="true">›</span>
				<a href="/wiki/{page.topicSlug}" class="hover:underline">{page.topicTitle}</a>
			</nav>
			<h1 class="text-4xl font-bold tracking-tight md:text-5xl">Residents only</h1>
		</div>
	</header>
	<div class="px-4 py-8 md:px-12">
		<div class="wiki-prose mx-auto max-w-[46rem]">
			<aside class="wiki-locked">
				<p>
					<strong>🔒 This page is for residents only.</strong>
					<a href={data.loginUrl}>Log in to read it</a>
				</p>
			</aside>
		</div>
	</div>
{:else}
	<div class="xl:grid xl:grid-cols-[1fr_16rem]">
		<div class="min-w-0">
			<header
				id="_top"
				class="wiki-title border-b px-4 pt-8 pb-6 md:px-12"
				style="border-color: var(--hairline)"
			>
				<div class="mx-auto max-w-[46rem]">
					<nav class="mb-2 text-sm" style="color: var(--ink-2)">
						<a href="/wiki" class="hover:underline">Wiki</a>
						<span aria-hidden="true">›</span>
						<a href="/wiki/{page.topicSlug}" class="hover:underline">{page.topicTitle}</a>
					</nav>
					<div class="flex items-start gap-4">
						<h1 class="text-4xl font-bold tracking-tight md:text-5xl">{page.title}</h1>
						<!-- visitors get sent to login and come back to the editor -->
						<a
							href="/wiki/{page.topicSlug}/{page.slug}/edit"
							class="wiki-edit-btn mt-1 ml-auto flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium"
							>✎ Edit</a
						>
					</div>
					{#if page.private}
						<p class="mt-3 text-sm font-medium" style="color: var(--status-noplan)">
							🔒 Residents only
						</p>
					{/if}
				</div>
			</header>

			<div class="px-4 py-8 md:px-12">
				<div class="mx-auto max-w-[46rem]">
					{#if nav.url.searchParams.has('suggested')}
						<p class="callout callout-tip mb-6">
							Thanks! The board will review your suggestion before it goes live.
						</p>
					{/if}
					{#if page.toc.length}
						<details
							class="wiki-toc-mobile mb-6 rounded-lg border px-4 py-2 xl:hidden"
							style="border-color: var(--hairline)"
						>
							<summary class="cursor-pointer text-sm font-semibold">On this page</summary>
							<div class="py-2"><Toc toc={page.toc} /></div>
						</details>
					{/if}

					<!-- eslint-disable-next-line svelte/no-at-html-tags -- server-rendered: raw HTML escaped, private sections already removed for visitors -->
					<article class="wiki-prose">{@html page.html}</article>

					<footer
						class="mt-14 space-y-6 border-t pt-6 text-sm"
						style="border-color: var(--hairline); color: var(--ink-2)"
					>
						<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
							<span
								>Last edited by <strong style="color: var(--ink)">{page.editedBy}</strong> · {edited}</span
							>
							<a href="/wiki/{page.topicSlug}/{page.slug}/edit" class="ml-auto hover:underline"
								>✎ Edit page</a
							>
							{#if data.email}
								<a href="/wiki/{page.topicSlug}/{page.slug}/history" class="hover:underline"
									>History</a
								>
							{/if}
						</div>
						{#if prev || next}
							<div class="grid gap-3 sm:grid-cols-2">
								{#if prev}
									<a href={prev.href} class="wiki-pager">
										<span class="text-xs">Previous</span>
										<span class="text-base font-semibold" style="color: var(--ink)"
											>‹ {prev.title}</span
										>
									</a>
								{:else}<span></span>{/if}
								{#if next}
									<a href={next.href} class="wiki-pager text-right">
										<span class="text-xs">Next</span>
										<span class="text-base font-semibold" style="color: var(--ink)"
											>{next.title} ›</span
										>
									</a>
								{/if}
							</div>
						{/if}
					</footer>
				</div>
			</div>
		</div>

		<aside class="hidden border-l xl:block" style="border-color: var(--hairline)">
			<div class="wiki-sticky px-6 py-8">
				<h2 class="mb-3 text-base font-semibold">On this page</h2>
				<Toc toc={page.toc} />
			</div>
		</aside>
	</div>
{/if}

<script lang="ts">
	import Diff from '$lib/wiki/Diff.svelte';

	let { data } = $props();
	const date = (d: Date) =>
		d.toLocaleString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
</script>

<svelte:head><title>History of {data.page.title} · Wiki</title></svelte:head>

<div class="px-4 py-8 md:px-12">
	<div class="mx-auto max-w-5xl">
		<a href={data.page.url} class="text-sm hover:underline" style="color: var(--ink-2)"
			>‹ {data.page.title}</a
		>
		<h1 class="mt-1 mb-4 text-2xl font-semibold">History</h1>
		<div class="grid gap-4 md:grid-cols-[16rem_1fr]">
			<ul class="list self-start text-sm">
				{#each data.revisions as r (r.id)}
					<li>
						<a
							href="?rev={r.id}"
							class="block px-3 py-2 hover:underline"
							style:font-weight={r.id === data.selected ? 600 : undefined}
							style:background={r.id === data.selected ? 'var(--page)' : undefined}
						>
							{r.authorName}<br /><span style="color: var(--muted)">{date(r.createdAt)}</span>
						</a>
					</li>
				{/each}
			</ul>
			<Diff parts={data.parts} />
		</div>
	</div>
</div>

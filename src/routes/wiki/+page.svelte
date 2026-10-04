<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Wiki · Crystal Tower</title></svelte:head>

<header class="border-b px-4 pt-8 pb-6 md:px-12" style="border-color: var(--hairline)">
	<div class="mx-auto max-w-[46rem]">
		<h1 class="text-4xl font-bold tracking-tight md:text-5xl">Wiki</h1>
		<p class="mt-3 text-lg" style="color: var(--ink-2)">How things work in the Crystal Tower.</p>
	</div>
</header>

<div class="px-4 py-8 md:px-12">
	<div class="mx-auto grid max-w-[46rem] gap-4 sm:grid-cols-2">
		{#each data.tree as topic (topic.id)}
			<section class="wiki-pager">
				<a
					href="/wiki/{topic.slug}"
					class="text-lg font-semibold hover:underline"
					style="color: var(--ink)">{topic.title}</a
				>
				<ul class="mt-1 space-y-1">
					{#each topic.pages as p (p.id)}
						<li><a href="/wiki/{topic.slug}/{p.slug}" class="hover:underline">{p.title}</a></li>
					{/each}
				</ul>
			</section>
		{:else}
			<p style="color: var(--ink-2)">No pages yet.</p>
		{/each}
	</div>
</div>

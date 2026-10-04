<script lang="ts">
	import SearchResults from '$lib/wiki/SearchResults.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Search · Wiki</title></svelte:head>

<div class="px-4 py-8 md:px-12">
	<div class="mx-auto max-w-[46rem]">
		<h1 class="mb-6 text-4xl font-bold tracking-tight">Search</h1>
		<form class="mb-6 flex gap-2">
			<input
				name="q"
				value={data.q}
				type="search"
				class="h-11 w-full rounded-lg"
				aria-label="Search the wiki"
			/>
			<button class="btn-primary px-5">Search</button>
		</form>
		{#if data.q}<SearchResults hits={data.hits} q={data.q} />{/if}
	</div>
</div>

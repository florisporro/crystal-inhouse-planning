<script lang="ts">
	import PageForm from '$lib/wiki/PageForm.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>New page · Wiki</title></svelte:head>

<div class="px-4 py-8 md:px-12">
	<div class="mx-auto max-w-4xl">
		<h1 class="mb-4 text-2xl font-semibold">New page in {data.topic.title}</h1>
		<PageForm
			name={data.user.name}
			admin={data.user.admin}
			pages={data.pages}
			cancel="/wiki/{data.topic.slug}"
			error={form?.error}
		/>
	</div>
</div>

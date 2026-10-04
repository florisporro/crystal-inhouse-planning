<script lang="ts">
	import PageForm from '$lib/wiki/PageForm.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Edit {data.page.title} · Wiki</title></svelte:head>

<div class="px-4 py-8 md:px-12">
	<div class="mx-auto max-w-4xl">
		<h1 class="mb-4 text-2xl font-semibold">Edit page</h1>
		<PageForm
			title={data.page.title}
			body={data.page.body}
			private={data.page.private}
			name={data.user.name}
			admin={data.user.admin}
			pages={data.pages}
			cancel={data.page.url}
			error={form?.error}
		/>
	</div>
</div>

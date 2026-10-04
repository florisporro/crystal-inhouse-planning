<script lang="ts">
	import { enhance } from '$app/forms';
	import Editor from './Editor.svelte';

	let {
		title = '',
		body = '',
		private: isPrivate = false,
		name,
		admin,
		pages,
		cancel,
		error
	}: {
		title?: string;
		body?: string;
		private?: boolean;
		name: string;
		admin: boolean;
		pages: { slug: string; title: string }[];
		cancel: string;
		error?: string;
	} = $props();

	// the editor owns the content after mount; the prop is only the starting point
	// svelte-ignore state_referenced_locally
	let value = $state(body);
	let busy = $state(false);
</script>

<form
	method="POST"
	class="space-y-4"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
		};
	}}
>
	<label class="block text-sm font-medium">
		Title
		<input
			name="title"
			value={title}
			required
			maxlength="120"
			class="mt-1 w-full rounded text-lg"
		/>
	</label>
	<Editor bind:value {pages} />
	<input type="hidden" name="body" {value} />
	<div class="flex flex-wrap items-end gap-4">
		<label class="block text-sm font-medium">
			Your name
			<input name="name" value={name} required maxlength="80" class="mt-1 block rounded text-sm" />
		</label>
		{#if admin}
			<label class="flex items-center gap-2 pb-2 text-sm">
				<input type="checkbox" name="private" checked={isPrivate} class="rounded" />
				Whole page is for residents only
			</label>
		{/if}
	</div>
	{#if error}<p class="text-sm" style="color: var(--critical)">{error}</p>{/if}
	<div class="flex items-center gap-3">
		<button class="btn-primary px-4 py-2" disabled={busy}
			>{admin ? 'Publish' : 'Suggest changes'}</button
		>
		<a href={cancel} class="text-sm hover:underline">Cancel</a>
		{#if !admin}
			<span class="text-sm" style="color: var(--ink-2)"
				>The board reviews your suggestion before it goes live.</span
			>
		{/if}
	</div>
</form>

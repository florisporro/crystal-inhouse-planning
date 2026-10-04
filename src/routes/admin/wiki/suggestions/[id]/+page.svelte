<script lang="ts">
	import Diff from '$lib/wiki/Diff.svelte';

	let { data, form } = $props();
	const s = $derived(data.suggestion);
	const date = $derived(
		s.createdAt.toLocaleString('en-GB', {
			day: 'numeric',
			month: 'long',
			hour: '2-digit',
			minute: '2-digit'
		})
	);
</script>

<svelte:head><title>Review suggestion · Wiki</title></svelte:head>

<a href="/admin/wiki" class="text-sm hover:underline" style="color: var(--ink-2)">‹ Manage wiki</a>
<h1 class="mt-1 text-2xl font-semibold">
	{data.page ? `Changes to “${data.page.title}”` : `New page: ${s.title}`}
</h1>
<p class="mb-4 text-sm" style="color: var(--ink-2)">
	Suggested by {s.authorName} ({s.authorEmail}) · {date}
</p>

{#if s.status !== 'open'}
	<p class="card mb-4 text-sm">This suggestion was already reviewed ({s.status}).</p>
{/if}
{#if data.stale}
	<p class="card mb-4 text-sm" style="border-color: var(--status-noplan)">
		The page changed after this suggestion was made. Accepted changes are applied to the current
		version; changes to parts that were edited since are marked as conflicts.
	</p>
{/if}

<form method="POST" class="space-y-4">
	{#if data.page}
		{#if data.titleChanged}
			<label class="card flex items-center gap-2 text-sm">
				<input type="checkbox" name="acceptTitle" checked class="rounded" />
				Rename to <strong>{s.title}</strong>
			</label>
		{/if}
		<Diff parts={data.parts} choose={s.status === 'open'} />
	{:else}
		<div class="flex flex-wrap items-end gap-3">
			<label class="text-sm font-medium">
				Title
				<input name="title" value={s.title} class="mt-1 block rounded text-sm" />
			</label>
			<label class="text-sm font-medium">
				Topic
				<select name="topicId" class="mt-1 block rounded text-sm">
					{#each data.topics as t (t.id)}<option value={t.id} selected={t.id === s.topicId}
							>{t.title}</option
						>{/each}
				</select>
			</label>
			<label class="flex items-center gap-2 pb-2 text-sm">
				<input type="checkbox" name="private" class="rounded" /> Whole page is for residents only
			</label>
		</div>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- rendered server-side, raw HTML escaped -->
		<article class="card wiki-prose">{@html data.html}</article>
	{/if}

	{#if form?.error}<p class="text-sm" style="color: var(--critical)">{form.error}</p>{/if}
	{#if s.status === 'open'}
		<label class="block text-sm font-medium">
			Message to {s.authorName} <span style="color: var(--muted)">(optional)</span>
			<textarea
				name="note"
				rows="3"
				maxlength="1000"
				class="mt-1 w-full rounded text-sm"
				placeholder="Goes with the outcome email, for example why a change was left out."
			></textarea>
		</label>
		<div class="flex gap-3">
			<button name="decision" value="accept" class="btn-primary px-4 py-2">
				{data.page ? 'Apply selected changes' : 'Publish page'}
			</button>
			<button
				name="decision"
				value="decline"
				class="rounded px-4 py-2 hover:underline"
				style="color: var(--critical)"
			>
				Decline all
			</button>
		</div>
	{/if}
</form>

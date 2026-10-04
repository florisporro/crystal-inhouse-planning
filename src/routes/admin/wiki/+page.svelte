<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const small = 'rounded px-2 py-0.5 text-xs hover:bg-[var(--page)] disabled:opacity-30';
	const date = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
</script>

<svelte:head><title>Manage wiki · Crystal Tower</title></svelte:head>

<div class="mb-4 flex items-baseline gap-3">
	<h1 class="text-2xl font-semibold">Manage wiki</h1>
	<a href="/wiki" class="ml-auto text-sm hover:underline">View wiki</a>
</div>

<section class="mb-8">
	<h2 class="mb-2 font-semibold">Suggestions to review</h2>
	<ul class="list">
		{#each data.suggestions as s (s.id)}
			<li>
				<a href="/admin/wiki/suggestions/{s.id}" class="flex gap-3 px-4 py-3 hover:underline">
					<span class="font-medium">{s.isNew ? 'New page: ' : ''}{s.title}</span>
					<span class="ml-auto text-sm" style="color: var(--ink-2)"
						>{s.authorName} · {date(s.createdAt)}</span
					>
				</a>
			</li>
		{:else}
			<li class="px-4 py-3 text-sm" style="color: var(--ink-2)">Nothing to review.</li>
		{/each}
	</ul>
</section>

{#if form?.error}<p class="mb-3 text-sm" style="color: var(--critical)">{form.error}</p>{/if}

<h2 class="mb-2 font-semibold">Topics and pages</h2>
<div class="space-y-4">
	{#each data.tree as topic, ti (topic.id)}
		<section class="card space-y-3">
			<div class="flex items-center gap-1">
				<form method="POST" action="?/move" use:enhance class="flex">
					<input type="hidden" name="kind" value="topic" />
					<input type="hidden" name="id" value={topic.id} />
					<button name="dir" value="up" class={small} disabled={ti === 0} aria-label="Move topic up"
						>↑</button
					>
					<button
						name="dir"
						value="down"
						class={small}
						disabled={ti === data.tree.length - 1}
						aria-label="Move topic down">↓</button
					>
				</form>
				<a href="/wiki/{topic.slug}" class="font-semibold hover:underline">{topic.title}</a>
				<a href="/wiki/{topic.slug}/new" class="ml-auto text-sm hover:underline">+ Page</a>
			</div>

			<details>
				<summary class="cursor-pointer text-sm" style="color: var(--ink-2)">Edit topic</summary>
				<form method="POST" action="?/updateTopic" use:enhance class="mt-2 space-y-2">
					<input type="hidden" name="id" value={topic.id} />
					<input
						name="title"
						value={topic.title}
						required
						maxlength="80"
						class="w-full rounded text-sm"
						aria-label="Topic title"
					/>
					<textarea
						name="intro"
						rows="3"
						class="w-full rounded font-mono text-sm"
						placeholder="Intro (markdown, public)"
						aria-label="Topic intro">{topic.intro}</textarea
					>
					<div class="flex gap-3">
						<button class="btn-primary px-3 py-1 text-sm">Save topic</button>
						{#if !topic.pages.length}
							<button
								formaction="?/deleteTopic"
								class="text-sm hover:underline"
								style="color: var(--critical)">Delete empty topic</button
							>
						{/if}
					</div>
				</form>
			</details>

			<ul class="list text-sm">
				{#each topic.pages as page, pi (page.id)}
					<li class="flex flex-wrap items-center gap-2 px-3 py-2">
						<form method="POST" action="?/move" use:enhance class="flex">
							<input type="hidden" name="kind" value="page" />
							<input type="hidden" name="id" value={page.id} />
							<button
								name="dir"
								value="up"
								class={small}
								disabled={pi === 0}
								aria-label="Move page up">↑</button
							>
							<button
								name="dir"
								value="down"
								class={small}
								disabled={pi === topic.pages.length - 1}
								aria-label="Move page down">↓</button
							>
						</form>
						<a href="/wiki/{topic.slug}/{page.slug}" class="hover:underline">{page.title}</a>
						<span class="ml-auto"></span>
						<form method="POST" action="?/updatePage" use:enhance>
							<input type="hidden" name="id" value={page.id} />
							<button name="private" value={String(!page.private)} class={small}>
								{page.private ? '🔒 Residents only' : 'Public'}
							</button>
						</form>
						<form method="POST" action="?/updatePage" use:enhance class="flex gap-1">
							<input type="hidden" name="id" value={page.id} />
							<select name="topicId" class="rounded py-0.5 text-xs" aria-label="Move to topic">
								{#each data.tree as t (t.id)}<option value={t.id} selected={t.id === topic.id}
										>{t.title}</option
									>{/each}
							</select>
							<button class={small}>Move</button>
						</form>
						<details class="relative">
							<summary class="{small} cursor-pointer list-none" style="color: var(--critical)"
								>Delete</summary
							>
							<form
								method="POST"
								action="?/deletePage"
								use:enhance
								class="card absolute right-0 z-10 mt-1 w-56 text-xs"
							>
								<input type="hidden" name="id" value={page.id} />
								<p class="mb-2">Delete “{page.title}” and its history?</p>
								<button class="rounded px-2 py-1 text-white" style="background: var(--critical)"
									>Delete page</button
								>
							</form>
						</details>
					</li>
				{:else}
					<li class="px-3 py-2" style="color: var(--ink-2)">No pages yet.</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<form method="POST" action="?/addTopic" use:enhance class="mt-4 flex gap-2">
	<input
		name="title"
		required
		maxlength="80"
		placeholder="New topic"
		class="rounded text-sm"
		aria-label="New topic title"
	/>
	<button class="btn-primary px-3 text-sm">Add topic</button>
</form>

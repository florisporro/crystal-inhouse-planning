<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { SearchHit } from '$lib/server/wiki';
	import SearchResults from './SearchResults.svelte';

	let dialog: HTMLDialogElement;
	let input = $state<HTMLInputElement>();
	let q = $state('');
	let hits = $state<SearchHit[]>([]);
	let searched = $state('');
	let active = $state(0);
	let mac = $state(true);
	let timer: ReturnType<typeof setTimeout>;

	// one entry per keyboard stop: the page itself, then each of its sections
	const rows = $derived(
		hits.flatMap((h) => [
			`/wiki/${h.topic}/${h.slug}`,
			...h.sections.map((s) => `/wiki/${h.topic}/${h.slug}${s.anchor ? '#' + s.anchor : ''}`)
		])
	);

	onMount(() => (mac = /Mac|iPhone|iPad/.test(navigator.platform)));

	function open() {
		dialog.showModal();
		input?.select();
	}

	function onInput() {
		clearTimeout(timer);
		timer = setTimeout(async () => {
			const term = q.trim();
			hits = term ? await (await fetch(`/wiki/search?q=${encodeURIComponent(term)}`)).json() : [];
			searched = term;
			active = 0;
		}, 150);
	}

	function go(href: string) {
		dialog.close();
		goto(href);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') active = Math.min(active + 1, rows.length - 1);
		else if (e.key === 'ArrowUp') active = Math.max(active - 1, 0);
		else if (e.key === 'Enter' && rows[active]) go(rows[active]);
		else return;
		e.preventDefault();
		dialog.querySelector(`[data-row="${active}"]`)?.scrollIntoView({ block: 'nearest' });
	}

	// Cmd/Ctrl+K anywhere; `/` when not already typing
	function onGlobalKey(e: KeyboardEvent) {
		const typing = (e.target as HTMLElement).closest(
			'input, textarea, select, [contenteditable="true"]'
		);
		if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
			e.preventDefault();
			if (dialog.open) dialog.close();
			else open();
		}
	}
</script>

<svelte:window onkeydown={onGlobalKey} />

<button
	type="button"
	onclick={open}
	class="search-trigger flex h-10 items-center gap-2 rounded-lg border px-3 text-sm md:w-full md:max-w-sm"
	aria-label="Search the wiki"
>
	<svg
		viewBox="0 0 24 24"
		width="16"
		height="16"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg
	>
	<span class="hidden md:inline">Search</span>
	<span class="ml-auto hidden md:inline"><kbd>{mac ? '⌘' : 'Ctrl'}</kbd> <kbd>K</kbd></span>
</button>

<dialog
	bind:this={dialog}
	class="search-dialog"
	onclick={(e) => e.target === dialog && dialog.close()}
	aria-label="Search the wiki"
>
	<div class="flex max-h-[80vh] flex-col gap-4 p-4 md:p-6">
		<div class="search-field flex items-center gap-3 rounded-lg border-2 px-3">
			<svg
				viewBox="0 0 24 24"
				width="18"
				height="18"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg
			>
			<input
				bind:this={input}
				bind:value={q}
				oninput={onInput}
				onkeydown={onKeydown}
				type="search"
				placeholder="Search the wiki"
				aria-label="Search the wiki"
				class="h-12 w-full border-0 bg-transparent! p-0 text-base focus:ring-0"
			/>
			{#if q}
				<button
					type="button"
					onclick={() => ((q = ''), (hits = []), (searched = ''), input?.focus())}
					aria-label="Clear search"
					class="text-xl leading-none"
					style="color: var(--status-planned)">✕</button
				>
			{/if}
		</div>
		<div class="-mx-1 overflow-y-auto px-1">
			{#if searched}
				<SearchResults {hits} q={searched} {active} onpick={go} />
			{:else}
				<p class="py-6 text-center text-sm" style="color: var(--muted)">
					Type at least three letters. <kbd>↑</kbd> <kbd>↓</kbd> to move, <kbd>Enter</kbd> to open.
				</p>
			{/if}
		</div>
	</div>
</dialog>

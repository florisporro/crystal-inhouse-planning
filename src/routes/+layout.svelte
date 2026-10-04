<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Logo from '$lib/Logo.svelte';
	import Search from '$lib/wiki/Search.svelte';
	import { page } from '$app/state';

	let { children, data } = $props();
	// the wiki uses the full width for its sidebar and table of contents
	const wide = $derived(page.route.id?.startsWith('/wiki') ?? false);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<header
	class="sticky top-0 z-20 border-b backdrop-blur"
	style="border-color: var(--hairline); background: color-mix(in srgb, var(--surface) 82%, transparent)"
>
	<div class="mx-auto flex h-16 items-center gap-3 px-4 md:gap-6" class:max-w-5xl={!wide}>
		<a href="/" class="flex items-center gap-2 font-semibold" aria-label="Crystal Tower">
			<Logo class="h-9 w-9" />
			<span class="hidden whitespace-nowrap sm:inline">Crystal Tower</span>
		</a>
		<nav class="hidden gap-4 text-sm md:flex" style="color: var(--ink-2)">
			<a href="/" class="hover:underline">Overview</a>
			{#if data.email}<a href="/tower" class="hover:underline">Tower</a>{/if}
			<a href="/wiki" class="hover:underline">Wiki</a>
		</nav>
		<div class="ml-auto flex justify-center md:ml-0 md:flex-1"><Search /></div>
		<span class="flex items-center gap-3 text-sm md:gap-4" style="color: var(--ink-2)">
			{#if data.admin}<a href="/admin" class="hidden hover:underline md:inline">Admin</a>{/if}
			<a href={data.email ? '/my' : '/login'} class="hidden hover:underline md:inline">
				{data.email ? 'My apartment' : 'Log in'}
			</a>
			<a href="/announce" class="btn-primary px-3 py-1.5 whitespace-nowrap">+ Announce</a>
			<details class="relative md:hidden">
				<summary
					class="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded text-xl [&::-webkit-details-marker]:hidden"
					aria-label="Menu"
				>
					☰
				</summary>
				<!-- close the dropdown when a link inside is clicked; not an interactive role -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
				<nav
					class="absolute right-0 z-10 mt-1 flex w-44 flex-col rounded border p-1 shadow-lg"
					style="background: var(--surface); border-color: var(--hairline)"
					onclick={(e) => e.currentTarget.closest('details')?.removeAttribute('open')}
				>
					<a href="/" class="rounded px-3 py-2 hover:underline">Overview</a>
					{#if data.email}<a href="/tower" class="rounded px-3 py-2 hover:underline">Tower</a>{/if}
					<a href="/wiki" class="rounded px-3 py-2 hover:underline">Wiki</a>
					{#if data.admin}<a href="/admin" class="rounded px-3 py-2 hover:underline">Admin</a>{/if}
					<a href={data.email ? '/my' : '/login'} class="rounded px-3 py-2 hover:underline">
						{data.email ? 'My apartment' : 'Log in'}
					</a>
				</nav>
			</details>
		</span>
	</div>
</header>

<main class={wide ? '' : 'mx-auto max-w-5xl px-4 py-6'}>
	{@render children()}
</main>

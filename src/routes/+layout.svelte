<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Logo from '$lib/Logo.svelte';

	let { children, data } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<header class="border-b" style="border-color: var(--hairline); background: var(--surface)">
	<div class="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
		<a href="/" class="flex items-center gap-2 font-semibold">
			<Logo class="h-9 w-9" />
			Crystal Tower
		</a>
		<nav class="flex gap-4 text-sm" style="color: var(--ink-2)">
			<a href="/" class="hover:underline">Overview</a>
			<a href="/tower" class="hover:underline">Tower</a>
		</nav>
		<span class="ml-auto flex items-center gap-4 text-sm" style="color: var(--ink-2)">
			{#if data.admin}<a href="/admin" class="hover:underline">Admin</a>{/if}
			<a href={data.email ? '/my' : '/login'} class="hover:underline">
				{data.email ? 'My apartment' : 'Log in'}
			</a>
			<a
				href="/announce"
				class="rounded px-3 py-1.5 font-medium text-white"
				style="background: var(--status-planned)"
			>
				+ Announce
			</a>
		</span>
	</div>
</header>

<main class="mx-auto max-w-5xl px-4 py-6">
	{@render children()}
</main>

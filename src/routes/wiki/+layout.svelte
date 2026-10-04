<script lang="ts">
	import { page } from '$app/state';

	let { data, children } = $props();
</script>

{#snippet nav()}
	<nav class="space-y-5 text-[0.9375rem]">
		{#each data.tree as topic (topic.id)}
			<details open class="wiki-topic">
				<summary
					class="flex cursor-pointer list-none items-center justify-between py-1 font-semibold"
				>
					<a href="/wiki/{topic.slug}" class="hover:underline">{topic.title}</a>
					<svg
						class="chevron"
						viewBox="0 0 24 24"
						width="16"
						height="16"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg
					>
				</summary>
				<ul class="mt-1 space-y-0.5 border-l pl-2" style="border-color: var(--hairline)">
					{#each topic.pages as p (p.id)}
						{@const href = `/wiki/${topic.slug}/${p.slug}`}
						<li>
							<a
								{href}
								class="wiki-nav-link block rounded-md px-2.5 py-1.5"
								aria-current={page.url.pathname === href ? 'page' : undefined}
							>
								{p.title}
							</a>
						</li>
					{/each}
				</ul>
			</details>
		{/each}
		{#if data.openSuggestions !== null}
			<a
				href="/admin/wiki"
				class="block border-t pt-4 text-sm hover:underline"
				style="border-color: var(--hairline); color: var(--ink-2)"
			>
				Manage wiki{data.openSuggestions ? ` · ${data.openSuggestions} to review` : ''}
			</a>
		{/if}
	</nav>
{/snippet}

<div class="lg:grid lg:grid-cols-[18rem_1fr]">
	<aside
		class="wiki-sidebar hidden border-r px-6 py-8 lg:block"
		style="border-color: var(--hairline)"
	>
		{@render nav()}
	</aside>
	<details class="border-b px-4 py-3 lg:hidden" style="border-color: var(--hairline)">
		<summary class="cursor-pointer text-sm font-semibold">Menu</summary>
		<div class="pt-4">{@render nav()}</div>
	</details>
	<div class="min-w-0">{@render children()}</div>
</div>

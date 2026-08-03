<script lang="ts">
	import { STATUSES } from '$lib/viz';

	let { data } = $props();
	const statusLabel = (key: string) => STATUSES.find((s) => s.key === key)?.label ?? key;
</script>

<svelte:head><title>Tower view — Crystal Tower</title></svelte:head>

<h1 class="mb-1 text-xl font-semibold">Tower view</h1>
<p class="mb-3 text-sm" style="color: var(--muted)">
	One row per floor, top floor first. Click an apartment for details.
</p>

<ul class="mb-5 flex flex-wrap gap-x-5 gap-y-1 text-sm" style="color: var(--ink-2)">
	{#each STATUSES as s (s.key)}
		<li class="flex items-center gap-1.5">
			<span class="box-{s.key} inline-block h-3.5 w-3.5 rounded-sm"></span>
			{s.label}
		</li>
	{/each}
</ul>

<div class="space-y-1">
	{#each data.floors as [floor, apts] (floor)}
		<div class="flex items-center gap-2">
			<span class="w-8 text-right text-xs tabular-nums" style="color: var(--muted)">{floor}</span>
			<div class="flex flex-wrap gap-0.5">
				{#each apts as a (a.number)}
					<a
						href="/apartment/{a.number}"
						class="box-{a.status} flex h-10 w-10 items-center justify-center rounded-sm text-xs tabular-nums hover:opacity-80 md:h-7 md:w-9"
						title="Apartment {a.number} — {statusLabel(a.status)}"
						aria-label="Apartment {a.number} — {statusLabel(a.status)}"
					>
						{a.number}
					</a>
				{/each}
			</div>
		</div>
	{/each}
</div>

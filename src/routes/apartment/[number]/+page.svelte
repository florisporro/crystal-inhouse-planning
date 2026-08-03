<script lang="ts">
	import { STATUSES, fmtDate } from '$lib/viz';

	let { data } = $props();

	const typeLabels = { moving: 'Moving', delivery: 'Delivery', other: 'Other activity' };
	const blockLabels = { morning: 'Morning', afternoon: 'Afternoon', full_day: 'Full day' };
	const statusLabel = STATUSES.find((s) => s.key === data.status)?.label;
</script>

<svelte:head><title>Apartment {data.number} — Crystal Tower</title></svelte:head>

<div class="mb-1 flex flex-wrap items-baseline justify-between gap-3">
	<h1 class="text-xl font-semibold">Apartment {data.number}</h1>
	{#if data.editable}
		<a href="/announce?apartment={data.number}" class="btn-primary px-4 py-2 text-sm">
			+ Announce activity
		</a>
	{/if}
</div>
<p class="mb-4 flex items-center gap-3 text-sm" style="color: var(--ink-2)">
	Floor {data.floor}
	<span class="box-{data.status} rounded-full px-2.5 py-0.5 text-xs font-medium">{statusLabel}</span
	>
	{#if data.status === 'planned' && data.plannedMoveDate}
		<span>planned move: {fmtDate(data.plannedMoveDate)}</span>
	{/if}
</p>

<h2 class="mb-2 text-lg font-semibold">Activities</h2>
{#if data.acts.length === 0}
	<p class="text-sm" style="color: var(--muted)">No activities announced for this apartment.</p>
{:else}
	<ul class="list">
		{#each data.acts as a (a.id)}
			<li
				class="flex flex-wrap gap-4 px-3 py-1.5 text-sm {a.status === 'cancelled'
					? 'line-through opacity-50'
					: ''}"
			>
				<a href="/day/{a.date}" class="w-36 hover:underline">{fmtDate(a.date)}</a>
				<span class="w-28">{typeLabels[a.type]}</span>
				<span class="w-24" style="color: var(--ink-2)">{blockLabels[a.block]}</span>
				{#if a.note}<span style="color: var(--muted)">{a.note}</span>{/if}
			</li>
		{/each}
	</ul>
{/if}

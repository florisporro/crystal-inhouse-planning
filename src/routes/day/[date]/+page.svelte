<script lang="ts">
	import { BLOCKS } from '$lib/capacity';
	import { busyLabel, fmtDate } from '$lib/viz';

	let { data } = $props();

	const typeLabels = { moving: 'Moving', delivery: 'Delivery', other: 'Other activity' };
	const blockLabels = { morning: 'Morning', afternoon: 'Afternoon', full_day: 'Full day' };

	const loads = $derived({ morning: data.morning, afternoon: data.afternoon });
</script>

<svelte:head><title>{fmtDate(data.date)} — Crystal Tower</title></svelte:head>

<div class="mb-4 flex flex-wrap items-baseline justify-between gap-3">
	<h1 class="text-xl font-semibold">{fmtDate(data.date)}</h1>
	<a
		href="/announce?date={data.date}"
		class="rounded px-4 py-2 text-sm font-medium text-white"
		style="background: var(--status-planned)"
	>
		+ Announce activity on this day
	</a>
</div>

<div class="grid gap-6 sm:grid-cols-2">
	{#each BLOCKS as block (block.key)}
		{@const l = loads[block.key]}
		{@const count = l.count}
		<section
			class="rounded border p-4"
			style="border-color: var(--hairline); background: var(--surface)"
		>
			<h2 class="font-medium">
				{block.label} <span class="text-sm" style="color: var(--muted)">{block.hours}</span>
			</h2>
			<p class="mt-2 flex justify-between text-sm" style="color: var(--ink-2)">
				<span>{count} {count === 1 ? 'activity' : 'activities'}</span>
				<span class="font-medium" style={l.load > 1 ? 'color: var(--critical)' : ''}>
					{busyLabel(l.load)}
				</span>
			</p>
			<div class="mt-1 h-2.5 rounded-sm" style="background: var(--grid)">
				<div
					class="h-2.5 rounded-sm"
					style="width: {Math.min(100, l.load * 100)}%; background: {l.load > 1
						? 'var(--critical)'
						: 'var(--status-planned)'}"
				></div>
			</div>
			{#if l.load > 1}
				<p class="mt-2 text-sm font-medium" style="color: var(--critical)">
					⚠️ Very busy — expect congestion
				</p>
			{/if}
		</section>
	{/each}
</div>

<section class="mt-8">
	<h2 class="mb-2 text-lg font-semibold">Activities</h2>
	{#if data.acts.length === 0}
		<p class="text-sm" style="color: var(--muted)">Nothing announced for this day.</p>
	{:else}
		<ul class="divide-y rounded border" style="border-color: var(--hairline)">
			{#each data.acts as a (a.id)}
				<li class="flex flex-wrap gap-4 px-3 py-1.5 text-sm" style="border-color: var(--hairline)">
					<a href="/apartment/{a.apartmentNumber}" class="w-16 font-medium hover:underline"
						>№ {a.apartmentNumber}</a
					>
					<span class="w-16" style="color: var(--ink-2)">floor {a.floor}</span>
					<span class="w-28">{typeLabels[a.type]}</span>
					<span class="w-24" style="color: var(--ink-2)">{blockLabels[a.block]}</span>
					{#if a.note}<span style="color: var(--muted)">{a.note}</span>{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<script lang="ts">
	import { STATUSES, busyLabel, fmtDate, heatColor } from '$lib/viz';

	let { data } = $props();

	// || 1: an unseeded database must not render NaN widths
	const total = $derived(data.total || 1);
	const pct = (n: number) => Math.round((n / total) * 100);
	const loadTitle = (name: string, l: { count: number; load: number }) =>
		`${name}: ${l.count} ${l.count === 1 ? 'activity' : 'activities'} — ${busyLabel(l.load)}${l.load > 1 ? ', expect congestion' : ''}`;

	const typeLabels = { moving: 'Moving', delivery: 'Delivery', other: 'Other activity' };
	const blockLabels = { morning: 'morning', afternoon: 'afternoon', full_day: 'full day' };
	const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	const upcomingDates = $derived(
		data.view === 'upcoming' ? [...new Set(data.upcoming.map((a) => a.date))] : []
	);

	const toggleClass = (active: boolean) =>
		'rounded px-3 py-1.5 text-sm font-medium ' + (active ? 'text-white' : 'hover:underline');
</script>

<svelte:head><title>Crystal Tower — Moving &amp; Delivery</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<div>
		<h1 class="text-xl font-semibold">Moving &amp; delivery planner</h1>
		<p class="text-sm" style="color: var(--muted)">
			See how busy the building is, and announce your own move, delivery or works.
		</p>
	</div>
	<a
		href="/announce"
		class="rounded px-4 py-2 text-sm font-medium text-white"
		style="background: var(--status-planned)"
	>
		+ Announce an activity
	</a>
</div>

<section class="mb-8">
	<h2 class="mb-2 text-lg font-semibold">Move-in progress</h2>
	<div class="flex h-6 w-full gap-0.5 overflow-hidden rounded">
		{#each STATUSES as s (s.key)}
			{#if data.stats[s.key] > 0}
				<div
					class="box-{s.key}"
					style="width: {(data.stats[s.key] / total) * 100}%"
					title="{s.label}: {data.stats[s.key]} of {data.total}"
				></div>
			{/if}
		{/each}
	</div>
	<ul class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm" style="color: var(--ink-2)">
		{#each STATUSES as s (s.key)}
			<li class="flex items-center gap-1.5">
				<span class="box-{s.key} inline-block h-3 w-3 rounded-sm"></span>
				{s.label}: {data.stats[s.key]} ({pct(data.stats[s.key])}%)
			</li>
		{/each}
	</ul>
</section>

<section>
	<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
		<h2 class="text-lg font-semibold">Busyness</h2>
		<nav class="flex gap-1 rounded border p-0.5" style="border-color: var(--hairline)">
			<a
				href="/?view=calendar"
				class={toggleClass(data.view === 'calendar')}
				style={data.view === 'calendar'
					? 'background: var(--status-planned)'
					: 'color: var(--ink-2)'}
			>
				Calendar
			</a>
			<a
				href="/?view=upcoming"
				class={toggleClass(data.view === 'upcoming')}
				style={data.view === 'upcoming'
					? 'background: var(--status-planned)'
					: 'color: var(--ink-2)'}
			>
				Upcoming
			</a>
		</nav>
	</div>

	{#if data.view === 'calendar'}
		<div class="mb-2 flex items-center justify-between">
			<a
				href="/?view=calendar&month={data.prevMonth}"
				class="rounded px-3 py-1 text-lg hover:underline"
				style="color: var(--ink-2)"
				aria-label="Previous month">‹</a
			>
			<h3 class="font-medium">{data.monthLabel}</h3>
			<a
				href="/?view=calendar&month={data.nextMonth}"
				class="rounded px-3 py-1 text-lg hover:underline"
				style="color: var(--ink-2)"
				aria-label="Next month">›</a
			>
		</div>
		<div class="mb-1 grid grid-cols-7 gap-1 text-center text-xs" style="color: var(--muted)">
			{#each weekdays as w (w)}<div>{w}</div>{/each}
		</div>
		<div class="grid grid-cols-7 gap-1">
			{#each Array(data.offset) as _, i (i)}<div></div>{/each}
			{#each data.days as d (d.date)}
				<a
					href="/day/{d.date}"
					class="rounded border p-1 hover:opacity-80"
					aria-label="{fmtDate(d.date)} — morning {busyLabel(d.morning.load).toLowerCase()},
						afternoon {busyLabel(d.afternoon.load).toLowerCase()}"
					style="border-color: {d.date === data.today
						? 'var(--status-planned)'
						: 'var(--hairline)'}; background: var(--surface)"
				>
					<div class="mb-1 flex items-baseline justify-between text-xs" style="color: var(--muted)">
						<span
							style={d.date === data.today ? 'color: var(--status-planned); font-weight: 600' : ''}
						>
							{Number(d.date.slice(-2))}
						</span>
						{#if d.morning.load > 1 || d.afternoon.load > 1}<span title="Very busy">⚠️</span>{/if}
					</div>
					{#each [{ name: 'Morning', l: d.morning }, { name: 'Afternoon', l: d.afternoon }] as strip (strip.name)}
						<div
							class="mb-0.5 h-3 rounded-sm"
							style="background: {heatColor(strip.l.load) ??
								'transparent'}; box-shadow: inset 0 0 0 1px var(--hairline)"
							title={loadTitle(strip.name, strip.l)}
						></div>
					{/each}
				</a>
			{/each}
		</div>
		<div class="mt-2 flex items-center gap-2 text-xs" style="color: var(--muted)">
			Quiet
			<span class="flex h-3 w-32 overflow-hidden rounded-sm">
				{#each [0.1, 0.3, 0.45, 0.6, 0.75, 0.9, 1] as l (l)}
					<span class="h-3 w-1/7" style="background: {heatColor(l)}"></span>
				{/each}
			</span>
			Busy · ⚠️ very busy — expect congestion · each day: morning (top), afternoon (bottom)
		</div>
	{:else}
		{#if data.upcoming.length === 0}
			<p class="text-sm" style="color: var(--muted)">
				No activities announced for the next 7 days.
			</p>
		{/if}
		{#each upcomingDates as date (date)}
			<h3 class="mt-4 mb-1 text-sm font-medium">
				<a href="/day/{date}" class="hover:underline">{fmtDate(date)}</a>
			</h3>
			<ul class="divide-y rounded border" style="border-color: var(--hairline)">
				{#each data.upcoming.filter((a) => a.date === date) as a (a)}
					<li class="flex gap-4 px-3 py-1.5 text-sm" style="border-color: var(--hairline)">
						<a href="/apartment/{a.apartmentNumber}" class="w-16 font-medium hover:underline"
							>№ {a.apartmentNumber}</a
						>
						<span class="w-16" style="color: var(--ink-2)">floor {a.floor}</span>
						<span>{typeLabels[a.type]}</span>
						<span style="color: var(--ink-2)">{blockLabels[a.block]}</span>
					</li>
				{/each}
			</ul>
		{/each}
	{/if}
</section>

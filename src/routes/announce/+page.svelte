<script lang="ts">
	import { fmtDate } from '$lib/viz';

	let { data, form } = $props();

	let step = $state(1);
	let type = $state('');
	let date = $state('');
	let block = $state('');
	let note = $state('');
	let apartment = $state<number | ''>('');

	// (re)start the wizard whenever the prefill changes, e.g. arriving from a day page
	$effect(() => {
		date = data.prefillDate;
		apartment = data.prefillApartment ?? '';
		step = 1;
		type = block = note = '';
	});

	const types = [
		{
			key: 'moving',
			icon: '🚚',
			label: 'Moving',
			hint: 'Moving in or out with a truck or large van.'
		},
		{
			key: 'delivery',
			icon: '📦',
			label: 'Large delivery',
			hint: 'Furniture, appliances or other big deliveries by truck or large van.'
		},
		{
			key: 'other',
			icon: '🔧',
			label: 'Other activity',
			hint: 'Contractors, renovation work, small deliveries — anything by small van.'
		}
	];
	const blocks = [
		{ key: 'morning', label: 'Morning', hint: '08:00 – 12:30' },
		{ key: 'afternoon', label: 'Afternoon', hint: '12:30 – 18:00' },
		{ key: 'full_day', label: 'Full day', hint: '08:00 – 18:00' }
	];

	const typeLabel = $derived(types.find((t) => t.key === type)?.label ?? '');
	const blockLabel = $derived(blocks.find((b) => b.key === block)?.label ?? '');

	const cardClass =
		'block w-full rounded-lg border p-4 text-left transition hover:opacity-90 cursor-pointer';
	const cardStyle = 'border-color: var(--hairline); background: var(--surface)';
</script>

<svelte:head><title>Announce an activity — Crystal Tower</title></svelte:head>

<div class="mx-auto max-w-lg">
	<h1 class="mb-1 text-xl font-semibold">Announce an activity</h1>
	<p class="mb-4 text-sm" style="color: var(--muted)">
		Step {step} of 3 —
		{step === 1 ? 'what is happening?' : step === 2 ? 'when is it happening?' : 'check and confirm'}
	</p>

	<div class="mb-6 flex gap-1">
		{#each [1, 2, 3] as s (s)}
			<div
				class="h-1.5 flex-1 rounded-full"
				style="background: {s <= step ? 'var(--status-planned)' : 'var(--grid)'}"
			></div>
		{/each}
	</div>

	{#if step === 1}
		{#if data.admin || data.numbers.length > 1}
			<label class="mb-4 block text-sm">
				Apartment
				{#if data.admin}
					<input
						type="number"
						min="1"
						max="179"
						bind:value={apartment}
						class="mt-1 w-28 rounded text-sm"
					/>
				{:else}
					<select bind:value={apartment} class="mt-1 w-28 rounded text-sm">
						{#each data.numbers as n (n)}<option value={n}>{n}</option>{/each}
					</select>
				{/if}
			</label>
		{/if}
		<div class="space-y-3">
			{#each types as t (t.key)}
				<button
					type="button"
					class={cardClass}
					style={cardStyle}
					onclick={() => {
						type = t.key;
						step = 2;
					}}
				>
					<span class="text-lg font-medium">{t.icon} {t.label}</span>
					<span class="mt-1 block text-sm" style="color: var(--ink-2)">{t.hint}</span>
				</button>
			{/each}
		</div>
	{:else if step === 2}
		<label class="mb-4 block text-sm">
			Which day?
			<input type="date" bind:value={date} required class="mt-1 block rounded" />
		</label>
		<p class="mb-2 text-sm" style="color: var(--ink-2)">Which part of the day?</p>
		<div class="space-y-3">
			{#each blocks as b (b.key)}
				<button
					type="button"
					class="{cardClass} disabled:opacity-40"
					style={cardStyle}
					disabled={!date}
					onclick={() => {
						block = b.key;
						step = 3;
					}}
				>
					<span class="font-medium">{b.label}</span>
					<span class="ml-2 text-sm" style="color: var(--ink-2)">{b.hint}</span>
				</button>
			{/each}
		</div>
		{#if !date}<p class="mt-2 text-sm" style="color: var(--muted)">Pick a day first.</p>{/if}
		<button type="button" class="mt-4 text-sm hover:underline" style="color: var(--ink-2)" onclick={() => (step = 1)}>
			← Back
		</button>
	{:else}
		<form method="POST">
			<input type="hidden" name="apartment" value={apartment} />
			<input type="hidden" name="type" value={type} />
			<input type="hidden" name="date" value={date} />
			<input type="hidden" name="block" value={block} />
			<div class="mb-4 rounded-lg border p-4" style={cardStyle}>
				<p class="font-medium">
					{typeLabel} — apartment {apartment}
				</p>
				<p class="text-sm" style="color: var(--ink-2)">
					{fmtDate(date)}, {blockLabel.toLowerCase()}
				</p>
			</div>
			{#if type === 'moving'}
				<label class="mb-4 flex items-start gap-2 text-sm">
					<input type="checkbox" name="movedAfter" checked class="mt-0.5 rounded" />
					<span>
						We are fully moved in after this move
						<span class="block text-xs" style="color: var(--muted)">
							This sets your apartment's status to “Move planned” for {fmtDate(date)} (or “Moved
							in” if the date has passed).
						</span>
					</span>
				</label>
			{/if}
			<label class="mb-4 block text-sm">
				Anything the neighbours should know? <span style="color: var(--muted)">(optional)</span>
				<input
					name="note"
					bind:value={note}
					maxlength="200"
					placeholder="e.g. piano coming up the stairwell, wish us luck"
					class="mt-1 w-full rounded text-sm"
				/>
			</label>
			{#if form?.error}<p class="mb-3 text-sm" style="color: var(--critical)">{form.error}</p>{/if}
			<div class="flex items-center gap-4">
				<button
					type="submit"
					class="rounded px-5 py-2.5 font-medium text-white"
					style="background: var(--status-planned)"
				>
					Announce it
				</button>
				<button type="button" class="text-sm hover:underline" style="color: var(--ink-2)" onclick={() => (step = 2)}>
					← Back
				</button>
			</div>
		</form>
	{/if}
</div>

<script lang="ts">
	let { data, form } = $props();

	const fields = [
		{ key: 'totalElevators', label: 'Elevators in total' },
		{ key: 'fullHeightElevators', label: '…of which reach floor 31' },
		{ key: 'truckSpaces', label: 'Truck or large-van spaces (moving, deliveries)' },
		{ key: 'vanSpaces', label: 'Small-van spaces (other activities)' }
	] as const;

	const costTypes = [
		{ key: 'moving', label: 'Moving' },
		{ key: 'delivery', label: 'Delivery' },
		{ key: 'other', label: 'Other activity' }
	] as const;
	const costResources = [
		{ key: 'truck', label: 'Truck spaces' },
		{ key: 'van', label: 'Van spaces' },
		{ key: 'elevator', label: 'Elevator use' }
	] as const;
</script>

<svelte:head><title>Admin — Crystal Tower</title></svelte:head>

<h1 class="mb-6 text-xl font-semibold">Admin</h1>

<section class="mb-8 max-w-md rounded border p-4" style="border-color: var(--hairline); background: var(--surface)">
	<h2 class="mb-1 font-medium">Indicative capacity</h2>
	<p class="mb-3 text-sm" style="color: var(--muted)">
		Used for busyness colors and warnings only — registrations are never blocked.
	</p>
	<form method="POST" action="?/saveCapacity" class="space-y-3 text-sm">
		{#each fields as f (f.key)}
			<label class="flex items-center justify-between gap-4">
				{f.label}
				<input
					type="number"
					name={f.key}
					value={data.capacity[f.key]}
					min="1"
					max="999"
					required
					class="w-24 rounded text-sm"
				/>
			</label>
		{/each}
		{#if form?.error}<p style="color: var(--critical)">{form.error}</p>{/if}
		{#if form?.saved}<p style="color: var(--status-moved)">Saved.</p>{/if}
		<button class="rounded px-4 py-2 font-medium text-white" style="background: var(--status-planned)">
			Save capacity
		</button>
	</form>
</section>

<section class="mb-8 max-w-md rounded border p-4" style="border-color: var(--hairline); background: var(--surface)">
	<h2 class="mb-1 font-medium">Activity load</h2>
	<p class="mb-3 text-sm" style="color: var(--muted)">
		How much one activity of each type weighs on the resources above. Indicative weights only —
		nothing is blocked.
	</p>
	<form method="POST" action="?/saveCosts" class="space-y-3 text-sm">
		<table class="w-full">
			<thead>
				<tr>
					<th></th>
					{#each costResources as r (r.key)}
						<th class="pb-1 text-right font-normal" style="color: var(--muted)">{r.label}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each costTypes as t (t.key)}
					<tr>
						<td class="py-1">{t.label}</td>
						{#each costResources as r (r.key)}
							<td class="py-1 text-right">
								<input
									type="number"
									name="{t.key}.{r.key}"
									value={data.costs[t.key][r.key]}
									min="0"
									max="99"
									step="0.1"
									required
									class="w-20 rounded text-sm"
								/>
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
		{#if form?.costError}<p style="color: var(--critical)">{form.costError}</p>{/if}
		{#if form?.costsSaved}<p style="color: var(--status-moved)">Saved.</p>{/if}
		<button class="rounded px-4 py-2 font-medium text-white" style="background: var(--status-planned)">
			Save activity load
		</button>
	</form>
</section>

<section class="max-w-md rounded border p-4" style="border-color: var(--hairline); background: var(--surface)">
	<h2 class="mb-1 font-medium">Manage an apartment</h2>
	<p class="mb-3 text-sm" style="color: var(--muted)">
		Opens the same editor residents use, for any apartment.
	</p>
	<form method="GET" action="/my" class="flex items-end gap-3 text-sm">
		<label>
			Apartment number
			<input type="number" name="apartment" min="1" max="179" required class="mt-1 w-28 rounded text-sm" />
		</label>
		<button class="rounded px-4 py-2 font-medium text-white" style="background: var(--status-planned)">
			Open
		</button>
	</form>
</section>

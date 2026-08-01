<script lang="ts">
	let { data, form } = $props();

	const fields = [
		{ key: 'totalElevators', label: 'Elevators in total' },
		{ key: 'fullHeightElevators', label: '…of which reach floor 31' },
		{ key: 'truckSpaces', label: 'Truck or large-van spaces (moving, deliveries)' },
		{ key: 'vanSpaces', label: 'Small-van spaces (other activities)' }
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
					class="w-24 rounded border-gray-300 text-sm"
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

<section class="max-w-md rounded border p-4" style="border-color: var(--hairline); background: var(--surface)">
	<h2 class="mb-1 font-medium">Manage an apartment</h2>
	<p class="mb-3 text-sm" style="color: var(--muted)">
		Opens the same editor residents use, for any apartment.
	</p>
	<form method="GET" action="/my" class="flex items-end gap-3 text-sm">
		<label>
			Apartment number
			<input type="number" name="apartment" min="1" max="179" required class="mt-1 w-28 rounded border-gray-300 text-sm" />
		</label>
		<button class="rounded px-4 py-2 font-medium text-white" style="background: var(--status-planned)">
			Open
		</button>
	</form>
</section>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { RESIDENT_STATUSES, fmtDate } from '$lib/viz';

	let { data, form } = $props();

	const typeLabels = { moving: 'Moving', delivery: 'Delivery', other: 'Other activity' };
	const blockLabels = { morning: 'Morning', afternoon: 'Afternoon', full_day: 'Full day' };
	const inputClass = 'mt-1 rounded border-gray-300 text-sm';
	const statusColor = {
		no_move_planned: 'var(--status-noplan)',
		planned: 'var(--status-planned)',
		moved_in: 'var(--status-moved)'
	} as const;

	let savedFor = $state<number | null>(null);
	const autoSave = (apartmentNumber: number) => {
		return () =>
			async ({ update }: { update: (opts?: { reset?: boolean }) => Promise<void> }) => {
				await update({ reset: false });
				savedFor = apartmentNumber;
				setTimeout(() => (savedFor = null), 2000);
			};
	};
</script>

<svelte:head><title>My apartment — Crystal Tower</title></svelte:head>

<div class="mb-6 flex items-baseline justify-between">
	<h1 class="text-xl font-semibold">My apartment</h1>
	<form method="POST" action="?/signout">
		<button class="text-sm hover:underline" style="color: var(--ink-2)">
			Sign out ({data.email})
		</button>
	</form>
</div>

{#if form?.error}
	<p class="mb-4 rounded border px-3 py-2 text-sm" style="border-color: var(--critical); color: var(--critical)">
		{form.error}
	</p>
{/if}

{#if data.apartments.length === 0}
	<p class="text-sm" style="color: var(--ink-2)">
		{#if data.admin}
			You are logged in as an admin with no apartment of your own. Open any apartment from the
			<a href="/admin" class="underline">admin page</a>.
		{:else}
			No apartment is linked to {data.email}. Contact the building manager.
		{/if}
	</p>
{/if}

{#each data.apartments as apt (apt.number)}
	<section class="mb-8 rounded border p-4" style="border-color: var(--hairline); background: var(--surface)">
		<div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
			<h2 class="font-semibold">
				Apartment {apt.number}
				<span class="text-sm font-normal" style="color: var(--muted)">floor {apt.floor}</span>
			</h2>
			<a
				href="/announce?apartment={apt.number}"
				class="rounded px-4 py-2 text-sm font-medium text-white"
				style="background: var(--status-planned)"
			>
				+ Announce activity
			</a>
		</div>

		<form method="POST" action="?/setStatus" use:enhance={autoSave(apt.number)} class="mb-5">
			<input type="hidden" name="apartment" value={apt.number} />
			<p class="mb-2 flex items-baseline gap-3 text-sm" style="color: var(--ink-2)">
				How far along is your move-in?
				{#if savedFor === apt.number}
					<span class="font-medium" style="color: var(--status-moved)">Saved ✓</span>
				{/if}
			</p>
			<div class="grid gap-2 sm:grid-cols-3">
				{#each RESIDENT_STATUSES as s (s.key)}
					{@const active = apt.status === s.key}
					<label
						class="cursor-pointer rounded-lg border-2 p-3 transition {active ? 'box-' + s.key : ''}"
						style="border-color: {active ? statusColor[s.key] : 'var(--hairline)'}"
					>
						<input
							type="radio"
							name="status"
							value={s.key}
							checked={active}
							class="sr-only"
							onchange={(e) => e.currentTarget.form?.requestSubmit()}
						/>
						<span class="flex items-center gap-2 font-medium">
							{#if !active}
								<span class="h-3 w-3 shrink-0 rounded-full" style="background: {statusColor[s.key]}"></span>
							{/if}
							{s.label}
						</span>
						<span class="mt-1 block text-xs {active ? 'opacity-80' : ''}" style={active ? '' : 'color: var(--muted)'}>
							{s.hint}
						</span>
					</label>
				{/each}
			</div>
			{#if apt.status === 'planned'}
				<label class="mt-3 block text-sm">
					When do you plan to move in?
					<input
						type="date"
						name="plannedMoveDate"
						value={apt.plannedMoveDate ?? ''}
						class="{inputClass} block"
						onchange={(e) => e.currentTarget.form?.requestSubmit()}
					/>
				</label>
			{/if}
			{#if data.admin && apt.status !== 'no_data'}
				<button
					name="status"
					value="no_data"
					class="mt-2 text-xs hover:underline"
					style="color: var(--muted)"
				>
					Reset to “No response” (admin)
				</button>
			{/if}
			<noscript><button class="mt-2 rounded border px-3 py-1 text-sm">Save</button></noscript>
		</form>

		<h3 class="mb-2 text-sm font-medium">Activities</h3>
		{#if apt.acts.length === 0}
			<p class="text-sm" style="color: var(--muted)">
				Nothing announced yet — use “Announce activity” above to add your move or delivery.
			</p>
		{:else}
			<ul class="divide-y rounded border" style="border-color: var(--hairline)">
				{#each apt.acts as a (a.id)}
					<li class="px-3 py-2 text-sm" style="border-color: var(--hairline)">
						<div class="flex flex-wrap items-center gap-3 {a.status === 'cancelled' ? 'line-through opacity-50' : ''}">
							<span class="w-32">{fmtDate(a.date)}</span>
							<span class="w-28">{typeLabels[a.type]}</span>
							<span class="w-24" style="color: var(--ink-2)">{blockLabels[a.block]}</span>
							{#if a.note}<span style="color: var(--muted)">{a.note}</span>{/if}
						</div>
						{#if a.status === 'active'}
							<div class="mt-1 flex gap-3">
								<details>
									<summary class="cursor-pointer text-xs hover:underline" style="color: var(--ink-2)">
										Adjust
									</summary>
									<form method="POST" action="?/update" class="mt-2 flex flex-wrap items-end gap-3">
										<input type="hidden" name="id" value={a.id} />
										<label class="text-xs">
											Type
											<select name="type" class={inputClass}>
												{#each Object.entries(typeLabels) as [value, label] (value)}
													<option {value} selected={a.type === value}>{label}</option>
												{/each}
											</select>
										</label>
										<label class="text-xs">
											Date
											<input type="date" name="date" value={a.date} required class={inputClass} />
										</label>
										<label class="text-xs">
											Time
											<select name="block" class={inputClass}>
												{#each Object.entries(blockLabels) as [value, label] (value)}
													<option {value} selected={a.block === value}>{label}</option>
												{/each}
											</select>
										</label>
										<label class="text-xs">
											Note
											<input name="note" value={a.note ?? ''} maxlength="200" class={inputClass} />
										</label>
										<button class="rounded px-3 py-1.5 text-xs font-medium text-white" style="background: var(--status-planned)">
											Save
										</button>
									</form>
								</details>
								<form method="POST" action="?/cancel">
									<input type="hidden" name="id" value={a.id} />
									<button class="text-xs hover:underline" style="color: var(--critical)">Cancel booking</button>
								</form>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/each}

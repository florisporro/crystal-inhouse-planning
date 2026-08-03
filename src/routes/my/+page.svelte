<script lang="ts">
	import { enhance } from '$app/forms';
	import { RESIDENT_STATUSES, fmtDate } from '$lib/viz';

	let { data, form } = $props();

	const typeLabels = { moving: 'Moving', delivery: 'Delivery', other: 'Other activity' };
	const blockLabels = { morning: 'Morning', afternoon: 'Afternoon', full_day: 'Full day' };
	const inputClass = 'mt-1 rounded text-sm';
	const statusColor = {
		no_move_planned: 'var(--status-noplan)',
		planned: 'var(--status-planned)',
		moved_in: 'var(--status-moved)'
	} as const;

	let savedFor = $state<number | null>(null);
	const autoSave = (apartmentNumber: number) => {
		return () =>
			async ({
				result,
				update
			}: {
				result: { type: string };
				update: (opts?: { reset?: boolean }) => Promise<void>;
			}) => {
				await update({ reset: false });
				if (result.type === 'failure') return;
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
	<p
		class="mb-4 rounded border px-3 py-2 text-sm"
		style="border-color: var(--critical); color: var(--critical)"
	>
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
	{@const needsStatus = apt.status === 'no_data' && !data.admin}
	<section
		class="mb-8 rounded border p-4"
		style="border-color: var(--hairline); background: var(--surface)"
	>
		<div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
			<h2 class="font-semibold">
				Apartment {apt.number}
				<span class="text-sm font-normal" style="color: var(--muted)">floor {apt.floor}</span>
			</h2>
			{#if !needsStatus}
				<a
					href="/announce?apartment={apt.number}"
					class="rounded px-4 py-2 text-sm font-medium text-white"
					style="background: var(--status-planned)"
				>
					+ Announce activity
				</a>
			{/if}
		</div>

		<form method="POST" action="?/setStatus" use:enhance={autoSave(apt.number)} class="mb-5">
			<input type="hidden" name="apartment" value={apt.number} />
			{#if needsStatus}
				<div
					class="mb-3 rounded border-l-4 p-3"
					style="border-color: var(--status-planned); background: var(--page)"
				>
					<p class="font-medium">
						First things first — what's the move-in status of your apartment?
					</p>
					<p class="mt-1 text-sm" style="color: var(--ink-2)">
						Pick one below to unlock announcing moves, deliveries and other activities.
					</p>
				</div>
			{/if}
			<p class="mb-2 flex items-baseline gap-3 text-sm" style="color: var(--ink-2)">
				{#if !needsStatus}How far along is your move-in?{/if}
				{#if savedFor === apt.number}
					<span class="font-medium" style="color: var(--status-moved)">Saved ✓</span>
				{/if}
			</p>
			<div class="grid gap-2 sm:grid-cols-3">
				{#each RESIDENT_STATUSES as s (s.key)}
					{@const active = apt.status === s.key}
					<!-- "planned" is a link into the announce wizard (type preselected);
					     the other statuses save in place via the radio -->
					<svelte:element
						this={s.key === 'planned' ? 'a' : 'label'}
						href={s.key === 'planned' ? `/announce?apartment=${apt.number}&type=moving` : undefined}
						class="cursor-pointer rounded-lg border-2 p-3 transition {active ? 'box-' + s.key : ''}"
						style="border-color: {active ? statusColor[s.key] : 'var(--hairline)'}"
					>
						{#if s.key !== 'planned'}
							<input
								type="radio"
								name="status"
								value={s.key}
								checked={active}
								class="sr-only"
								onchange={(e) => e.currentTarget.form?.requestSubmit()}
							/>
						{/if}
						<span class="flex items-center gap-2 font-medium">
							{#if !active}
								<span class="h-3 w-3 shrink-0 rounded-full" style="background: {statusColor[s.key]}"
								></span>
							{/if}
							{s.label}{#if s.key === 'planned' && active && apt.plannedMoveDate}&nbsp;—
								{fmtDate(apt.plannedMoveDate)}{/if}
						</span>
						<span
							class="mt-1 block text-xs {active ? 'opacity-80' : ''}"
							style={active ? '' : 'color: var(--muted)'}
						>
							{s.hint}
						</span>
					</svelte:element>
				{/each}
			</div>
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

		{#if !needsStatus}
			<h3 class="mb-2 text-sm font-medium">Activities</h3>
			{#if apt.acts.length === 0}
				<p class="text-sm" style="color: var(--muted)">
					Nothing announced yet — use “Announce activity” above to add your move or delivery.
				</p>
			{:else}
				<ul class="divide-y rounded border" style="border-color: var(--hairline)">
					{#each apt.acts as a (a.id)}
						<li class="px-3 py-2 text-sm" style="border-color: var(--hairline)">
							<div
								class="flex flex-wrap items-center gap-3 {a.status === 'cancelled'
									? 'line-through opacity-50'
									: ''}"
							>
								<span class="w-32">{fmtDate(a.date)}</span>
								<span class="w-28">{typeLabels[a.type]}</span>
								<span class="w-24" style="color: var(--ink-2)">{blockLabels[a.block]}</span>
								{#if a.note}<span style="color: var(--muted)">{a.note}</span>{/if}
							</div>
							{#if a.status === 'active'}
								<div class="mt-1 flex gap-3">
									<details>
										<summary
											class="cursor-pointer text-xs hover:underline"
											style="color: var(--ink-2)"
										>
											Adjust
										</summary>
										<form
											method="POST"
											action="?/update"
											class="mt-2 flex flex-wrap items-end gap-3"
										>
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
												<input
													name="note"
													value={a.note ?? ''}
													maxlength="200"
													class={inputClass}
												/>
											</label>
											<button
												class="rounded px-3 py-1.5 text-xs font-medium text-white"
												style="background: var(--status-planned)"
											>
												Save
											</button>
										</form>
									</details>
									<form method="POST" action="?/cancel">
										<input type="hidden" name="id" value={a.id} />
										<button class="text-xs hover:underline" style="color: var(--critical)"
											>Cancel booking</button
										>
									</form>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</section>
{/each}

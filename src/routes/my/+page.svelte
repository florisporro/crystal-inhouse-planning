<script lang="ts">
	import { enhance } from '$app/forms';
	import { RESIDENT_STATUSES, fmtDate } from '$lib/viz';
	import {
		GATE_COOLDOWN_MS,
		GATE_MESSAGES,
		GATE_TERMS,
		gateActivity,
		withHuismeester,
		type GatePhase
	} from '$lib/gate';

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

	// --- gate opener ---------------------------------------------------------
	let dialog = $state<HTMLDialogElement | null>(null);
	let gateApt = $state<number | null>(null);
	let checked = $state<boolean[]>([]);
	let phase = $state<GatePhase | 'idle'>('idle');
	let gateError = $state<string | null>(null);
	let timer: ReturnType<typeof setInterval> | undefined;

	const allChecked = $derived(GATE_TERMS.every((_, i) => checked[i]));

	// cooldown countdown: seeded from the server on load, overridden locally the
	// moment a gate open succeeds so reopening the dialog without a page reload
	// still shows the wait (data.apartments won't reflect the new row until then)
	let localCooldowns = $state<Record<number, number>>({});
	let cooldownUntil = $state<number | null>(null);
	let now = $state(Date.now());
	let clockTimer: ReturnType<typeof setInterval> | undefined;
	const remainingSec = $derived(
		cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0
	);

	const stopPolling = () => clearInterval(timer);
	const stopClock = () => clearInterval(clockTimer);
	$effect(() => () => {
		stopPolling();
		stopClock();
	});

	function openDialog(apt: { number: number; gateCooldownUntil: number | null }) {
		gateApt = apt.number;
		checked = [];
		phase = 'idle';
		gateError = null;
		cooldownUntil = localCooldowns[apt.number] ?? apt.gateCooldownUntil;
		now = Date.now();
		stopClock();
		clockTimer = setInterval(() => (now = Date.now()), 1000);
		dialog?.showModal();
	}

	function closeDialog() {
		stopPolling();
		stopClock();
		dialog?.close();
	}

	/** follow the call until it reaches a terminal phase, or give up after 30s */
	function poll(id: number) {
		const deadline = Date.now() + 30_000;
		timer = setInterval(async () => {
			if (Date.now() > deadline) {
				stopPolling();
				phase = 'failed';
				gateError = withHuismeester('The gate did not answer — try again.', data.huismeesterPhone);
				return;
			}
			try {
				const res = await fetch(`/gate/${id}`);
				if (!res.ok) return; // transient; try again next tick
				phase = (await res.json()).phase;
				if (phase === 'failed') gateError = withHuismeester(GATE_MESSAGES.failed, data.huismeesterPhone);
				if (phase === 'done' || phase === 'failed') stopPolling();
			} catch {
				// offline for a moment — keep polling until the deadline
			}
		}, 1500);
	}

	const onGateSubmit = () => {
		phase = 'dialling';
		gateError = null;
		return async ({ result }: { result: { type: string; data?: Record<string, unknown> } }) => {
			if (result.type === 'success' && result.data?.gateOpenId) {
				if (gateApt !== null) {
					const until = Date.now() + GATE_COOLDOWN_MS;
					localCooldowns[gateApt] = until;
					cooldownUntil = until;
				}
				poll(result.data.gateOpenId as number);
				return;
			}
			phase = 'failed';
			gateError = (result.data?.gateError as string) ?? 'Something went wrong.';
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
	{@const gateAct = gateActivity(apt.acts, data.today)}
	<section class="card mb-8">
		<div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
			<h2 class="font-semibold">
				Apartment {apt.number}
				<span class="text-sm font-normal" style="color: var(--muted)">floor {apt.floor}</span>
			</h2>
			{#if !needsStatus}
				<a href="/announce?apartment={apt.number}" class="btn-primary px-4 py-2 text-sm">
					+ Announce activity
				</a>
			{/if}
		</div>

		{#if gateAct || data.admin}
			<div
				class="mb-5 rounded-lg border-l-4 p-3"
				style="border-color: var(--status-planned); background: var(--page)"
			>
				<p class="font-medium">Gate access</p>
				<p class="mt-1 text-sm" style="color: var(--ink-2)">
					{#if gateAct}
						You have an activity booked today, so you can let your vehicle onto the premises.
					{:else}
						No activity is booked today — as an admin you can still open the gate.
					{/if}
				</p>
				<button class="btn-primary mt-3 px-4 py-2 text-sm" onclick={() => openDialog(apt)}>
					Open the gate
				</button>
			</div>
		{/if}

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
				<ul class="list">
					{#each apt.acts as a (a.id)}
						<li class="px-3 py-2 text-sm">
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
											<button class="btn-primary px-3 py-1.5 text-xs">Save</button>
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

<!-- native <dialog>: focus trap, Esc and backdrop come free -->
<dialog
	bind:this={dialog}
	class="card m-auto w-[min(32rem,calc(100vw-2rem))] backdrop:bg-black/40"
	style="color: var(--ink)"
	onclose={() => {
		stopPolling();
		stopClock();
	}}
>
	{#if phase === 'idle'}
		<h2 class="font-semibold">Open the gate</h2>
		<p class="mt-1 mb-3 text-sm" style="color: var(--ink-2)">
			Confirm all of the following before the gate can be opened.
		</p>
		<form method="POST" action="?/openGate" use:enhance={onGateSubmit}>
			<input type="hidden" name="apartment" value={gateApt} />
			{#each GATE_TERMS as term, i (i)}
				<label class="mb-2 flex items-start gap-2 text-sm">
					<input
						type="checkbox"
						name="terms"
						value={i}
						bind:checked={checked[i]}
						class="mt-0.5 rounded"
					/>
					<span>{term}</span>
				</label>
			{/each}
			<p class="mt-3 text-xs" style="color: var(--muted)">
				This gate opening is logged against apartment {gateApt}.
			</p>
			{#if remainingSec > 0}
				<p class="mt-1 text-xs" style="color: var(--muted)">
					The gate was just opened — available again in {remainingSec}s.
				</p>
			{/if}
			<div class="mt-4 flex items-center gap-3">
				<button
					class="btn-primary px-4 py-2 text-sm disabled:opacity-40"
					disabled={!allChecked || remainingSec > 0}
				>
					{remainingSec > 0 ? `Wait ${remainingSec}s` : 'Open the gate'}
				</button>
				<button
					type="button"
					class="text-sm hover:underline"
					style="color: var(--ink-2)"
					onclick={closeDialog}
				>
					Cancel
				</button>
			</div>
		</form>
	{:else}
		<h2 class="font-semibold">Opening the gate</h2>
		<p class="mt-3 flex items-center gap-3 text-sm" aria-live="polite">
			{#if phase === 'dialling' || phase === 'ringing'}
				<svg class="h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
					<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25" />
					<path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" />
				</svg>
			{/if}
			<span style={phase === 'failed' ? 'color: var(--critical)' : ''}>
				{gateError ?? GATE_MESSAGES[phase]}
			</span>
		</p>
		{#if phase === 'done' || phase === 'failed'}
			<button class="btn-primary mt-4 px-4 py-2 text-sm" onclick={closeDialog}>Close</button>
		{/if}
	{/if}
</dialog>

<script lang="ts">
	let { form } = $props();
</script>

<svelte:head><title>Log in — Crystal Tower</title></svelte:head>

<div class="mx-auto max-w-sm">
	<h1 class="mb-1 text-xl font-semibold">Log in</h1>
	<p class="mb-4 text-sm" style="color: var(--ink-2)">
		Enter your apartment number and email address. If they match our records, we'll email you a
		login link.
	</p>

	{#if form?.sent}
		<p
			class="rounded border p-3 text-sm"
			style="border-color: var(--hairline); background: var(--surface)"
		>
			If the apartment number and email address match, a login link is on its way. It is valid for 5
			minutes.
		</p>
	{:else}
		<form method="POST" class="space-y-3">
			<label class="block text-sm">
				Apartment number
				<input
					name="apartment"
					type="number"
					min="1"
					max="179"
					required
					class="mt-1 w-full rounded"
				/>
			</label>
			<label class="block text-sm">
				Email address
				<input name="email" type="email" required class="mt-1 w-full rounded" />
			</label>
			{#if form?.error}<p class="text-sm" style="color: var(--critical)">{form.error}</p>{/if}
			<button
				type="submit"
				class="rounded px-4 py-2 text-sm font-medium text-white"
				style="background: var(--status-planned)"
			>
				Send login link
			</button>
		</form>
	{/if}
</div>

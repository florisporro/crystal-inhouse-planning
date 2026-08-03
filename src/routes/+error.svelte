<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="py-16 text-center">
	<p class="text-5xl font-semibold" style="color: var(--ink-2)">{page.status}</p>
	<p class="mt-3 text-lg">{page.error?.message ?? 'Something went wrong'}</p>
	<a href="/" class="mt-6 inline-block hover:underline" style="color: var(--status-planned)">
		← Back to overview
	</a>
</div>

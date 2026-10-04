<script lang="ts">
	import type { TocEntry } from './markdown';

	let { toc }: { toc: TocEntry[] } = $props();
	let current = $state('_top');

	// highlight the last heading that scrolled past the top of the viewport
	$effect(() => {
		const headings = toc
			.map((t) => document.getElementById(t.id))
			.filter((h): h is HTMLElement => !!h);
		const update = () => {
			const passed = headings.filter((h) => h.getBoundingClientRect().top < 120);
			current = passed.at(-1)?.id ?? '_top';
		};
		const observer = new IntersectionObserver(update, { rootMargin: '0px 0px -60% 0px' });
		headings.forEach((h) => observer.observe(h));
		update();
		return () => observer.disconnect();
	});
</script>

<ul class="wiki-toc space-y-1 text-sm">
	<li><a href="#_top" aria-current={current === '_top' ? 'true' : undefined}>Overview</a></li>
	{#each toc as t (t.id)}
		<li class:pl-3={t.depth === 3}>
			<a href="#{t.id}" aria-current={current === t.id ? 'true' : undefined}>{t.text}</a>
		</li>
	{/each}
</ul>

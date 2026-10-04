<script lang="ts">
	import { onMount } from 'svelte';
	import { Editor } from '@tiptap/core';
	import { Markdown } from '@tiptap/markdown';
	import { CalloutDecorations, extensions } from './extensions';

	let { value = $bindable(), pages }: { value: string; pages: { slug: string; title: string }[] } =
		$props();

	let element: HTMLDivElement;
	let editor = $state<Editor | null>(null);
	// bumped on every transaction so toolbar active states re-evaluate
	let tick = $state(0);
	let linkOpen = $state(false);
	let linkHref = $state('');
	let uploading = $state(false);
	let uploadError = $state('');
	let fileInput: HTMLInputElement;

	onMount(() => {
		editor = new Editor({
			element,
			extensions: [...extensions, Markdown, CalloutDecorations],
			content: value,
			contentType: 'markdown',
			editorProps: {
				attributes: { class: 'wiki-prose min-h-64 px-4 py-3 focus:outline-none' }
			},
			onTransaction: () => tick++,
			onUpdate: ({ editor }) => (value = editor.getMarkdown())
		});
		return () => editor?.destroy();
	});

	const active = (name: string, attrs?: Record<string, unknown>) => {
		void tick; // re-evaluate on every transaction
		return editor?.isActive(name, attrs) ?? false;
	};
	const run = (fn: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) =>
		editor && fn(editor.chain().focus()).run();

	function togglePrivate() {
		run((c) => (active('privateBlock') ? c.lift('privateBlock') : c.wrapIn('privateBlock')));
	}

	function insertCallout(e: Event & { currentTarget: HTMLSelectElement }) {
		const type = e.currentTarget.value;
		e.currentTarget.value = '';
		if (!type) return;
		run((c) =>
			c.insertContent({
				type: 'blockquote',
				content: [
					{ type: 'paragraph', content: [{ type: 'text', text: `[!${type}] ` }] },
					{ type: 'paragraph' }
				]
			})
		);
	}

	function openLink() {
		linkHref = editor?.getAttributes('link').href ?? '';
		linkOpen = true;
	}

	function applyLink(e: SubmitEvent) {
		e.preventDefault();
		const page = pages.find((p) => p.title.toLowerCase() === linkHref.trim().toLowerCase());
		const href = page ? `wiki:${page.slug}` : linkHref.trim();
		run((c) =>
			href ? c.extendMarkRange('link').setLink({ href }) : c.extendMarkRange('link').unsetLink()
		);
		linkOpen = false;
	}

	async function upload() {
		const file = fileInput.files?.[0];
		fileInput.value = '';
		if (!file) return;
		uploading = true;
		uploadError = '';
		const body = new FormData();
		body.set('file', file);
		const res = await fetch('/wiki/img', { method: 'POST', body });
		uploading = false;
		if (!res.ok) {
			uploadError = (await res.json().catch(() => null))?.message ?? 'Upload failed';
			return;
		}
		const { src } = await res.json();
		run((c) => c.setImage({ src, alt: file.name.replace(/\.[^.]+$/, '') }));
	}

	const btn = 'rounded px-2 py-1 text-sm hover:bg-[var(--page)] disabled:opacity-40';
	const on = 'background: var(--page); font-weight: 600';
</script>

<div class="card p-0!">
	<div
		class="flex flex-wrap items-center gap-1 border-b p-1.5"
		style="border-color: var(--hairline)"
	>
		<button
			type="button"
			class={btn}
			style={active('heading', { level: 2 }) ? on : ''}
			onclick={() => run((c) => c.toggleHeading({ level: 2 }))}>H2</button
		>
		<button
			type="button"
			class={btn}
			style={active('heading', { level: 3 }) ? on : ''}
			onclick={() => run((c) => c.toggleHeading({ level: 3 }))}>H3</button
		>
		<button
			type="button"
			class="{btn} font-bold"
			style={active('bold') ? on : ''}
			onclick={() => run((c) => c.toggleBold())}
			aria-label="Bold">B</button
		>
		<button
			type="button"
			class="{btn} italic"
			style={active('italic') ? on : ''}
			onclick={() => run((c) => c.toggleItalic())}
			aria-label="Italic">I</button
		>
		<button
			type="button"
			class={btn}
			style={active('bulletList') ? on : ''}
			onclick={() => run((c) => c.toggleBulletList())}>• List</button
		>
		<button
			type="button"
			class={btn}
			style={active('orderedList') ? on : ''}
			onclick={() => run((c) => c.toggleOrderedList())}>1. List</button
		>
		<button type="button" class={btn} style={active('link') ? on : ''} onclick={openLink}
			>Link</button
		>
		<button type="button" class={btn} disabled={uploading} onclick={() => fileInput.click()}>
			{uploading ? 'Uploading…' : 'Image'}
		</button>
		<input
			bind:this={fileInput}
			type="file"
			accept="image/png,image/jpeg,image/gif,image/webp"
			class="hidden"
			onchange={upload}
		/>
		<select
			class="rounded border-0 py-1 pr-7 pl-2 text-sm"
			aria-label="Insert callout"
			onchange={insertCallout}
		>
			<option value="">Callout</option>
			<option value="info">Info</option>
			<option value="tip">Tip</option>
			<option value="warning">Warning</option>
			<option value="danger">Danger</option>
		</select>
		<button
			type="button"
			class={btn}
			style={active('privateBlock') ? on : ''}
			onclick={togglePrivate}
			title="Only residents who are logged in can see this part"
		>
			🔒 {active('privateBlock') ? 'Make public' : 'Residents only'}
		</button>
		<span class="ml-auto"></span>
		<button type="button" class={btn} onclick={() => run((c) => c.undo())} aria-label="Undo"
			>↶</button
		>
		<button type="button" class={btn} onclick={() => run((c) => c.redo())} aria-label="Redo"
			>↷</button
		>
	</div>
	{#if linkOpen}
		<form
			class="flex gap-2 border-b p-2 text-sm"
			style="border-color: var(--hairline)"
			onsubmit={applyLink}
		>
			<input
				bind:value={linkHref}
				list="wiki-pages"
				placeholder="Page title or https://…"
				class="w-full rounded text-sm"
				aria-label="Link to"
			/>
			<datalist id="wiki-pages">
				{#each pages as p (p.slug)}<option value={p.title}></option>{/each}
			</datalist>
			<button class="btn-primary px-3">Apply</button>
			<button type="button" class="px-2" onclick={() => (linkOpen = false)}>Cancel</button>
		</form>
	{/if}
	{#if uploadError}<p class="px-3 pt-2 text-sm" style="color: var(--critical)">
			{uploadError}
		</p>{/if}
	<div bind:this={element}></div>
</div>

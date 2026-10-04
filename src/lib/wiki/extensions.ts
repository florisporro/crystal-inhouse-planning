import { Extension, Node, createBlockMarkdownSpec } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { CALLOUTS } from './markdown';

// `:::private … :::` in markdown; residents-only section
export const PrivateBlock = Node.create({
	name: 'privateBlock',
	group: 'block',
	content: 'block+',
	defining: true,
	parseHTML: () => [{ tag: 'section[data-private]' }],
	renderHTML: () => ['section', { 'data-private': '', class: 'wiki-private' }, 0],
	...createBlockMarkdownSpec({ nodeName: 'privateBlock', name: 'private' })
});

// one list for the editor and the server-side normalizer, so stored markdown
// always looks exactly like what the editor writes back
export const extensions = [
	StarterKit.configure({
		underline: false, // no markdown syntax for it
		link: { protocols: ['wiki'], openOnClick: false, autolink: true }
	}),
	Image,
	PrivateBlock
];

// editor only: shows `[!type]` blockquotes as callouts while editing. The marker
// text stays (it is the markdown), just muted to the callout's colour.
export const CalloutDecorations = Extension.create({
	name: 'calloutDecorations',
	addProseMirrorPlugins() {
		const decorate = (doc: PMNode) => {
			const decorations: Decoration[] = [];
			doc.descendants((node, pos) => {
				if (node.type.name !== 'blockquote') return;
				const first = node.firstChild;
				const m = first?.textContent.match(/^\[!(\w+)\]/);
				const type = m && CALLOUTS[m[1].toLowerCase()];
				if (!m || !type) return;
				decorations.push(
					Decoration.node(pos, pos + node.nodeSize, { class: `callout callout-${type}` })
				);
				decorations.push(
					Decoration.inline(pos + 2, pos + 2 + m[0].length, { class: 'callout-marker' })
				);
			});
			return DecorationSet.create(doc, decorations);
		};
		return [
			new Plugin({
				key: new PluginKey('calloutDecorations'),
				state: {
					init: (_, { doc }) => decorate(doc),
					apply: (tr, old) => (tr.docChanged ? decorate(tr.doc) : old)
				},
				props: {
					decorations(state) {
						return this.getState(state);
					}
				}
			})
		];
	}
});

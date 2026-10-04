import {
	Marked,
	type RendererExtension,
	type Token,
	type Tokens,
	type TokenizerAndRendererExtension
} from 'marked';

// must match what PrivateBlock in extensions.ts serializes
// closing ::: must start a line, or `a:::b` in the text would end the block early
const PRIVATE = /^:::private[^\n]*\n((?:[\s\S]*?\n)?):::[ \t]*(?:\n+|$)/;

const privateBlock: TokenizerAndRendererExtension = {
	name: 'private',
	level: 'block',
	start: (src) => src.match(/^:::private/m)?.index,
	tokenizer(src) {
		const m = PRIVATE.exec(src);
		if (m) return { type: 'private', raw: m[0], tokens: this.lexer.blockTokens(m[1], []) };
	},
	renderer(token) {
		return `<section class="wiki-private">${this.parser.parse(token.tokens ?? [])}</section>`;
	}
};

// stands in for hidden content for logged-out visitors; carries nothing from it
const lockedBlock: RendererExtension = {
	name: 'locked',
	renderer: (token) =>
		`<aside class="wiki-locked"><p><strong>🔒 This part is for residents only.</strong> <a href="${esc(token.href)}">Log in to read it</a></p></aside>\n`
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const SAFE_HREF = /^(https?:|mailto:|tel:|\/(?!\/)|#)/i;
const IMG_SRC = /^\/wiki\/img\/[0-9a-f]{32}$/;

export const slug = (s: string) =>
	s
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);

// `> [!type] Optional title` (GitHub/Obsidian). Aliases map onto four looks.
export const CALLOUTS: Record<string, 'info' | 'tip' | 'warning' | 'danger'> = {
	info: 'info',
	note: 'info',
	important: 'info',
	tip: 'tip',
	warning: 'warning',
	danger: 'danger',
	caution: 'danger'
};
const CALLOUT_TITLE = { info: 'Info', tip: 'Tip', warning: 'Warning', danger: 'Danger' };
const svg = (d: string) =>
	`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const CALLOUT_ICON = {
	info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
	tip: svg('<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>'),
	warning: svg(
		'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>'
	),
	danger: svg('<path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9zM12 8v4M12 16h.01"/>')
};
// first line of the first paragraph: marker, then the optional title
const CALLOUT = /^<p>\[!(\w+)\][ \t]*(.*?)[ \t]*(\n|<\/p>\n?)/;

const lexer = new Marked({ gfm: true, extensions: [privateBlock] });

type Heading = Tokens.Heading & { id?: string };

// ids from the full token list, private blocks included, so a heading has the
// same id for visitors and residents
function tokens(md: string) {
	const toks = lexer.lexer(md);
	const seen = new Map<string, number>();
	const walk = (list: Token[]) => {
		for (const t of list) {
			if (t.type === 'heading') {
				const base = slug(t.text) || 'section';
				const n = (seen.get(base) ?? 0) + 1;
				seen.set(base, n);
				(t as Heading).id = n === 1 ? base : `${base}-${n}`;
			}
			if ('tokens' in t && t.tokens && t.type !== 'heading') walk(t.tokens);
		}
	};
	walk(toks);
	return toks;
}

// an unclosed `:::private` lexes as a plain paragraph; fail closed and treat
// everything from there to the end as private
function split(toks: Token[]) {
	const open = toks.findIndex(
		(t) => t.type !== 'private' && t.raw.trimStart().startsWith(':::private')
	);
	const rest = open < 0 ? toks : toks.slice(0, open);
	return {
		public: rest.filter((t) => t.type !== 'private'),
		private: [...rest.filter((t) => t.type === 'private'), ...(open < 0 ? [] : toks.slice(open))]
	};
}

const raws = (toks: Token[]) => toks.map((t) => t.raw.trim()).filter(Boolean);

export type Resolve = (slug: string) => string | null; // page slug → URL, null if missing
export type TocEntry = { depth: 2 | 3; id: string; text: string };

function parser(opts: { resolve: Resolve; toc?: TocEntry[] }) {
	return new Marked({
		gfm: true,
		extensions: [privateBlock, lockedBlock],
		renderer: {
			// residents write this; never pass raw HTML through
			html: ({ text }) => esc(text),
			heading(token) {
				const { depth, tokens: inline, id } = token as Heading;
				const inner = this.parser.parseInline(inline);
				if (!id) return `<h${depth}>${inner}</h${depth}>\n`;
				if (depth === 2 || depth === 3) opts.toc?.push({ depth, id, text: toText(inner) });
				return `<h${depth} id="${id}">${inner}<a class="anchor" href="#${id}" aria-label="Link to this section"></a></h${depth}>\n`;
			},
			blockquote({ tokens: inner }) {
				const body = this.parser.parse(inner);
				const m = CALLOUT.exec(body);
				const type = m && CALLOUTS[m[1].toLowerCase()];
				if (!m || !type) return `<blockquote>\n${body}</blockquote>\n`;
				const rest = body.slice(m[0].length);
				return `<aside class="callout callout-${type}"><p class="callout-title">${CALLOUT_ICON[type]}${m[2] || CALLOUT_TITLE[type]}</p>${m[3] === '\n' ? '<p>' + rest : rest}</aside>\n`;
			},
			link({ href, title, tokens: inline }) {
				const text = this.parser.parseInline(inline);
				if (href.startsWith('wiki:')) {
					const url = opts.resolve(href.slice(5));
					return url
						? `<a href="${esc(url)}">${text}</a>`
						: `<span class="wiki-missing" title="Page does not exist">${text}</span>`;
				}
				if (!SAFE_HREF.test(href)) return text;
				const ext = /^https?:/i.test(href) ? ' rel="noopener noreferrer" target="_blank"' : '';
				return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}${ext}>${text}</a>`;
			},
			image({ href, text }) {
				if (!IMG_SRC.test(href)) return esc(text);
				return `<img src="${href}" alt="${esc(text)}" loading="lazy">`;
			}
		}
	});
}

// each run of hidden blocks becomes one placeholder; an unclosed private block
// hides the rest of the page behind a single one
function lockHidden(toks: Token[], href: string): Token[] {
	const pub = new Set(split(toks).public);
	const out: Token[] = [];
	for (const t of toks) {
		if (pub.has(t)) out.push(t);
		else if (out.findLast((o) => o.type !== 'space')?.type !== 'locked')
			out.push({ type: 'locked', raw: '', href });
	}
	return out;
}

type RenderOpts = { loggedIn: boolean; resolve: Resolve; loginUrl?: string };

export function renderPage(md: string, opts: RenderOpts) {
	const toc: TocEntry[] = [];
	const toks = tokens(md);
	// replaced at token level, before rendering: anonymous HTML never contains private content
	const html = parser({ resolve: opts.resolve, toc }).parser(
		opts.loggedIn ? toks : lockHidden(toks, opts.loginUrl ?? '/login')
	);
	return { html, toc };
}

export const render = (md: string, opts: RenderOpts) => renderPage(md, opts).html;

// top-level blocks: the unit of review for suggestions
export const toBlocks = (md: string) => raws(lexer.lexer(md));

export const fromBlocks = (blocks: string[]) => (blocks.length ? blocks.join('\n\n') + '\n' : '');

export const publicPart = (md: string) => fromBlocks(raws(split(lexer.lexer(md)).public));
export const privatePart = (md: string) => fromBlocks(raws(split(lexer.lexer(md)).private));

const toText = (html: string) =>
	html
		// block tags separate words; inline tags (links, bold) must not add spaces
		.replace(
			/<\/?(?:p|h\d|li|ul|ol|aside|section|blockquote|table|tr|td|th|pre|br|hr|img)\b[^>]*>/g,
			' '
		)
		.replace(/<[^>]+>/g, '')
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
		.replace(
			/&(amp|lt|gt|quot);/g,
			(_, e: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"' })[e]!
		)
		.replace(/\s+/g, ' ')
		.trim();

const textOf = (toks: Token[]) =>
	toks.length ? toText(parser({ resolve: () => '#' }).parser(toks)) : '';

// search index text, split so anonymous search can never match private content
export function plainText(md: string): { public: string; private: string } {
	const { public: pub, private: priv } = split(tokens(md));
	return { public: textOf(pub), private: textOf(priv) };
}

export type Section = { anchor: string; heading: string; public: string; private: string };

// one search row per h2/h3 section; the part before the first heading has anchor ''.
// Privacy is decided on the whole page first, so an unclosed private block also
// hides the headings after it.
export function sections(md: string): Section[] {
	const toks = tokens(md);
	const pub = new Set(split(toks).public);
	const groups: { heading?: Heading; toks: Token[] }[] = [{ toks: [] }];
	for (const t of toks) {
		if (t.type === 'heading' && (t.depth === 2 || t.depth === 3))
			groups.push({ heading: t as Heading, toks: [] });
		else groups.at(-1)!.toks.push(t);
	}
	return groups
		.map(({ heading, toks: body }) => {
			const visible = !heading || pub.has(heading);
			const headingText = heading ? textOf([heading]) : '';
			return {
				anchor: heading && visible ? heading.id! : '',
				heading: visible ? headingText : '',
				public: textOf(body.filter((t) => pub.has(t))),
				private: [visible ? '' : headingText, textOf(body.filter((t) => !pub.has(t)))]
					.filter(Boolean)
					.join(' ')
			};
		})
		.filter((s) => s.heading || s.public || s.private || !s.anchor);
}

export const imageIds = (md: string) => [
	...new Set([...md.matchAll(/\/wiki\/img\/([0-9a-f]{32})/g)].map((m) => m[1]))
];

export const wikiLinks = (md: string) => [
	...new Set([...md.matchAll(/\]\(wiki:([a-z0-9-]+)\)/g)].map((m) => m[1]))
];

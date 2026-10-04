import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { error, fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	user,
	wikiImages,
	wikiPages,
	wikiRevisions,
	wikiSuggestions,
	wikiTopics
} from '$lib/server/db/schema';
import { log } from '$lib/server/log';
import { isAdmin } from '$lib/server/access';
import { diffWords } from 'diff';
import { normalize } from '$lib/wiki/normalize';
import { hunks, merge } from '$lib/wiki/merge';
import {
	fromBlocks,
	imageIds,
	plainText,
	publicPart,
	render,
	renderPage,
	sections,
	slug,
	toBlocks,
	type Resolve
} from '$lib/wiki/markdown';

export { normalize };

// static routes under /wiki that a slug must not shadow
const RESERVED = new Set(['search', 'img', 'new', 'edit', 'history']);

export function slugify(title: string) {
	const s = slug(title);
	return s && !RESERVED.has(s) ? s : `page-${s || Date.now().toString(36)}`;
}

async function uniqueSlug(table: typeof wikiPages | typeof wikiTopics, title: string) {
	const base = slugify(title);
	for (let n = 1; ; n++) {
		const slug = n === 1 ? base : `${base}-${n}`;
		const [hit] = await db.select({ id: table.id }).from(table).where(eq(table.slug, slug));
		if (!hit) return slug;
	}
}

export type Author = { email: string; name: string };

export async function getTree(loggedIn: boolean) {
	const topics = await db
		.select()
		.from(wikiTopics)
		.orderBy(asc(wikiTopics.sort), asc(wikiTopics.id));
	const pages = await db
		.select({
			id: wikiPages.id,
			topicId: wikiPages.topicId,
			slug: wikiPages.slug,
			title: wikiPages.title,
			private: wikiPages.private
		})
		.from(wikiPages)
		.where(loggedIn ? undefined : eq(wikiPages.private, false))
		.orderBy(asc(wikiPages.sort), asc(wikiPages.id));
	return topics.map((t) => ({
		id: t.id,
		slug: t.slug,
		title: t.title,
		pages: pages.filter((p) => p.topicId === t.id)
	}));
}

export async function resolver(): Promise<Resolve> {
	const rows = await db
		.select({ slug: wikiPages.slug, topic: wikiTopics.slug, private: wikiPages.private })
		.from(wikiPages)
		.innerJoin(wikiTopics, eq(wikiTopics.id, wikiPages.topicId));
	// private pages resolve for visitors too: the link leads to a login prompt
	const urls = new Map(rows.map((r) => [r.slug, `/wiki/${r.topic}/${r.slug}`]));
	return (slug) => urls.get(slug) ?? null;
}

export async function getTopic(slug: string, loggedIn: boolean) {
	const tree = await getTree(loggedIn);
	const topic = tree.find((t) => t.slug === slug);
	if (!topic) error(404, 'Not found');
	const [row] = await db
		.select({ intro: wikiTopics.intro })
		.from(wikiTopics)
		.where(eq(wikiTopics.id, topic.id));
	return {
		...topic,
		intro: render(row.intro, { loggedIn: false, resolve: await resolver() })
	};
}

async function findPage(slug: string) {
	const [row] = await db
		.select({
			id: wikiPages.id,
			slug: wikiPages.slug,
			title: wikiPages.title,
			private: wikiPages.private,
			topicId: wikiPages.topicId,
			topicSlug: wikiTopics.slug,
			topicTitle: wikiTopics.title,
			revisionId: wikiPages.revisionId,
			body: wikiRevisions.body,
			editedBy: wikiRevisions.authorName,
			editedAt: wikiRevisions.createdAt
		})
		.from(wikiPages)
		.innerJoin(wikiTopics, eq(wikiTopics.id, wikiPages.topicId))
		.innerJoin(wikiRevisions, eq(wikiRevisions.id, wikiPages.revisionId))
		.where(eq(wikiPages.slug, slug));
	return row;
}

export async function getPageRow(slug: string, loggedIn: boolean) {
	const row = await findPage(slug);
	if (!row || (row.private && !loggedIn)) error(404, 'Not found');
	return row;
}

// a private page for a logged-out visitor is only a login prompt: no title, no content
export async function getPage(slug: string, loggedIn: boolean, loginUrl = '/login') {
	const row = await findPage(slug);
	if (!row) error(404, 'Not found');
	const { slug: s, topicSlug, topicTitle } = row;
	if (row.private && !loggedIn) return { locked: true as const, slug: s, topicSlug, topicTitle };
	const { body, ...rest } = row;
	const { html, toc } = renderPage(body, { loggedIn, resolve: await resolver(), loginUrl });
	return {
		locked: false as const,
		...rest,
		html,
		toc,
		description: plainText(body).public.slice(0, 160)
	};
}

export async function saveRevision(
	pageId: number,
	title: string,
	body: string,
	author: Author,
	suggestionId: number | null = null
) {
	const normalized = normalize(body);
	const [rev] = await db
		.insert(wikiRevisions)
		.values({
			pageId,
			title,
			body: normalized,
			authorEmail: author.email,
			authorName: author.name,
			suggestionId
		})
		.returning({ id: wikiRevisions.id });
	await db.update(wikiPages).set({ title, revisionId: rev.id }).where(eq(wikiPages.id, pageId));
	await reindex(pageId);
	await refreshImagePrivacy();
	return rev.id;
}

export async function createPage(
	topicId: number,
	title: string,
	body: string,
	author: Author,
	opts: { private?: boolean; slug?: string; sort?: number; suggestionId?: number } = {}
) {
	const [last] = await db
		.select({ sort: wikiPages.sort })
		.from(wikiPages)
		.where(eq(wikiPages.topicId, topicId))
		.orderBy(desc(wikiPages.sort))
		.limit(1);
	const [page] = await db
		.insert(wikiPages)
		.values({
			topicId,
			title,
			slug: opts.slug ?? (await uniqueSlug(wikiPages, title)),
			private: opts.private ?? false,
			sort: opts.sort ?? (last ? last.sort + 1 : 0)
		})
		.returning({ id: wikiPages.id, slug: wikiPages.slug });
	await saveRevision(page.id, title, body, author, opts.suggestionId ?? null);
	return page;
}

export async function createTopic(
	title: string,
	intro = '',
	opts: { slug?: string; sort?: number } = {}
) {
	const [last] = await db
		.select({ sort: wikiTopics.sort })
		.from(wikiTopics)
		.orderBy(desc(wikiTopics.sort))
		.limit(1);
	const [topic] = await db
		.insert(wikiTopics)
		.values({
			title,
			intro: intro && normalize(intro),
			slug: opts.slug ?? (await uniqueSlug(wikiTopics, title)),
			sort: opts.sort ?? (last ? last.sort + 1 : 0)
		})
		.returning();
	return topic;
}

export async function reindex(pageId: number) {
	await db.run(sql`DELETE FROM wiki_search WHERE page_id = ${pageId}`);
	const [row] = await db
		.select({ title: wikiPages.title, body: wikiRevisions.body })
		.from(wikiPages)
		.innerJoin(wikiRevisions, eq(wikiRevisions.id, wikiPages.revisionId))
		.where(eq(wikiPages.id, pageId));
	if (!row) return;
	// the page title goes on every row, so "bike side" matches when "bike" is only in the title
	for (const s of sections(row.body))
		await db.run(
			sql`INSERT INTO wiki_search (page_id, anchor, title, heading, public_text, private_text)
				VALUES (${pageId}, ${s.anchor}, ${row.title}, ${s.heading}, ${s.public}, ${s.private})`
		);
}

// the index lives outside drizzle's schema; rebuild it after a migration recreated it
export async function ensureSearchIndex() {
	const [{ n }] = await db.all<{ n: number }>(sql`SELECT count(*) AS n FROM wiki_search`);
	if (n) return;
	const pages = await db.select({ id: wikiPages.id }).from(wikiPages);
	for (const p of pages) await reindex(p.id);
	if (pages.length) log('wiki.reindex', { pages: pages.length });
}

// ponytail: recomputes every image on each save (one query per page); fine for a
// building wiki, make it per-page if the page count reaches the thousands
export async function refreshImagePrivacy() {
	const pages = await db
		.select({ body: wikiRevisions.body })
		.from(wikiPages)
		.innerJoin(wikiRevisions, eq(wikiRevisions.id, wikiPages.revisionId))
		.where(eq(wikiPages.private, false));
	const pub = [...new Set(pages.flatMap((p) => imageIds(publicPart(p.body))))];
	await db.update(wikiImages).set({ private: true });
	if (pub.length)
		await db.update(wikiImages).set({ private: false }).where(inArray(wikiImages.id, pub));
}

export type SearchSection = { anchor: string; heading: string; snippet: string };
export type SearchHit = { slug: string; topic: string; title: string; sections: SearchSection[] };

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ±80 chars around the first hit, terms wrapped in <mark>; returns safe HTML
function snippet(text: string, terms: string[]) {
	const lower = text.toLowerCase();
	const hits = terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0);
	const at = hits.length ? Math.min(...hits) : 0;
	const start = Math.max(0, at - 80);
	const cut =
		(start > 0 ? '…' : '') + text.slice(start, at + 120) + (at + 120 < text.length ? '…' : '');
	const re = new RegExp(`(${terms.map(escRe).join('|')})`, 'gi');
	return escHtml(cut).replace(re, '<mark>$1</mark>');
}

// pages in order of their best-ranked section, each with up to 3 matching sections
export async function search(q: string, loggedIn: boolean, limit = 10): Promise<SearchHit[]> {
	const terms = [
		...new Set(
			q
				.toLowerCase()
				.split(/\s+/)
				.filter((t) => t.length >= 3)
		)
	];
	if (!terms.length) {
		// trigram can't match < 3 characters; fall back to titles
		if (!q.trim()) return [];
		const rows = await db
			.select({ slug: wikiPages.slug, topic: wikiTopics.slug, title: wikiPages.title })
			.from(wikiPages)
			.innerJoin(wikiTopics, eq(wikiTopics.id, wikiPages.topicId))
			.where(
				and(
					sql`${wikiPages.title} LIKE ${'%' + q.trim() + '%'}`,
					loggedIn ? undefined : eq(wikiPages.private, false)
				)
			)
			.limit(limit);
		return rows.map((r) => ({ ...r, sections: [] }));
	}
	const phrase = terms.map((t) => `"${t.replaceAll('"', '""')}"`).join(' AND ');
	// anonymous: never match or snippet the private column, never return private pages
	const match = loggedIn ? phrase : `{title heading public_text} : (${phrase})`;
	const rows = await db.all<{
		slug: string;
		topic: string;
		title: string;
		anchor: string;
		heading: string;
		public_text: string;
		private_text: string;
	}>(sql`
		SELECT p.slug, t.slug AS topic, p.title, s.anchor, s.heading, s.public_text, s.private_text
		FROM wiki_search s
		JOIN wiki_pages p ON p.id = s.page_id
		JOIN wiki_topics t ON t.id = p.topic_id
		WHERE wiki_search MATCH ${match} ${loggedIn ? sql`` : sql`AND p.private = 0`}
		ORDER BY bm25(wiki_search, 0, 0, 5, 8, 1, 1)
		LIMIT 100`);

	const pages = new Map<string, SearchHit>();
	for (const r of rows) {
		let hit = pages.get(r.slug);
		if (!hit) {
			if (pages.size === limit) continue;
			hit = { slug: r.slug, topic: r.topic, title: r.title, sections: [] };
			pages.set(r.slug, hit);
		}
		const text = loggedIn ? `${r.public_text} ${r.private_text}`.trim() : r.public_text;
		const own = `${r.heading} ${text}`.toLowerCase();
		// rows that only matched on the page title add nothing under the page
		if (hit.sections.length < 3 && terms.some((t) => own.includes(t)))
			hit.sections.push({
				anchor: r.anchor,
				heading: r.heading || r.title,
				snippet: snippet(text, terms)
			});
	}
	return [...pages.values()];
}

const MIME: [string, (b: Uint8Array) => boolean][] = [
	['image/png', (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
	['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
	['image/gif', (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46],
	[
		'image/webp',
		(b) =>
			String.fromCharCode(...b.slice(0, 4)) === 'RIFF' &&
			String.fromCharCode(...b.slice(8, 12)) === 'WEBP'
	]
];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const imageDir = () => env.WIKI_IMAGES_DIR || 'data/wiki-images';

// content-addressed, so re-seeding or re-uploading the same file is a no-op.
// Judged by magic bytes, never by the client's content type; no SVG (it can carry script).
export async function storeImage(bytes: Uint8Array, uploadedBy: string) {
	const mime = MIME.find(([, test]) => test(bytes))?.[0];
	if (!mime) return null;
	const id = createHash('sha256').update(bytes).digest('hex').slice(0, 32);
	await mkdir(imageDir(), { recursive: true });
	await writeFile(join(imageDir(), id), bytes);
	await db.insert(wikiImages).values({ id, mime, uploadedBy }).onConflictDoNothing();
	return id;
}

export type WikiUser = { id: string; email: string; name: string; admin: boolean };

export const wikiUser = (u: NonNullable<App.Locals['user']>): WikiUser => ({
	id: u.id,
	email: u.email,
	name: u.name,
	admin: isAdmin(u.email)
});

export const linkTargets = async () =>
	(await getTree(true)).flatMap((t) => t.pages.map((p) => ({ slug: p.slug, title: p.title })));

// shared by the edit and new-page forms: admins publish, residents suggest
export async function submitEdit(
	editor: WikiUser,
	form: FormData,
	target: { page: Awaited<ReturnType<typeof getPageRow>> } | { topicId: number }
) {
	const title = String(form.get('title') ?? '').trim();
	const body = String(form.get('body') ?? '');
	const name = String(form.get('name') ?? '').trim();
	if (!title || title.length > 120)
		return fail(400, { error: 'Give the page a title of at most 120 characters.' });
	if (!name || name.length > 80)
		return fail(400, { error: 'Enter your name, so others know who wrote this.' });
	if (body.length > 200_000) return fail(400, { error: 'This page is too long.' });
	if (name !== editor.name) await db.update(user).set({ name }).where(eq(user.id, editor.id));

	const author = { email: editor.email, name };
	const normalized = normalize(body);

	if ('page' in target) {
		const { page } = target;
		const isPrivate = form.get('private') === 'on';
		const unchanged = normalized === page.body && title === page.title;
		if (editor.admin) {
			if (!unchanged) await saveRevision(page.id, title, normalized, author);
			if (isPrivate !== page.private) {
				await db.update(wikiPages).set({ private: isPrivate }).where(eq(wikiPages.id, page.id));
				await refreshImagePrivacy();
			}
			return { url: `/wiki/${page.topicSlug}/${page.slug}` };
		}
		if (unchanged) return fail(400, { error: 'You have not changed anything yet.' });
		await db.insert(wikiSuggestions).values({
			pageId: page.id,
			baseRevisionId: page.revisionId,
			title,
			body: normalized,
			...authorCols(author)
		});
		log('wiki.suggestion', { page: page.slug });
		return { url: `/wiki/${page.topicSlug}/${page.slug}?suggested` };
	}

	const [topic] = await db.select().from(wikiTopics).where(eq(wikiTopics.id, target.topicId));
	if (!topic) error(404, 'Not found');
	if (editor.admin) {
		const page = await createPage(topic.id, title, normalized, author, {
			private: form.get('private') === 'on'
		});
		return { url: `/wiki/${topic.slug}/${page.slug}` };
	}
	if (!toBlocks(normalized).length)
		return fail(400, { error: 'Write something on the page first.' });
	await db.insert(wikiSuggestions).values({
		topicId: topic.id,
		title,
		body: normalized,
		...authorCols(author)
	});
	log('wiki.suggestion', { topic: topic.slug, new: true });
	return { url: `/wiki/${topic.slug}?suggested` };
}

const authorCols = (a: Author) => ({ authorEmail: a.email, authorName: a.name });

// --- review ------------------------------------------------------------------

export type DiffPart =
	| { kind: 'same'; html: string }
	| {
			kind: 'change';
			id: number;
			conflict: boolean;
			removed: string;
			added: string;
			words: { value: string; added: boolean; removed: boolean }[] | null;
	  };

// HTML for a base → proposed diff; `current` marks changes that conflict with later edits
export async function diffView(
	base: string,
	proposed: string,
	current = base
): Promise<DiffPart[]> {
	const resolve = await resolver();
	const html = (blocks: string[]) => render(fromBlocks(blocks), { loggedIn: true, resolve });
	const parts = hunks(base, proposed);
	const { conflicts } = merge(base, current, parts, new Set());
	return parts.map((p) =>
		p.kind === 'same'
			? { kind: 'same', html: html(p.blocks) }
			: {
					kind: 'change',
					id: p.id,
					conflict: conflicts.has(p.id),
					removed: html(p.removed),
					added: html(p.added),
					// word-level view when one block replaced another
					words:
						p.removed.length === 1 && p.added.length === 1
							? diffWords(p.removed[0], p.added[0]).map((w) => ({
									value: w.value,
									added: !!w.added,
									removed: !!w.removed
								}))
							: null
				}
	);
}

export async function getSuggestion(id: number) {
	const [s] = await db.select().from(wikiSuggestions).where(eq(wikiSuggestions.id, id));
	if (!s) error(404, 'Not found');
	const revBody = async (revId: number | null) =>
		revId
			? ((
					await db
						.select({ body: wikiRevisions.body, title: wikiRevisions.title })
						.from(wikiRevisions)
						.where(eq(wikiRevisions.id, revId))
				)[0] ?? null)
			: null;
	const [page] = s.pageId
		? await db.select().from(wikiPages).where(eq(wikiPages.id, s.pageId))
		: [null];
	const base = await revBody(s.baseRevisionId);
	const current = page ? await revBody(page.revisionId) : null;
	return {
		suggestion: s,
		page,
		base: base?.body ?? '',
		baseTitle: base?.title ?? '',
		current: current?.body ?? '',
		stale: !!page && page.revisionId !== s.baseRevisionId
	};
}

export async function reviewSuggestion(id: number, form: FormData) {
	const { suggestion: s, page, base, current } = await getSuggestion(id);
	if (s.status !== 'open') return fail(400, { error: 'This suggestion was already reviewed.' });
	const author = { email: s.authorEmail, name: s.authorName };
	const reviewNote =
		String(form.get('note') ?? '')
			.trim()
			.slice(0, 1000) || null;
	const done = (status: 'accepted' | 'partial' | 'declined') =>
		db
			.update(wikiSuggestions)
			.set({ status, reviewedAt: new Date(), reviewNote })
			.where(eq(wikiSuggestions.id, id));

	if (form.get('decision') === 'decline') {
		await done('declined');
		return { url: '/admin/wiki' };
	}

	if (!page) {
		const title = String(form.get('title') ?? '').trim() || s.title;
		const topicId = Number(form.get('topicId')) || s.topicId!;
		const created = await createPage(topicId, title, s.body, author, {
			private: form.get('private') === 'on',
			suggestionId: s.id
		});
		await done('accepted');
		const [topic] = await db
			.select({ slug: wikiTopics.slug })
			.from(wikiTopics)
			.where(eq(wikiTopics.id, topicId));
		return { url: `/wiki/${topic.slug}/${created.slug}` };
	}

	const parts = hunks(base, s.body);
	const ids = parts.flatMap((p) => (p.kind === 'change' ? [p.id] : []));
	const accepted = new Set(
		form
			.getAll('accept')
			.map(Number)
			.filter((n) => ids.includes(n))
	);
	const { md, conflicts } = merge(base, current, parts, accepted);
	for (const c of conflicts) accepted.delete(c);
	const titleAccepted = form.get('acceptTitle') === 'on' && s.title !== page.title;
	if (!accepted.size && !titleAccepted) {
		await done('declined');
		return { url: '/admin/wiki' };
	}
	await saveRevision(page.id, titleAccepted ? s.title : page.title, md, author, s.id);
	const all = accepted.size === ids.length && (titleAccepted || s.title === page.title);
	await done(all ? 'accepted' : 'partial');
	const [topic] = await db
		.select({ slug: wikiTopics.slug })
		.from(wikiTopics)
		.where(eq(wikiTopics.id, page.topicId));
	return { url: `/wiki/${topic.slug}/${page.slug}` };
}

export async function openSuggestions() {
	return db
		.select({
			id: wikiSuggestions.id,
			title: wikiSuggestions.title,
			authorName: wikiSuggestions.authorName,
			createdAt: wikiSuggestions.createdAt,
			isNew: sql<boolean>`${wikiSuggestions.pageId} IS NULL`
		})
		.from(wikiSuggestions)
		.where(eq(wikiSuggestions.status, 'open'))
		.orderBy(asc(wikiSuggestions.createdAt));
}

// --- structure (admin) -------------------------------------------------------

// renumbers siblings 0..n while swapping, so duplicate sort values from the seed sort out
export async function move(kind: 'topic' | 'page', id: number, dir: -1 | 1) {
	const table = kind === 'topic' ? wikiTopics : wikiPages;
	let siblings: { id: number }[];
	if (kind === 'topic') {
		siblings = await db
			.select({ id: wikiTopics.id })
			.from(wikiTopics)
			.orderBy(asc(wikiTopics.sort), asc(wikiTopics.id));
	} else {
		const [p] = await db
			.select({ topicId: wikiPages.topicId })
			.from(wikiPages)
			.where(eq(wikiPages.id, id));
		if (!p) return;
		siblings = await db
			.select({ id: wikiPages.id })
			.from(wikiPages)
			.where(eq(wikiPages.topicId, p.topicId))
			.orderBy(asc(wikiPages.sort), asc(wikiPages.id));
	}
	const order = siblings.map((s) => s.id);
	const i = order.indexOf(id);
	const j = i + dir;
	if (i < 0 || j < 0 || j >= order.length) return;
	[order[i], order[j]] = [order[j], order[i]];
	for (const [sort, sid] of order.entries())
		await db.update(table).set({ sort }).where(eq(table.id, sid));
}

export async function updatePage(id: number, fields: { topicId?: number; private?: boolean }) {
	if (fields.topicId) {
		const [last] = await db
			.select({ sort: wikiPages.sort })
			.from(wikiPages)
			.where(eq(wikiPages.topicId, fields.topicId))
			.orderBy(desc(wikiPages.sort))
			.limit(1);
		await db
			.update(wikiPages)
			.set({ topicId: fields.topicId, sort: last ? last.sort + 1 : 0 })
			.where(eq(wikiPages.id, id));
	}
	if (fields.private !== undefined) {
		await db.update(wikiPages).set({ private: fields.private }).where(eq(wikiPages.id, id));
		await refreshImagePrivacy();
	}
}

export async function deletePage(id: number) {
	await db.run(sql`DELETE FROM wiki_search WHERE page_id = ${id}`);
	await db.delete(wikiSuggestions).where(eq(wikiSuggestions.pageId, id));
	await db.update(wikiPages).set({ revisionId: null }).where(eq(wikiPages.id, id));
	await db.delete(wikiRevisions).where(eq(wikiRevisions.pageId, id));
	await db.delete(wikiPages).where(eq(wikiPages.id, id));
	await refreshImagePrivacy();
}

export async function deleteTopic(id: number) {
	const [page] = await db
		.select({ id: wikiPages.id })
		.from(wikiPages)
		.where(eq(wikiPages.topicId, id))
		.limit(1);
	if (page) return fail(400, { error: 'Move or delete the pages in this topic first.' });
	await db.delete(wikiSuggestions).where(eq(wikiSuggestions.topicId, id));
	await db.delete(wikiTopics).where(eq(wikiTopics.id, id));
}

export async function updateTopic(id: number, title: string, intro: string) {
	await db
		.update(wikiTopics)
		.set({ title, intro: intro.trim() ? normalize(intro) : '' })
		.where(eq(wikiTopics.id, id));
}

export async function getHistory(pageId: number) {
	return db
		.select({
			id: wikiRevisions.id,
			title: wikiRevisions.title,
			body: wikiRevisions.body,
			authorName: wikiRevisions.authorName,
			createdAt: wikiRevisions.createdAt
		})
		.from(wikiRevisions)
		.where(eq(wikiRevisions.pageId, pageId))
		.orderBy(desc(wikiRevisions.id));
}

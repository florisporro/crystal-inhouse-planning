// Import wiki content from markdown files. Safe to re-run: topics and pages are
// matched by slug, and a page only gets a new revision when its content changed.
// Pages missing from the seed are left alone. Not part of the boot sequence.
//
//   wiki-seed/<topic-slug>/_topic.md          frontmatter: title, order; body = intro
//   wiki-seed/<topic-slug>/<NN>-<slug>.md     frontmatter: title, order, private
//
// Body: markdown, `:::private … :::` for residents-only sections, `[text](wiki:<slug>)`
// for links between pages, `![alt](./images/x.jpg)` for images (relative to the file).
// Callouts: `> [!info] Optional title` then `> body`; also tip, warning, danger.
// Use ## and ### headings: they build the page's table of contents and search sections.
// Dir via WIKI_SEED_DIR (default: wiki-seed). Run: bun run db:seed-wiki
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { wikiPages, wikiRevisions, wikiTopics } from '$lib/server/db/schema';
import {
	createPage,
	createTopic,
	normalize,
	refreshImagePrivacy,
	saveRevision,
	storeImage,
	type Author
} from '$lib/server/wiki';
import { wikiLinks } from '$lib/wiki/markdown';

const SEED: Author = { email: 'seed', name: 'AI' };
const root = process.env.WIKI_SEED_DIR || 'wiki-seed';
if (!existsSync(root)) throw new Error(`${root} not found`);

function parse(file: string) {
	const src = readFileSync(file, 'utf8');
	const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	const meta: Record<string, string> = {};
	for (const line of (m?.[1] ?? '').split('\n')) {
		const kv = line.match(/^(\w+):\s*(.*?)\s*(?:\s#.*)?$/);
		if (kv) meta[kv[1]] = kv[2].replace(/^(['"])(.*)\1$/, '$2');
	}
	return { meta, body: m ? m[2] : src };
}

async function inlineImages(body: string, file: string) {
	let out = body;
	for (const [whole, alt, src] of body.matchAll(/!\[([^\]]*)\]\((\.{1,2}\/[^)\s]+)\)/g)) {
		const path = resolve(dirname(file), src);
		const id = existsSync(path) ? await storeImage(readFileSync(path), SEED.email) : null;
		if (!id) {
			console.warn(`  ! ${file}: image ${src} missing or not png/jpeg/gif/webp`);
			continue;
		}
		out = out.replace(whole, `![${alt}](/wiki/img/${id})`);
	}
	return out;
}

const order = (meta: Record<string, string>, name: string) =>
	Number(meta.order ?? name.match(/^(\d+)-/)?.[1] ?? 0);

const counts = { topics: 0, created: 0, updated: 0, unchanged: 0 };
const links = new Map<string, string[]>();

const topicDirs = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
for (const dir of topicDirs) {
	const slug = dir.name;
	const topicFile = join(root, slug, '_topic.md');
	const { meta, body } = existsSync(topicFile) ? parse(topicFile) : { meta: {}, body: '' };
	const values = {
		title: meta.title || slug,
		intro: body.trim() && normalize(body),
		sort: order(meta, slug)
	};
	let [topic] = await db.select().from(wikiTopics).where(eq(wikiTopics.slug, slug));
	if (topic) await db.update(wikiTopics).set(values).where(eq(wikiTopics.id, topic.id));
	else topic = await createTopic(values.title, body, { slug, sort: values.sort });
	counts.topics++;

	for (const name of readdirSync(join(root, slug)).filter(
		(f) => f.endsWith('.md') && f !== '_topic.md'
	)) {
		const file = join(root, slug, name);
		const pageSlug = name.replace(/^\d+-/, '').replace(/\.md$/, '');
		const { meta, body: raw } = parse(file);
		const body = await inlineImages(raw, file);
		const title = meta.title || pageSlug;
		const fields = { topicId: topic.id, private: meta.private === 'true', sort: order(meta, name) };
		links.set(pageSlug, wikiLinks(body));

		const [page] = await db
			.select({ id: wikiPages.id, body: wikiRevisions.body, title: wikiPages.title })
			.from(wikiPages)
			.leftJoin(wikiRevisions, eq(wikiRevisions.id, wikiPages.revisionId))
			.where(eq(wikiPages.slug, pageSlug));
		if (!page) {
			await createPage(topic.id, title, body, SEED, { ...fields, slug: pageSlug });
			counts.created++;
			continue;
		}
		await db.update(wikiPages).set(fields).where(eq(wikiPages.id, page.id));
		if (page.body === normalize(body) && page.title === title) {
			counts.unchanged++;
			continue;
		}
		await saveRevision(page.id, title, body, SEED);
		counts.updated++;
	}
}

// a private flag may have flipped without a content change
await refreshImagePrivacy();

const known = new Set(
	(await db.select({ slug: wikiPages.slug }).from(wikiPages)).map((p) => p.slug)
);
for (const [from, to] of links)
	for (const slug of to.filter((s) => !known.has(s)))
		console.warn(`  ! ${from}: link to unknown page wiki:${slug}`);

console.log(
	`Wiki seeded from ${root}: ${counts.topics} topics, ${counts.created} pages created, ${counts.updated} updated, ${counts.unchanged} unchanged.`
);

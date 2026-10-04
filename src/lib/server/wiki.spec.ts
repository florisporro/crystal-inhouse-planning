import { beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/libsql/migrator';

// fresh migrated DB per run; $env is mocked because vitest can't stub it
vi.mock('$env/dynamic/private', async () => {
	const { mkdtempSync } = await import('node:fs');
	const { join } = await import('node:path');
	const { tmpdir } = await import('node:os');
	const dir = mkdtempSync(join(tmpdir(), 'wiki-test-'));
	return {
		env: {
			DATABASE_URL: `file:${join(dir, 'test.db')}`,
			WIKI_IMAGES_DIR: join(dir, 'img'),
			ADMIN_EMAILS: 'admin@example.com'
		}
	};
});

const { db } = await import('$lib/server/db');
const { user, wikiImages, wikiPages, wikiSuggestions } = await import('$lib/server/db/schema');
const wiki = await import('./wiki');

const SECRET = 'SECRET4417';
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const admin = { email: 'admin@example.com', name: 'Admin' };
let imgId: string;

beforeAll(async () => {
	await migrate(db, { migrationsFolder: 'drizzle' });
	imgId = (await wiki.storeImage(png, admin.email))!;
	const topic = await wiki.createTopic('Building');
	await wiki.createPage(
		topic.id,
		'Bike storage',
		`The side door is green.\n\n:::private\nSide door code ${SECRET}\n\n![keypad](/wiki/img/${imgId})\n:::\n\nE-bikes charge in the corner.\n\n## Rules\n\nNo bikes in the corridor.\n\n:::private\n### Keys\n\nRules for keys.\n:::\n`,
		admin
	);
	await wiki.createPage(topic.id, 'Hidden contacts', `Huismeester ${SECRET}`, admin, {
		private: true
	});
});

const readable = async (slug: string, loggedIn: boolean) => {
	const page = await wiki.getPage(slug, loggedIn);
	if (page.locked) throw new Error(`${slug} is locked`);
	return page;
};

const httpStatus = (p: Promise<unknown>) =>
	p.then(
		() => 200,
		(e: { status: number }) => e.status
	);

describe('anonymous visitors never receive private content', () => {
	it('page HTML and meta description', async () => {
		const page = await readable('bike-storage', false);
		expect(page.html).not.toContain(SECRET);
		expect(page.html).not.toContain(imgId);
		expect(page.description).not.toContain(SECRET);
		expect(JSON.stringify(page)).not.toContain(SECRET);
		expect(page.html).toContain('E-bikes');
	});

	it('private pages are a bare login prompt and stay out of the tree', async () => {
		const page = await wiki.getPage('hidden-contacts', false, '/login?next=x');
		expect(page).toEqual({
			locked: true,
			slug: 'hidden-contacts',
			topicSlug: 'building',
			topicTitle: 'Building'
		});
		expect(JSON.stringify(page)).not.toContain(SECRET);
		expect(await httpStatus(wiki.getPage('no-such-page', false))).toBe(404);
		expect(JSON.stringify(await wiki.getTree(false))).not.toContain('Hidden');
		expect((await wiki.resolver())('hidden-contacts')).toBe('/wiki/building/hidden-contacts');
	});

	it('private sections become one login placeholder', async () => {
		const page = await wiki.getPage('bike-storage', false, '/login?next=%2Fwiki%2Fb');
		if (page.locked) throw new Error('page should not be locked');
		expect(page.html.match(/wiki-locked/g)).toHaveLength(2); // two separate private blocks
		expect(page.html).toContain('href="/login?next=%2Fwiki%2Fb"');
		expect(page.html).not.toContain('Keys');
	});

	it('search: no hits on private text, no private snippets', async () => {
		expect(await wiki.search(SECRET, false)).toEqual([]);
		expect(await wiki.search('Hidden', false)).toEqual([]);
		const door = await wiki.search('side door', false);
		expect(door.map((h) => h.slug)).toEqual(['bike-storage']);
		expect(JSON.stringify(door)).not.toContain(SECRET);
		expect(JSON.stringify(await wiki.search('Rules', false))).not.toContain('Keys');
	});

	it('images only used in private sections stay private', async () => {
		const [img] = await db.select().from(wikiImages).where(eq(wikiImages.id, imgId));
		expect(img.private).toBe(true);
	});
});

describe('search sections', () => {
	it('groups section hits under their page with anchors', async () => {
		const [hit] = await wiki.search('corridor', false);
		expect(hit).toMatchObject({ slug: 'bike-storage', title: 'Bike storage' });
		expect(hit.sections).toEqual([
			{ anchor: 'rules', heading: 'Rules', snippet: 'No bikes in the <mark>corridor</mark>.' }
		]);
	});

	it('matches the page title combined with section text', async () => {
		expect((await wiki.search('storage corridor', false))[0].sections[0].anchor).toBe('rules');
	});

	it('rebuilds an emptied index', async () => {
		await db.run(sql`DELETE FROM wiki_search`);
		await wiki.ensureSearchIndex();
		expect(await wiki.search('corridor', false)).toHaveLength(1);
	});
});

describe('logged-in residents', () => {
	it('see private sections, pages and search hits', async () => {
		const html = async (slug: string) => (await readable(slug, true)).html;
		expect(await html('bike-storage')).toContain(SECRET);
		expect(await html('bike-storage')).not.toContain('wiki-locked');
		expect(await html('hidden-contacts')).toContain(SECRET);
		expect((await wiki.search(SECRET, true)).length).toBe(2);
	});
});

describe('suggestions', () => {
	const resident = { id: 'u1', email: 'resident@example.com', name: '', admin: false };

	beforeAll(async () => {
		await db
			.insert(user)
			.values({ id: 'u1', name: '', email: resident.email, emailVerified: true });
	});

	it('a resident edit becomes a suggestion; accepted parts credit the resident', async () => {
		const page = await wiki.getPageRow('bike-storage', true);
		const form = new FormData();
		form.set('title', 'Bike storage');
		form.set('name', 'Sam');
		form.set(
			'body',
			page.body
				.replace('is green', 'is blue')
				.replace('E-bikes charge in the corner.', 'No e-bikes.')
		);
		expect(await wiki.submitEdit(resident, form, { page })).toHaveProperty('url');
		expect((await wiki.getPageRow('bike-storage', true)).body).toBe(page.body);

		const [s] = await db.select().from(wikiSuggestions).where(eq(wikiSuggestions.pageId, page.id));
		const parts = await wiki.diffView(page.body, s.body);
		const changes = parts.filter((p) => p.kind === 'change');
		expect(changes).toHaveLength(2);

		const review = new FormData();
		review.set('decision', 'accept');
		review.append('accept', String(changes[0].kind === 'change' && changes[0].id));
		await wiki.reviewSuggestion(s.id, review);

		const after = await readable('bike-storage', true);
		expect(after.html).toContain('is blue');
		expect(after.html).toContain('E-bikes');
		expect(after.editedBy).toBe('Sam');
		const [row] = await db.select().from(wikiSuggestions).where(eq(wikiSuggestions.id, s.id));
		expect(row.status).toBe('partial');
		expect(await wiki.search('blue', false)).toHaveLength(1);
	});

	it('a suggested new page is created on accept', async () => {
		const [topic] = await wiki.getTree(true);
		const form = new FormData();
		form.set('title', 'Parcel lockers');
		form.set('name', 'Sam');
		form.set('body', 'Lockers are in the lobby.');
		await wiki.submitEdit(resident, form, { topicId: topic.id });
		const [s] = await db
			.select()
			.from(wikiSuggestions)
			.where(eq(wikiSuggestions.title, 'Parcel lockers'));
		expect(s.pageId).toBeNull();

		const review = new FormData();
		review.set('decision', 'accept');
		await wiki.reviewSuggestion(s.id, review);
		const page = await readable('parcel-lockers', false);
		expect(page.editedBy).toBe('Sam');
		const [created] = await db.select().from(wikiPages).where(eq(wikiPages.slug, 'parcel-lockers'));
		expect(created.topicId).toBe(topic.id);
	});
});

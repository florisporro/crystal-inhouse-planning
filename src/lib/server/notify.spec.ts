import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { migrate } from 'drizzle-orm/libsql/migrator';

vi.mock('$env/dynamic/private', async () => {
	const { mkdtempSync } = await import('node:fs');
	const { join } = await import('node:path');
	const { tmpdir } = await import('node:os');
	const dir = mkdtempSync(join(tmpdir(), 'notify-test-'));
	return {
		env: {
			DATABASE_URL: `file:${join(dir, 'test.db')}`,
			WIKI_IMAGES_DIR: join(dir, 'img'),
			ADMIN_EMAILS: 'admin1@example.com,admin2@example.com',
			ORIGIN: 'https://crystal.example',
			EMAIL_OUTBOX: join(dir, 'outbox.jsonl')
		}
	};
});

const { env } = await import('$env/dynamic/private');
const { db } = await import('$lib/server/db');
const { wikiSuggestions } = await import('$lib/server/db/schema');
const wiki = await import('./wiki');
const { sendAdminDigest, sendOutcomes } = await import('./notify');

type Mail = { to: string; subject: string; text: string; html: string };
const outbox = env.EMAIL_OUTBOX!;
const mails = (): Mail[] =>
	existsSync(outbox)
		? readFileSync(outbox, 'utf8')
				.trim()
				.split('\n')
				.filter(Boolean)
				.map((l) => JSON.parse(l))
		: [];

// October: Amsterdam is UTC+2
const at = (iso: string) => new Date(iso);
const author = { email: 'seed', name: 'Seed' };
let pageId: number;
let topicId: number;

async function suggest(
	by: string,
	name: string,
	extra: Partial<typeof wikiSuggestions.$inferInsert> = {}
) {
	const [s] = await db
		.insert(wikiSuggestions)
		.values({
			pageId,
			title: 'Lifts',
			body: 'x',
			authorEmail: by,
			authorName: name,
			createdAt: at('2026-10-04T12:00:00Z'),
			...extra
		})
		.returning();
	return s;
}

beforeAll(async () => {
	await migrate(db, { migrationsFolder: 'drizzle' });
	const topic = await wiki.createTopic('Building');
	topicId = topic.id;
	pageId = (await wiki.createPage(topic.id, 'Lifts', 'Text.', author)).id;
});

beforeEach(async () => {
	rmSync(outbox, { force: true });
	await db.delete(wikiSuggestions);
});

describe('admin digest', () => {
	it('waits for 08:00, sends once a day, only with something new', async () => {
		await suggest('sam@example.com', 'Sam');
		await suggest('kim@example.com', 'Kim', { pageId: null, topicId, title: 'Parcel lockers' });

		expect(await sendAdminDigest(at('2026-10-05T05:30:00Z'))).toBe(0); // 07:30
		expect(mails()).toHaveLength(0);

		expect(await sendAdminDigest(at('2026-10-05T06:05:00Z'))).toBe(2); // 08:05
		const sent = mails();
		expect(sent.map((m) => m.to)).toEqual(['admin1@example.com', 'admin2@example.com']);
		expect(sent[0].subject).toBe('Wiki: 2 new suggestions to review');
		expect(sent[0].text).toContain('Changes to: Lifts');
		expect(sent[0].text).toContain('New page: Parcel lockers');
		expect(sent[0].html).toContain('https://crystal.example/admin/wiki');

		await suggest('sam@example.com', 'Sam');
		expect(await sendAdminDigest(at('2026-10-05T15:00:00Z'))).toBe(0); // same day
		expect(await sendAdminDigest(at('2026-10-06T06:05:00Z'))).toBe(1); // next day, only the new one
		expect(mails().at(-1)!.text).toContain('3 suggestions are waiting in total');
		expect(await sendAdminDigest(at('2026-10-07T06:05:00Z'))).toBe(0); // nothing new
	});
});

describe('resident outcomes', () => {
	it('batches a review session into one email per resident', async () => {
		const reviewed = (min: number) => at(`2026-10-05T10:${String(min).padStart(2, '0')}:00Z`);
		await suggest('sam@example.com', 'Sam', { status: 'accepted', reviewedAt: reviewed(0) });
		await suggest('sam@example.com', 'Sam', {
			status: 'declined',
			reviewedAt: reviewed(2),
			reviewNote: 'We keep lift rules on the <script>alert(1)</script> page.'
		});
		await suggest('sam@example.com', 'Sam', { status: 'partial', reviewedAt: reviewed(4) });
		await suggest('kim@example.com', 'Kim', { status: 'accepted', reviewedAt: reviewed(1) });

		expect(await sendOutcomes(reviewed(9))).toBe(0); // Sam's last review was 5 min ago
		expect(await sendOutcomes(reviewed(20))).toBe(2);
		const sent = mails();
		expect(sent.map((m) => m.to).sort()).toEqual(['kim@example.com', 'sam@example.com']);
		const sam = sent.find((m) => m.to === 'sam@example.com')!;
		expect(sam.subject).toBe('Wiki: your suggestions were reviewed');
		expect(sam.text).toContain('Accepted. Your changes are live.');
		expect(sam.text).toContain('Not accepted.');
		expect(sam.text).toContain('Partly accepted.');
		expect(sam.text).toContain('Hi Sam');
		expect(sam.html).toContain('&lt;script&gt;');
		expect(sam.html).not.toContain('<script>');
		expect(sam.html).toContain('https://crystal.example/wiki/building/lifts');

		expect(await sendOutcomes(reviewed(40))).toBe(0); // each review is sent once
	});

	it('leaves rows unsent when sending fails, and retries later', async () => {
		await suggest('sam@example.com', 'Sam', {
			status: 'accepted',
			reviewedAt: at('2026-10-05T10:00:00Z')
		});
		const good = env.EMAIL_OUTBOX;
		env.EMAIL_OUTBOX = '/nonexistent-dir/outbox.jsonl';
		expect(await sendOutcomes(at('2026-10-05T11:00:00Z'))).toBe(0);
		env.EMAIL_OUTBOX = good;
		expect(await sendOutcomes(at('2026-10-05T11:05:00Z'))).toBe(1);
	});
});

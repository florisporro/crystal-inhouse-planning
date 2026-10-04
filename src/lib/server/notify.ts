import { and, count, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	settings,
	wikiPages,
	wikiRevisions,
	wikiSuggestions,
	wikiTopics
} from '$lib/server/db/schema';
import { adminEmails } from '$lib/server/access';
import { sendEmail } from '$lib/server/email';
import { absolute, emailLayout } from '$lib/server/emailTemplate';
import { log } from '$lib/server/log';

const TZ = 'Europe/Amsterdam';
const DIGEST_HOUR = 8;
// an admin reviewing a batch in one sitting produces one email per resident
const QUIET_MS = 15 * 60 * 1000;
const DIGEST_KEY = 'wiki.digest_date';

function amsterdam(now: Date) {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: TZ,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(now);
	const get = (type: string) => parts.find((p) => p.type === type)!.value;
	return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

const when = (d: Date) =>
	d.toLocaleString('en-GB', {
		timeZone: TZ,
		day: 'numeric',
		month: 'long',
		hour: '2-digit',
		minute: '2-digit'
	});

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const digestSubject = (n: number) =>
	`Wiki: ${plural(n, 'new suggestion', 'new suggestions')} to review`;

// once a day after 08:00, only when residents suggested something since the last digest
export async function sendAdminDigest(now = new Date()) {
	const { date, hour } = amsterdam(now);
	if (hour < DIGEST_HOUR) return 0;
	const [last] = await db.select().from(settings).where(eq(settings.key, DIGEST_KEY));
	if (last?.value === date) return 0;

	const fresh = await db
		.select()
		.from(wikiSuggestions)
		.where(and(eq(wikiSuggestions.status, 'open'), isNull(wikiSuggestions.adminNotifiedAt)));
	const admins = adminEmails();
	if (!fresh.length || !admins.length) return 0;
	const [{ open }] = await db
		.select({ open: count() })
		.from(wikiSuggestions)
		.where(eq(wikiSuggestions.status, 'open'));

	const email = emailLayout({
		preheader: `${plural(fresh.length, 'new suggestion', 'new suggestions')} for the wiki.`,
		heading: `${plural(fresh.length, 'new suggestion', 'new suggestions')} to review`,
		body: [
			{ p: 'Residents suggested these changes to the wiki since the last digest.' },
			{
				items: fresh.map((s) => ({
					title: s.pageId ? `Changes to: ${s.title}` : `New page: ${s.title}`,
					href: absolute(`/admin/wiki/suggestions/${s.id}`),
					lines: [`By ${s.authorName} · ${when(s.createdAt)}`]
				}))
			},
			...(open > fresh.length
				? [{ muted: `${plural(open, 'suggestion is', 'suggestions are')} waiting in total.` }]
				: [])
		],
		button: { label: 'Review suggestions', href: absolute('/admin/wiki') },
		footer: 'You get this daily digest because you are a wiki admin for Crystal Tower.'
	});
	try {
		for (const to of admins)
			await sendEmail({ to, subject: digestSubject(fresh.length), ...email });
	} catch (e) {
		// nothing is marked, so the next run tries again
		log('wiki.digest_failed', { error: String(e) });
		return 0;
	}
	await db
		.update(wikiSuggestions)
		.set({ adminNotifiedAt: now })
		.where(
			inArray(
				wikiSuggestions.id,
				fresh.map((s) => s.id)
			)
		);
	await db
		.insert(settings)
		.values({ key: DIGEST_KEY, value: date })
		.onConflictDoUpdate({ target: settings.key, set: { value: date } });
	log('wiki.digest_sent', { suggestions: fresh.length, admins: admins.length });
	return fresh.length;
}

const OUTCOME = {
	accepted: 'Accepted. Your changes are live.',
	partial: 'Partly accepted. Some of your changes are live.',
	declined: 'Not accepted.'
} as const;

// one email per resident, once their reviews have been quiet for QUIET_MS
export async function sendOutcomes(now = new Date()) {
	const rows = await db
		.select()
		.from(wikiSuggestions)
		.where(
			and(
				ne(wikiSuggestions.status, 'open'),
				isNotNull(wikiSuggestions.reviewedAt),
				isNull(wikiSuggestions.authorNotifiedAt)
			)
		);
	if (!rows.length) return 0;

	// where each suggestion now lives: its page, or the page an accepted new-page suggestion created
	const created = await db
		.select({ suggestionId: wikiRevisions.suggestionId, pageId: wikiRevisions.pageId })
		.from(wikiRevisions)
		.where(
			inArray(
				wikiRevisions.suggestionId,
				rows.map((r) => r.id)
			)
		);
	const pages = await db
		.select({ id: wikiPages.id, slug: wikiPages.slug, topic: wikiTopics.slug })
		.from(wikiPages)
		.innerJoin(wikiTopics, eq(wikiTopics.id, wikiPages.topicId));
	const topics = await db.select({ id: wikiTopics.id, slug: wikiTopics.slug }).from(wikiTopics);
	const link = (s: (typeof rows)[number]) => {
		const pageId = s.pageId ?? created.find((c) => c.suggestionId === s.id)?.pageId;
		const page = pages.find((p) => p.id === pageId);
		if (page) return absolute(`/wiki/${page.topic}/${page.slug}`);
		const topic = topics.find((t) => t.id === s.topicId);
		return topic ? absolute(`/wiki/${topic.slug}`) : absolute('/wiki');
	};

	const byAuthor = Map.groupBy(rows, (r) => r.authorEmail);
	let sent = 0;
	for (const [to, list] of byAuthor) {
		const latest = Math.max(...list.map((s) => s.reviewedAt!.getTime()));
		if (now.getTime() - latest < QUIET_MS) continue;
		const name = list.at(-1)!.authorName;
		const email = emailLayout({
			preheader:
				list.length === 1
					? OUTCOME[list[0].status as keyof typeof OUTCOME]
					: `${list.length} suggestions reviewed.`,
			heading:
				list.length === 1 ? 'Your suggestion was reviewed' : 'Your suggestions were reviewed',
			body: [
				{
					p: `Hi ${name}, thanks for helping to keep the wiki up to date. The board looked at what you sent in.`
				},
				{
					items: list.map((s) => ({
						title: s.pageId ? s.title : `New page: ${s.title}`,
						href: link(s),
						lines: [
							s.status === 'accepted' && !s.pageId
								? 'Accepted. The page is live.'
								: OUTCOME[s.status as keyof typeof OUTCOME]
						],
						quote: s.reviewNote ?? undefined
					}))
				}
			],
			button: { label: 'Open the wiki', href: absolute('/wiki') },
			footer:
				'You get this email because you suggested changes to the Crystal Tower wiki. Each review is sent once.'
		});
		try {
			await sendEmail({
				to,
				subject:
					list.length === 1
						? `Wiki: your suggestion was reviewed`
						: `Wiki: your suggestions were reviewed`,
				...email
			});
		} catch (e) {
			log('wiki.outcome_failed', { error: String(e) });
			continue;
		}
		await db
			.update(wikiSuggestions)
			.set({ authorNotifiedAt: now })
			.where(
				inArray(
					wikiSuggestions.id,
					list.map((s) => s.id)
				)
			);
		sent++;
	}
	if (sent) log('wiki.outcomes_sent', { residents: sent });
	return sent;
}

export async function runNotifications(now = new Date()) {
	await sendAdminDigest(now);
	await sendOutcomes(now);
}

// ponytail: in-process interval; fine for the single container, move to a real
// scheduler (or add a lock) if the app ever runs more than one instance
let running = false;
export function startNotifier() {
	const tick = async () => {
		if (running) return;
		running = true;
		try {
			await runNotifications();
		} catch (e) {
			log('wiki.notify_failed', { error: String(e) });
		} finally {
			running = false;
		}
	};
	tick();
	setInterval(tick, 5 * 60 * 1000);
}

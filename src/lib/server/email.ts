import { appendFileSync } from 'node:fs';
import { env } from '$env/dynamic/private';

export async function sendEmail(opts: { to: string; subject: string; text: string }) {
	if (!env.POSTMARK_TOKEN) {
		// no token configured (dev): log instead of sending
		console.log(`\n=== EMAIL to ${opts.to} ===\n${opts.subject}\n\n${opts.text}\n===\n`);
		// e2e tests read the magic link from this file
		if (env.EMAIL_OUTBOX) appendFileSync(env.EMAIL_OUTBOX, JSON.stringify(opts) + '\n');
		return;
	}
	const res = await fetch('https://api.postmarkapp.com/email', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			'X-Postmark-Server-Token': env.POSTMARK_TOKEN
		},
		body: JSON.stringify({
			From: env.POSTMARK_FROM,
			To: opts.to,
			Subject: opts.subject,
			TextBody: opts.text,
			MessageStream: 'outbound'
		})
	});
	if (!res.ok) throw new Error(`Postmark ${res.status}: ${await res.text()}`);
}

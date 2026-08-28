import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { magicLink } from 'better-auth/plugins';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { sendEmail } from '$lib/server/email';
import { isKnownEmail, apartmentNumbersForEmail } from '$lib/server/access';
import { log } from '$lib/server/log';

// ORIGIN is the sole trusted origin: it drives CSRF checking and the Secure
// cookie flag. Refuse to boot without it rather than degrade silently.
if (!env.ORIGIN) throw new Error('ORIGIN is not set');

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	// explicit so a stray NODE_ENV in the server .env can't silently disable it
	rateLimit: { enabled: true, window: 60, max: 5 },
	// per-client limiting behind the Cloudflare tunnel; without this every
	// visitor shares one bucket and residents could block each other
	advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
	plugins: [
		magicLink({
			sendMagicLink: async ({ email, url }) => {
				// trust boundary: the public auth API can request links for any address;
				// only send to emails that belong to an apartment or an admin
				if (!(await isKnownEmail(email))) return;
					log('auth.magic_link', { apartments: await apartmentNumbersForEmail(email) });
				await sendEmail({
					to: email,
					subject: 'Your Crystal Tower login link',
					text: `Click to log in (valid 5 minutes):\n\n${url}\n\nIf you did not request this, ignore this email.`
				});
			}
		}),
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});

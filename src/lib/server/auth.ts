import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { magicLink } from 'better-auth/plugins';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { sendEmail } from '$lib/server/email';
import { isKnownEmail } from '$lib/server/access';

// ORIGIN is the sole trusted origin: it drives CSRF checking and the Secure
// cookie flag. Refuse to boot without it rather than degrade silently.
if (!env.ORIGIN) throw new Error('ORIGIN is not set');

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	plugins: [
		magicLink({
			sendMagicLink: async ({ email, url }) => {
				// trust boundary: the public auth API can request links for any address;
				// only send to emails that belong to an apartment or an admin
				if (!(await isKnownEmail(email))) return;
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

import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { startSip } from '$lib/server/gate';
import { ensureSearchIndex } from '$lib/server/wiki';
import { startNotifier } from '$lib/server/notify';
import { log } from '$lib/server/log';

// bind the SIP socket at boot rather than on the first gate open, so a taken port
// fails here and not at 7am on moving day. No-ops when SIP isn't configured.
if (!building) {
	startSip();
	ensureSearchIndex().catch((e) => log('wiki.reindex_failed', { error: String(e) }));
	startNotifier();
}

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	const response = await svelteKitHandler({ event, resolve, auth, building });
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	return response;
};

export const handle: Handle = handleBetterAuth;

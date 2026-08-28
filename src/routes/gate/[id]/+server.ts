import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { gateOpens } from '$lib/server/db/schema';
import { canEdit } from '$lib/server/access';

// Poll target for a gate opening in progress. A read, not a submission, so it is
// the one endpoint in this app that isn't a form action. `:id` is our own
// gate_opens row id — the SIP Call-ID never reaches a browser.
//
// The row is advanced by the SIP callbacks in $lib/server/gate, so this is a plain
// read: no call out to Bird, nothing to poll upstream.
export const GET = async ({ params, locals }) => {
	const user = locals.user;
	if (!user) error(401, 'Not signed in');

	const [row] = await db
		.select()
		.from(gateOpens)
		.where(eq(gateOpens.id, Number(params.id)));
	if (!row) error(404, 'No such gate opening');
	if (!(await canEdit(user.email, row.apartmentNumber))) error(403, 'Not your apartment');

	return json({ phase: row.phase });
};

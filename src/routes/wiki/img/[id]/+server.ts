import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { wikiImages } from '$lib/server/db/schema';
import { imageDir } from '$lib/server/wiki';

export const GET = async ({ locals, params }) => {
	if (!/^[0-9a-f]{32}$/.test(params.id)) error(404, 'Not found');
	const [img] = await db.select().from(wikiImages).where(eq(wikiImages.id, params.id));
	if (!img || (img.private && !locals.user)) error(404, 'Not found');
	const bytes = await readFile(join(imageDir(), img.id)).catch(() => error(404, 'Not found'));
	return new Response(new Uint8Array(bytes), {
		headers: {
			'Content-Type': img.mime,
			// privacy can flip on the next save, so no long-lived shared caching
			'Cache-Control': img.private ? 'private, max-age=300' : 'public, max-age=3600'
		}
	});
};

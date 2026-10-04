import { error, json } from '@sveltejs/kit';
import { MAX_IMAGE_BYTES, storeImage } from '$lib/server/wiki';

export const POST = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Log in to upload images');
	const file = (await request.formData()).get('file');
	if (!(file instanceof File)) error(400, 'No file');
	if (file.size > MAX_IMAGE_BYTES) error(413, 'Images can be 5 MB at most');
	const id = await storeImage(new Uint8Array(await file.arrayBuffer()), locals.user.email);
	if (!id) error(415, 'Use a PNG, JPEG, GIF or WebP image');
	return json({ src: `/wiki/img/${id}` });
};

import { getTopic } from '$lib/server/wiki';

export const load = async ({ locals, params }) => ({
	topic: await getTopic(params.topic, !!locals.user)
});

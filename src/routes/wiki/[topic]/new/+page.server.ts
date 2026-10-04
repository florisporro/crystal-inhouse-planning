import { redirect } from '@sveltejs/kit';
import { getTopic, linkTargets, submitEdit, wikiUser } from '$lib/server/wiki';
import { requireUser } from '$lib/server/access';

export const load = async ({ locals, params, url }) => {
	const user = requireUser(locals, url);
	const topic = await getTopic(params.topic, true);
	return {
		topic: { title: topic.title, slug: topic.slug },
		pages: await linkTargets(),
		user: wikiUser(user)
	};
};

export const actions = {
	default: async ({ locals, params, request, url }) => {
		const user = requireUser(locals, url);
		const topic = await getTopic(params.topic, true);
		const result = await submitEdit(wikiUser(user), await request.formData(), {
			topicId: topic.id
		});
		if ('url' in result) redirect(303, result.url);
		return result;
	}
};

import { error, fail, redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/access';
import {
	createTopic,
	deletePage,
	deleteTopic,
	getTree,
	move,
	openSuggestions,
	updatePage,
	updateTopic
} from '$lib/server/wiki';
import { db } from '$lib/server/db';
import { wikiTopics } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';

const requireAdmin = (locals: App.Locals) => {
	if (!locals.user) redirect(302, '/login');
	if (!isAdmin(locals.user.email)) error(403, 'Admins only');
};

const id = (form: FormData, key = 'id') => {
	const n = Number(form.get(key));
	if (!Number.isInteger(n) || n < 1) error(400, 'Bad request');
	return n;
};

export const load = async ({ locals }) => {
	requireAdmin(locals);
	const intros = await db
		.select({ id: wikiTopics.id, intro: wikiTopics.intro })
		.from(wikiTopics)
		.orderBy(asc(wikiTopics.id));
	return {
		tree: (await getTree(true)).map((t) => ({
			...t,
			intro: intros.find((i) => i.id === t.id)?.intro ?? ''
		})),
		suggestions: await openSuggestions()
	};
};

export const actions = {
	addTopic: async ({ locals, request }) => {
		requireAdmin(locals);
		const title = String((await request.formData()).get('title') ?? '').trim();
		if (!title || title.length > 80)
			return fail(400, { error: 'Give the topic a title of at most 80 characters.' });
		await createTopic(title);
	},
	updateTopic: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		if (!title || title.length > 80)
			return fail(400, { error: 'Give the topic a title of at most 80 characters.' });
		await updateTopic(id(form), title, String(form.get('intro') ?? ''));
	},
	deleteTopic: async ({ locals, request }) => {
		requireAdmin(locals);
		return deleteTopic(id(await request.formData()));
	},
	move: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const kind = form.get('kind') === 'topic' ? 'topic' : 'page';
		await move(kind, id(form), form.get('dir') === 'up' ? -1 : 1);
	},
	updatePage: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		await updatePage(id(form), {
			topicId: form.has('topicId') ? id(form, 'topicId') : undefined,
			private: form.has('private') ? form.get('private') === 'true' : undefined
		});
	},
	deletePage: async ({ locals, request }) => {
		requireAdmin(locals);
		await deletePage(id(await request.formData()));
	}
};

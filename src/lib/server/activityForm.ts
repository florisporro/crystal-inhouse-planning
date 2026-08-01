const TYPES = ['moving', 'delivery', 'other'];
const BLOCKS = ['morning', 'afternoon', 'full_day'];
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function activityFields(form: FormData) {
	const type = form.get('type')?.toString() ?? '';
	const date = form.get('date')?.toString() ?? '';
	const block = form.get('block')?.toString() ?? '';
	const note = form.get('note')?.toString().trim().slice(0, 200) || null;
	if (!TYPES.includes(type) || !BLOCKS.includes(block) || !ISO_DATE.test(date)) return null;
	return { type, date, block, note } as {
		type: 'moving' | 'delivery' | 'other';
		date: string;
		block: 'morning' | 'afternoon' | 'full_day';
		note: string | null;
	};
}

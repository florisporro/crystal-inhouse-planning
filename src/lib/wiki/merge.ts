import { diffArrays } from 'diff';
import { fromBlocks, toBlocks } from './markdown';

export type Part =
	| { kind: 'same'; blocks: string[] }
	// `at`: index in the base blocks where the change starts
	| { kind: 'change'; id: number; at: number; removed: string[]; added: string[] };

// block-level diff; each run of changed blocks is one accept/decline decision
export function hunks(base: string, proposed: string): Part[] {
	const parts: Part[] = [];
	let id = 0;
	let at = 0;
	for (const c of diffArrays(toBlocks(base), toBlocks(proposed))) {
		if (!c.added && !c.removed) {
			parts.push({ kind: 'same', blocks: c.value });
			at += c.value.length;
			continue;
		}
		let change = parts.at(-1);
		if (change?.kind !== 'change') {
			change = { kind: 'change', id: id++, at, removed: [], added: [] };
			parts.push(change);
		}
		(c.added ? change.added : change.removed).push(...c.value);
		if (c.removed) at += c.value.length;
	}
	return parts;
}

// for each base block, its index in current, or -1 if it was changed since
function track(base: string[], current: string[]) {
	const map: number[] = new Array(base.length).fill(-1);
	let b = 0;
	let c = 0;
	for (const d of diffArrays(base, current)) {
		if (d.added) c += d.value.length;
		else if (d.removed) b += d.value.length;
		else for (let i = 0; i < d.value.length; i++) map[b++] = c++;
	}
	return map;
}

// Applies accepted changes (made against `base`) onto `current`. When the page
// changed in between, a change whose blocks were also edited since is a conflict
// and is never applied, so later edits are not silently undone.
export function merge(base: string, current: string, parts: Part[], accepted: Set<number>) {
	const baseBlocks = toBlocks(base);
	const out = toBlocks(current);
	const map = track(baseBlocks, out);
	const conflicts = new Set<number>();
	const edits: { from: number; to: number; blocks: string[] }[] = [];

	for (const p of parts) {
		if (p.kind !== 'change') continue;
		const span = locate(p.at, p.removed.length);
		if (!span) conflicts.add(p.id);
		else if (accepted.has(p.id)) edits.push({ ...span, blocks: p.added });
	}
	for (const e of edits.sort((a, b) => b.from - a.from))
		out.splice(e.from, e.to - e.from, ...e.blocks);
	return { md: fromBlocks(out), conflicts };

	function locate(at: number, len: number) {
		if (len) {
			const from = map[at];
			for (let i = 0; i < len; i++) if (from < 0 || map[at + i] !== from + i) return null;
			return { from, to: from + len };
		}
		// pure insertion: anchor on the next unchanged block, else the previous one
		if (at < baseBlocks.length && map[at] >= 0) return { from: map[at], to: map[at] };
		if (at > 0 && map[at - 1] >= 0) return { from: map[at - 1] + 1, to: map[at - 1] + 1 };
		if (!baseBlocks.length) return { from: out.length, to: out.length };
		return null;
	}
}

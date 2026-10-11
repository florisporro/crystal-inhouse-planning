// The apartment ↔ login-email list in its two shapes: apartment-emails.csv (what the
// boot seed reads and /admin writes) and the VvE owner export it is made from.
// No db or $env imports: scripts/seed-emails.ts uses this too.

export type Pair = { apartmentNumber: number; email: string };

const key = (p: Pair) => `${p.apartmentNumber}|${p.email}`;

// apartment number, then one or more email addresses; quotes optional
export function parseEmailCsv(text: string): Pair[] {
	const seen = new Set<string>();
	const rows: Pair[] = [];
	for (const line of text.trim().split('\n').slice(1)) {
		const m = line.trim().match(/^(\d+)[;,](.*)$/);
		if (!m) throw new Error(`Cannot parse line: ${line}`);
		for (const raw of m[2].split(/[,;]/)) {
			const email = raw.replaceAll('"', '').trim().toLowerCase();
			if (!email) continue; // apartments without a known email are allowed
			if (!email.includes('@')) throw new Error(`Not an email for apartment ${m[1]}: ${email}`);
			const pair = { apartmentNumber: Number(m[1]), email };
			if (seen.has(key(pair))) continue; // duplicate pair in the file
			seen.add(key(pair));
			rows.push(pair);
		}
	}
	return rows;
}

// ';'-separated, apartment in "Omschrijving" ("Hiraistraat 5B-143 (…)"), emails in "E-mail"
export function parseOwnerExport(text: string): Pair[] {
	const [header, ...lines] = text.trim().split(/\r?\n/);
	const cols = header.split(';').map((c) => c.replaceAll('"', '').trim());
	const desc = cols.indexOf('Omschrijving');
	const mail = cols.indexOf('E-mail');
	if (desc < 0 || mail < 0) {
		throw new Error('Not an owner export: expected "Omschrijving" and "E-mail" columns');
	}
	const pairs = new Map<string, Pair>();
	for (const line of lines) {
		if (!line.trim()) continue;
		// shortcut: plain ';' split, the export never quotes fields; switch to a CSV parser if it starts to
		const fields = line.split(';');
		if (fields.length !== cols.length) throw new Error(`Unexpected column count: ${line}`);
		const n = Number(fields[desc].match(/5\s*B[\s-]*(\d+)/)?.[1]);
		if (!(n >= 1 && n <= 179)) throw new Error(`No apartment number in: ${fields[desc]}`);
		for (const raw of fields[mail].split(/[,\s]+/)) {
			const email = raw.replaceAll('"', '').trim().toLowerCase();
			if (email.includes('@'))
				pairs.set(key({ apartmentNumber: n, email }), { apartmentNumber: n, email });
		}
	}
	return [...pairs.values()];
}

// sorted by apartment, then email
export function byApartment(pairs: Pair[]): Map<number, string[]> {
	const map = new Map<number, string[]>();
	const sorted = [...pairs].sort(
		(a, b) => a.apartmentNumber - b.apartmentNumber || a.email.localeCompare(b.email)
	);
	for (const p of sorted) {
		if (!map.has(p.apartmentNumber)) map.set(p.apartmentNumber, []);
		map.get(p.apartmentNumber)!.push(p.email);
	}
	return map;
}

export function formatEmailCsv(pairs: Pair[]): string {
	const lines = ['apartment,emails'];
	for (const [number, emails] of byApartment(pairs)) lines.push(`${number},"${emails.join(',')}"`);
	return lines.join('\n') + '\n';
}

// Start from the new export (theirs), then re-apply what was added or removed by hand
// (ours) since the previous export (base). Conflicts: apartments changed both by hand
// and in the export, in different ways. They keep the union and need a human look.
export function mergeEmailLists(base: Pair[], ours: Pair[], theirs: Pair[]) {
	const inBase = new Set(base.map(key));
	const inOurs = new Set(ours.map(key));
	const merged = new Map(theirs.map((p) => [key(p), p]));
	for (const p of ours) if (!inBase.has(key(p))) merged.set(key(p), p);
	for (const p of base) if (!inOurs.has(key(p))) merged.delete(key(p));

	const [b, o, t] = [base, ours, theirs].map(byApartment);
	const list = (m: Map<number, string[]>, n: number) => (m.get(n) ?? []).join(',');
	const conflicts = [...new Set([...b.keys(), ...o.keys(), ...t.keys()])]
		.filter((n) => {
			const [bs, os, ts] = [list(b, n), list(o, n), list(t, n)];
			return os !== bs && ts !== bs && os !== ts;
		})
		.sort((x, y) => x - y);

	return { merged: [...merged.values()], conflicts };
}

// per apartment, what going from one list to the other adds and removes
export function changesBetween(before: Pair[], after: Pair[]) {
	const [b, a] = [before, after].map(byApartment);
	return [...new Set([...b.keys(), ...a.keys()])]
		.sort((x, y) => x - y)
		.map((apartment) => {
			const was = b.get(apartment) ?? [];
			const now = a.get(apartment) ?? [];
			return {
				apartment,
				added: now.filter((e) => !was.includes(e)),
				removed: was.filter((e) => !now.includes(e))
			};
		})
		.filter((c) => c.added.length > 0 || c.removed.length > 0);
}

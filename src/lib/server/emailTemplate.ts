import { env } from '$env/dynamic/private';

export const esc = (s: string) =>
	s.replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
	);

export const absolute = (path: string) => new URL(path, env.ORIGIN).toString();

// body blocks; text is escaped here, so callers pass raw values
export type Block =
	| { p: string }
	| { muted: string }
	| { items: { title: string; href?: string; lines: string[]; quote?: string }[] };

const BLUE = '#2a78d6';
const INK = '#0b0b0b';
const INK2 = '#52514e';
const MUTED = '#898781';
const LINE = '#e1e0d9';
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

function blockHtml(b: Block) {
	if ('p' in b)
		return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK2}">${esc(b.p)}</p>`;
	if ('muted' in b)
		return `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${MUTED}">${esc(b.muted)}</p>`;
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-top:1px solid ${LINE}">${b.items
		.map(
			(i) => `<tr><td style="padding:14px 0;border-bottom:1px solid ${LINE}">
<p style="margin:0;font-size:16px;font-weight:600;color:${INK}">${i.href ? `<a href="${esc(i.href)}" style="color:${INK};text-decoration:none">${esc(i.title)}</a>` : esc(i.title)}</p>
${i.lines.map((l) => `<p style="margin:4px 0 0;font-size:14px;line-height:1.5;color:${INK2}">${esc(l)}</p>`).join('')}
${i.quote ? `<p style="margin:10px 0 0;padding:8px 12px;border-left:3px solid ${LINE};font-size:14px;line-height:1.5;color:${INK2};white-space:pre-line">${esc(i.quote)}</p>` : ''}
</td></tr>`
		)
		.join('')}</table>`;
}

function blockText(b: Block) {
	if ('p' in b) return b.p;
	if ('muted' in b) return b.muted;
	return b.items
		.map((i) =>
			[
				`- ${i.title}`,
				...i.lines.map((l) => `  ${l}`),
				...(i.quote ? i.quote.split('\n').map((l) => `  > ${l}`) : []),
				...(i.href ? [`  ${i.href}`] : [])
			].join('\n')
		)
		.join('\n\n');
}

export function emailLayout(opts: {
	preheader: string;
	heading: string;
	body: Block[];
	button?: { label: string; href: string };
	footer: string;
}) {
	const { preheader, heading, body, button, footer } = opts;
	const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f1;font-family:${FONT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f1"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 20px;font-size:15px;font-weight:700;letter-spacing:-0.01em;color:${INK}"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${BLUE};margin-right:8px"></span>Crystal Tower</td></tr>
<tr><td style="background:#ffffff;border:1px solid ${LINE};border-radius:12px;padding:32px 32px 16px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.01em;color:${INK}">${esc(heading)}</h1>
${body.map(blockHtml).join('\n')}
${button ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:8px;background:${BLUE}"><a href="${esc(button.href)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${esc(button.label)}</a></td></tr></table>` : ''}
</td></tr>
<tr><td style="padding:20px 4px 0;font-size:12px;line-height:1.6;color:${MUTED}">${esc(footer)}</td></tr>
</table></td></tr></table>
</body></html>`;
	const text = [
		heading,
		'',
		...body.flatMap((b) => [blockText(b), '']),
		...(button ? [`${button.label}: ${button.href}`, ''] : []),
		'--',
		footer
	].join('\n');
	// text first: tools that grep the outbox for links should hit the unescaped URL
	return { text, html };
}

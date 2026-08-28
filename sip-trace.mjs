// Full SIP trace: identical From, different destinations. Shows every response so we
// can see whether the 400 lands before or after the 407 challenge.
//   node sip-trace.mjs +316XXXXXXXX
import sip from 'sip';
import digest from 'sip/digest.js';
import fs from 'node:fs';
import os from 'node:os';
const LIP =
	Object.values(os.networkInterfaces())
		.flat()
		.find((i) => i && i.family === 'IPv4' && !i.internal)?.address ?? '127.0.0.1';
const val = (k) => {
	const l = fs
		.readFileSync('.env', 'utf8')
		.split('\n')
		.find((x) => x.startsWith(k + '='));
	return l
		? l
				.slice(k.length + 1)
				.split('#')[0]
				.trim()
				.replace(/^["']|["']$/g, '')
		: '';
};
const domain = val('BIRD_SIP_DOMAIN'),
	key = process.env.SIP_PASS || val('BIRD_KEY'); // SIP_PASS overrides, e.g. a session credential
const rand = () => Math.floor(Math.random() * 1e10).toString(36);

function trace({ dest, fromNum, label, port }) {
	return new Promise((resolve) => {
		console.log(`\n--- ${label}`);
		const stack = sip.create({ tls: { servername: domain }, port, tls_port: port + 1 }, () => {});
		const uri = `sip:${dest}@${domain};transport=tls`;
		const session = {};
		let signed = false;
		let over = false;
		const rq = {
			method: 'INVITE',
			uri,
			headers: {
				to: { uri },
				from: { uri: `sip:${fromNum}@${domain}`, params: { tag: rand() } },
				'call-id': rand(),
				'max-forwards': 70,
				cseq: { method: 'INVITE', seq: 1 },
				'content-type': 'application/sdp',
				contact: [{ uri: `sip:gate@${domain}` }],
				via: []
			},
			content: `v=0\r\no=- 1 1 IN IP4 ${LIP}\r\ns=-\r\nc=IN IP4 ${LIP}\r\nt=0 0\r\nm=audio 16424 RTP/AVP 0\r\na=sendrecv\r\n`
		};
		const fin = () => {
			if (over) return;
			over = true;
			try {
				stack.destroy();
			} catch {
				/* already destroyed */
			}
			resolve();
		};
		const onResponse = (rs) => {
			console.log(
				`    <- ${rs.status} ${rs.reason ?? ''}${signed ? '   [signed]' : '   [unsigned]'}`
			);
			if (rs.status === 407 && !signed) {
				signed = true;
				const o = rs.headers['proxy-authenticate'];
				if (Array.isArray(o)) {
					const m = o.filter((c) => !c.algorithm || /md5/i.test(String(c.algorithm)));
					if (m.length) rs.headers['proxy-authenticate'] = m;
				}
				rq.headers.cseq.seq++;
				rq.headers.via = []; // sip.send pushed a Via on attempt 1; avoid a stale double Via
				digest.signRequest(session, rq, rs, { user: 'bird', password: key });
				if (process.env.SIP_ALG) {
					// sip/digest lowercases the challenge algorithm; let us force the casing
					const pa = rq.headers['proxy-authorization'];
					if (pa?.length) pa[pa.length - 1].algorithm = process.env.SIP_ALG;
				}
				stack.send(rq, onResponse);
				return;
			}
			if (rs.status === 180 || rs.status === 183 || (rs.status >= 200 && rs.status < 300)) {
				stack.send({
					method: 'CANCEL',
					uri,
					headers: {
						to: rq.headers.to,
						from: rq.headers.from,
						'call-id': rq.headers['call-id'],
						cseq: { method: 'CANCEL', seq: rq.headers.cseq.seq },
						via: rq.headers.via
					}
				});
				console.log('    => RINGING, cancelled');
				return fin();
			}
			if (rs.status >= 200) fin();
		};
		stack.send(rq, onResponse);
		setTimeout(fin, 12000);
	});
}

const arg = (n) => process.argv[n];
const FROM = arg(2),
	TO = arg(3);
if (FROM && TO) {
	await trace({ dest: TO, fromNum: FROM, label: `From=${FROM}  ->  ${TO}`, port: 15300 });
} else {
	console.error('usage: node sip-trace.mjs <fromNumber> <toNumber>');
}
console.log();
process.exit(0);

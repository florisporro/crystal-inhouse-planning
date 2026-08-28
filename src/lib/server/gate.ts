import os from 'node:os';
import sip from 'sip';
import digest from 'sip/digest.js';
import { env } from '$env/dynamic/private';
import { gatePhase, type GatePhase } from '$lib/gate';

/** yyyy-mm-dd in the building's timezone — the server may well run on UTC */
export const todayIso = () => new Date().toLocaleDateString('sv', { timeZone: 'Europe/Amsterdam' });

// how long to ring before hanging up. The unit opens on caller ID within a second
// or two, so we only need to ring long enough for it to see us.
// ponytail: hardware calibration knob — tune this at the gate, don't guess it here.
const ringMs = () => Number(env.GATE_RING_MS) || 4000;
const TIMEOUT_MS = 20_000;

/**
 * Normalise a phone number to bare E.164. Bird's dashboard displays numbers as
 * "+31 6 36184369", and a space pasted into a SIP URI makes it unparseable — the
 * stack then dies on an undefined hop rather than telling you why.
 */
export function e164(raw: string | undefined): string | null {
	const n = (raw ?? '').replace(/[\s()./-]/g, '');
	return /^\+[1-9]\d{7,14}$/.test(n) ? n : null;
}

const configured = () => Boolean(env.BIRD_SIP_DOMAIN && env.BIRD_KEY && e164(env.GATE_TO_NUMBER));

type Stack = { send: (msg: unknown, cb?: (rs: never) => void) => void; destroy: () => void };
let stack: Stack | null = null;

/** bind the SIP stack. Called once at boot; no-op when SIP isn't configured. */
export function startSip() {
	if (stack || !configured()) return;
	// sip.create, not sip.start: `start` installs a process-global stack, which would
	// collide with the second stack the loopback test stands up.
	stack = sip.create(
		{
			// SNI is required, not optional: the stack resolves the trunk hostname and
			// connects to the IP, so without servername node checks the cert against the
			// IP and Bird's cert carries only DNS names (*.trunk.eu1.sip.bird.com).
			tls: { servername: env.BIRD_SIP_DOMAIN },
			// We only ever dial out — Bird answers on the connection we opened — so these
			// listen ports are arbitrary. They sit off 5060/5061 so a real PBX, or a
			// second instance of this app, doesn't collide with us. Override to run more
			// than one instance on one host.
			port: Number(env.SIP_PORT) || 5160,
			tls_port: Number(env.SIP_TLS_PORT) || 5161
		},
		// we never expect inbound requests; the gate does not call us
		(rq: never) => stack?.send(sip.makeResponse(rq, 405, 'Method not allowed'))
	) as Stack;
}

const rand = () => Math.floor(Math.random() * 1e10).toString(36);

/** first non-internal IPv4, or loopback if we genuinely have none */
const localAddress = () =>
	Object.values(os.networkInterfaces())
		.flat()
		.find((i) => i && i.family === 'IPv4' && !i.internal)?.address ?? '127.0.0.1';

// The gate never answers, so no RTP session is ever established and this offer is
// never used. It still has to look like a real offer: carriers reject a loopback
// connection address, so advertise a routable one even though nothing listens.
const sdp = () =>
	[
		'v=0',
		`o=- 13374 13374 IN IP4 ${localAddress()}`,
		's=-',
		`c=IN IP4 ${localAddress()}`,
		't=0 0',
		'm=audio 16424 RTP/AVP 0 8 101',
		'a=rtpmap:0 PCMU/8000',
		'a=rtpmap:8 PCMA/8000',
		'a=rtpmap:101 telephone-event/8000',
		'a=sendrecv',
		''
	].join('\r\n');

/** dev fallback: play back the phases on timers so the UI path runs without a trunk */
function simulate(onPhase: (p: GatePhase) => void): string {
	console.log('\n=== GATE: would ring the gate (SIP not configured) ===\n');
	setTimeout(() => onPhase('ringing'), 1200);
	setTimeout(() => onPhase('done'), 1200 + ringMs());
	return `dev-${rand()}`;
}

/**
 * Ring the gate. Returns the SIP Call-ID immediately; `onPhase` fires as the call
 * progresses. The unit opens on caller ID and then rejects, so we deliberately hang
 * up during ringback rather than waiting for an answer.
 */
export function dialGate(onPhase: (p: GatePhase) => void, target?: string): string {
	if (!configured() && !target) return simulate(onPhase);
	if (!stack) startSip();

	// fail with something a human can act on, rather than deep inside the SIP stack
	const to = e164(env.GATE_TO_NUMBER);
	const callerId = e164(env.GATE_FROM_NUMBER);
	if (!to) throw new Error('GATE_TO_NUMBER is not a valid E.164 number (e.g. +31612345678)');
	if (!callerId)
		throw new Error('GATE_FROM_NUMBER is not a valid E.164 number (e.g. +31612345678)');

	const domain = target ?? `${env.BIRD_SIP_DOMAIN};transport=tls`;
	const uri = `sip:${to}@${domain}`;
	const callId = rand();
	const session = {};

	let rang = false;
	let settled = false;
	let signed = false;
	let hangup: ReturnType<typeof setTimeout> | undefined;

	const settle = (p: GatePhase, why: string) => {
		if (settled) return;
		settled = true;
		clearTimeout(hangup);
		clearTimeout(deadline);
		// the SIP exchange is otherwise invisible; without this a failure is just a
		// generic message on screen and nothing in the log
		console.log(`gate call ${callId}: ${p} (${why})`);
		onPhase(p);
	};

	const deadline = setTimeout(() => settle('failed', 'no final response in 20s'), TIMEOUT_MS);

	const invite = {
		method: 'INVITE',
		uri,
		headers: {
			to: { uri },
			// Bird requires E.164 with a leading + on both to and from, and the from
			// must be a caller ID verified in the workspace
			from: { uri: `sip:${callerId}@${env.BIRD_SIP_DOMAIN}`, params: { tag: rand() } },
			'call-id': callId,
			cseq: { method: 'INVITE', seq: Math.floor(Math.random() * 1e5) },
			'content-type': 'application/sdp',
			contact: [{ uri: `sip:gate@${env.BIRD_SIP_DOMAIN}` }],
			// required by RFC 3261 8.1.1; the library only adds it to its own ACKs, so
			// without this our INVITE is malformed and proxies may reject it
			'max-forwards': 70,
			// filled in by sip.send; we read it back to build a matching CANCEL
			via: [] as unknown[]
		},
		content: sdp()
	};

	const onResponse = (rs: {
		status: number;
		reason?: string;
		headers: Record<string, never> & { cseq: { seq: number }; contact?: { uri: string }[] };
	}) => {
		if (settled) return;
		// log the whole exchange, not just the outcome: a bare 403 from the trunk is
		// impossible to diagnose after the fact without seeing what led to it
		console.log(`gate call ${callId}: <- ${rs.status} ${rs.reason ?? ''}`.trimEnd());

		// digest challenge: sign once and retry. Signing more than once would loop.
		if ((rs.status === 407 || rs.status === 401) && !signed) {
			signed = true;
			// Bird offers SHA-256 first and MD5 second. sip/digest picks whichever Digest
			// challenge comes first but only ever computes MD5 — so left alone it sends an
			// MD5 hash labelled sha-256, which Bird rejects with a second 407. Narrow the
			// list to the MD5 challenge so the label matches the maths.
			const key = rs.status === 407 ? 'proxy-authenticate' : 'www-authenticate';
			const offered = rs.headers[key] as { algorithm?: string }[] | undefined;
			if (Array.isArray(offered)) {
				const md5 = offered.filter((c) => !c.algorithm || /md5/i.test(String(c.algorithm)));
				if (md5.length) rs.headers[key] = md5 as never;
			}
			invite.headers.cseq.seq++;
			// sip.send pushed a Via for the first attempt; drop it or the signed INVITE
			// goes out with two Vias (ours plus the stale branch)
			invite.headers.via = [];
			digest.signRequest(session, invite, rs, { user: 'bird', password: env.BIRD_KEY });
			// sip/digest echoes the algorithm lowercased ("md5"), and Bird's proxy
			// matches it case-sensitively: anything but "MD5" is a bare 403 with no
			// call record. Restore the canonical casing after signing.
			const authKey = rs.status === 407 ? 'proxy-authorization' : 'authorization';
			const sent = (invite.headers as unknown as Record<string, { algorithm?: string }[]>)[authKey];
			if (sent?.length) {
				const a = sent[sent.length - 1];
				if (a.algorithm) a.algorithm = a.algorithm.toUpperCase();
			}
			if (env.GATE_DEBUG_SIP)
				console.log('--- SIGNED INVITE ---\n' + sip.stringify(invite as never));
			stack!.send(invite, onResponse as never);
			return;
		}

		const phase = gatePhase(rs.status, rang);
		if (phase === 'ringing') {
			if (!rang) {
				rang = true;
				onPhase('ringing');
				// it heard us — give the unit a moment, then hang up
				hangup = setTimeout(() => {
					// CANCEL must carry the INVITE's own Via branch to match its
					// transaction. sip.send fills that Via in on the request object, and
					// the library leaves an existing branch alone for CANCEL specifically.
					stack!.send({
						method: 'CANCEL',
						uri,
						headers: {
							to: invite.headers.to,
							from: invite.headers.from,
							'call-id': callId,
							cseq: { method: 'CANCEL', seq: invite.headers.cseq.seq },
							via: invite.headers.via
						}
					});
					settle('done', 'cancelled during ringback');
				}, ringMs());
			}
			return;
		}

		if (rs.status >= 200 && rs.status < 300) {
			// it actually answered: acknowledge, then hang up immediately
			const ack = {
				method: 'ACK',
				uri: rs.headers.contact?.[0]?.uri ?? uri,
				headers: {
					to: rs.headers.to,
					from: rs.headers.from,
					'call-id': callId,
					cseq: { method: 'ACK', seq: rs.headers.cseq.seq },
					via: []
				}
			};
			stack!.send(ack);
			stack!.send({
				...ack,
				method: 'BYE',
				headers: { ...ack.headers, cseq: { method: 'BYE', seq: rs.headers.cseq.seq + 1 } }
			});
			settle('done', 'answered, hung up');
			return;
		}

		if (rs.status >= 300) settle(phase, `SIP ${rs.status}`);
		else onPhase(phase); // 1xx progress
	};

	if (env.GATE_DEBUG_SIP) console.log('--- INVITE ---\n' + sip.stringify(invite as never));
	stack!.send(invite, onResponse as never);
	return callId;
}

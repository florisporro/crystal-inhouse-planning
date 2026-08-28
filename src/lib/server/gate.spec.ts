import { afterEach, describe, expect, it, vi } from "vitest";
import sip from "sip";
import digest from "sip/digest.js";
import { dialGate, e164 } from "./gate";
import type { GatePhase } from "$lib/gate";

// $env/dynamic/private is a frozen snapshot under vitest, so vi.stubEnv can't reach
// it — mock the module instead. The trunk address varies per test and is passed to
// dialGate directly rather than through here.
vi.mock("$env/dynamic/private", () => ({
	env: {
		BIRD_SIP_DOMAIN: "127.0.0.1",
		BIRD_KEY: "secret",
		GATE_TO_NUMBER: "+31600000000",
		GATE_FROM_NUMBER: "+31611111111",
		GATE_RING_MS: "300",
		SIP_PORT: "15055",
		SIP_TLS_PORT: "15056",
	},
}));

// A fake Bird trunk on localhost. This is the only way to exercise the real
// INVITE -> 407 -> signed INVITE -> 180 -> CANCEL exchange without a carrier:
// digest auth and CANCEL branch reuse are exactly the parts that are painful to
// debug live, so they get a test that fails loudly instead.

type Fake = { stack: { destroy(): void }; port: number; seen: string[] };

function fakeTrunk(
	reply: (status: number) => number[],
	password = "secret",
): Fake {
	const port = 15060 + Math.floor(Math.random() * 2000);
	const seen: string[] = [];
	const session: Record<string, unknown> = { realm: "bird" };

	const stack = sip.create({ port, udp: true, tcp: false }, (rq: never) => {
		const r = rq as unknown as {
			method: string;
			headers: Record<string, unknown>;
		};
		seen.push(r.method);

		if (r.method === "CANCEL") {
			stack.send(sip.makeResponse(rq, 200, "Ok"));
			return;
		}
		if (r.method === "ACK" || r.method === "BYE") return;

		// challenge the first INVITE, accept the signed one
		if (!digest.authenticateRequest(session, rq, { user: "bird", password })) {
			const res = sip.makeResponse(rq, 407, "Proxy Authentication Required");
			digest.challenge(session, res);
			stack.send(res);
			return;
		}
		for (const status of reply(407))
			stack.send(sip.makeResponse(rq, status, "x"));
	});

	return { stack, port, seen };
}

let trunk: Fake | null = null;
afterEach(() => {
	trunk?.stack.destroy();
	trunk = null;
});

/** drive dialGate against the fake trunk and collect the phases it emits */
async function run(reply: (s: number) => number[], ms = 2500) {
	trunk = fakeTrunk(reply);
	const phases: GatePhase[] = [];
	dialGate((p) => phases.push(p), `127.0.0.1:${trunk.port};transport=udp`);
	await new Promise((r) => setTimeout(r, ms));
	return phases;
}

describe("dialGate over SIP", () => {
	it("authenticates, rings, then hangs up during ringback", async () => {
		const phases = await run(() => [100, 180]);
		expect(phases).toContain("ringing");
		expect(phases.at(-1)).toBe("done");
		// the retry after the 407 means the trunk saw two INVITEs, then our CANCEL
		expect(trunk!.seen.filter((m) => m === "INVITE").length).toBe(2);
		expect(trunk!.seen).toContain("CANCEL");
	}, 10_000);

	it("fails when the trunk rejects on permission, without ringing", async () => {
		const phases = await run(() => [403]);
		expect(phases.at(-1)).toBe("failed");
		expect(phases).not.toContain("ringing");
	}, 10_000);

	it("treats a rejection from the far end as the gate having opened", async () => {
		const phases = await run(() => [100, 180, 486]);
		expect(phases.at(-1)).toBe("done");
	}, 10_000);
});

describe("e164", () => {
	// Bird's dashboard renders numbers as "+31 6 36184369"; pasted verbatim that makes
	// the SIP URI unparseable, and the stack dies somewhere unhelpful
	it("strips the formatting a dashboard copy-paste brings along", () => {
		expect(e164("+31 6 11111111")).toBe("+31611111111");
		expect(e164("+31-6-1111 1111")).toBe("+31611111111");
		expect(e164("+31 (6) 11111111")).toBe("+31611111111");
	});

	it("passes a clean number through", () => {
		expect(e164("+31611111111")).toBe("+31611111111");
	});

	it("rejects anything that is not E.164", () => {
		expect(e164("0611111111")).toBeNull(); // national format, no country code
		expect(e164("+31")).toBeNull();
		expect(e164("")).toBeNull();
		expect(e164(undefined)).toBeNull();
		expect(e164("+31611111111x")).toBeNull();
	});
});

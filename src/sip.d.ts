// The `sip` package ships no types. We use a narrow slice of it: create a stack,
// send requests, build responses. Typed loosely on purpose — the real contract is
// RFC 3261, not a .d.ts.
declare module 'sip' {
	type Msg = Record<string, unknown>;
	interface Stack {
		send(msg: Msg, cb?: (rs: never) => void): void;
		destroy(): void;
	}
	const sip: {
		create(options: Record<string, unknown>, onRequest: (rq: never) => void): Stack;
		makeResponse(rq: never, status: number, reason?: string): Msg;
		parseUri(uri: string): Record<string, unknown>;
		stringify(msg: unknown): string;
		stringifyUri(uri: unknown): string;
	};
	export default sip;
}

declare module 'sip/digest.js' {
	const digest: {
		signRequest(
			session: Record<string, unknown>,
			request: unknown,
			response?: unknown,
			credentials?: { user: string; realm?: string; password?: string }
		): unknown;
		challenge(session: Record<string, unknown>, response: unknown): unknown;
		authenticateRequest(
			session: Record<string, unknown>,
			request: unknown,
			credentials?: { user: string; realm?: string; password?: string }
		): boolean;
	};
	export default digest;
}

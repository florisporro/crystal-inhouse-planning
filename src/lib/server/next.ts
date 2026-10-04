// where to send someone after login; only same-site paths, never `//host` or `/\host`
// (browsers treat both as another origin), so ?next= can't become an open redirect
export function safeNext(value: string | null | undefined): string | null {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\'))
		return null;
	return value;
}

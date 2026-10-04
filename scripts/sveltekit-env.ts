// lets bun scripts import server modules that use SvelteKit's $env
import { plugin } from 'bun';

plugin({
	setup(build) {
		build.module('$env/dynamic/private', () => ({
			exports: { env: process.env },
			loader: 'object'
		}));
	}
});

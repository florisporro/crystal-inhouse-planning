import { defineConfig } from '@playwright/test';

// self-contained run: fresh throwaway db + email outbox under e2e/, seeded from
// the real apartments CSV and a one-line test email list
export default defineConfig({
	webServer: {
		command:
			'rm -f e2e/.test.db e2e/.outbox.jsonl && bunx drizzle-kit push --force && bun run db:seed && bun run db:seed-emails && npm run build && npm run preview',
		port: 4173,
		timeout: 180_000,
		env: {
			DATABASE_URL: 'file:e2e/.test.db',
			ORIGIN: 'http://localhost:4173',
			BETTER_AUTH_SECRET: 'e2e-only-secret',
			APARTMENT_EMAILS_CSV: 'e2e/test-emails.csv',
			EMAIL_OUTBOX: 'e2e/.outbox.jsonl',
			POSTMARK_TOKEN: '',
			ADMIN_EMAILS: '',
			UNSOLD_EMAIL: ''
		}
	},
	use: { baseURL: 'http://localhost:4173' },
	testMatch: '**/*.e2e.{ts,js}'
});

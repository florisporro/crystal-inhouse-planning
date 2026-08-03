import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// the full resident journey: magic-link login → set status → announce → cancel.
// The login link lands in e2e/.outbox.jsonl via the EMAIL_OUTBOX hook.
test('magic-link login, announce and cancel an activity', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Apartment number').fill('5');
	await page.getByLabel('Email address').fill('resident@example.com');
	await page.getByRole('button', { name: 'Send login link' }).click();

	// neutral response either way — the link itself arrives in the outbox
	await expect(page.getByText('a login link is on its way')).toBeVisible();
	let link: string | undefined;
	for (let i = 0; i < 40 && !link; i++) {
		await page.waitForTimeout(250);
		try {
			link = readFileSync('e2e/.outbox.jsonl', 'utf8').match(
				/http:\/\/localhost:4173\/[^\s"\\]+/
			)?.[0];
		} catch {
			// outbox not written yet
		}
	}
	expect(link).toBeTruthy();

	await page.goto(link!);
	await expect(page).toHaveURL(/\/my/);
	await expect(page.getByRole('heading', { name: 'Apartment 5' })).toBeVisible();

	// fresh apartment starts as "no response": pick a status to unlock announcing
	await page.getByText('No move planned yet').click();
	await page.getByRole('link', { name: '+ Announce activity' }).click();

	// wizard: type → date + block → confirm
	await page.getByRole('button', { name: /Other activity/ }).click();
	const date = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
	await page.getByLabel('Which day?').fill(date);
	await page.getByRole('button', { name: /^Morning/ }).click();
	await page.getByRole('button', { name: 'Announce it' }).click();

	await expect(page).toHaveURL(/\/my/);
	// the active row is the only place a cancel button renders
	await expect(page.getByRole('button', { name: 'Cancel booking' })).toBeVisible();

	await page.getByRole('button', { name: 'Cancel booking' }).click();
	await expect(page.getByRole('button', { name: 'Cancel booking' })).toHaveCount(0);
});

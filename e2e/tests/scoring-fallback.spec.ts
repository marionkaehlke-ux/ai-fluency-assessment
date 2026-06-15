import { expect, test } from '@playwright/test';
import { EMAILS, FAILMODE, userinfo } from '../support/identities';

// Path 4 — scoring failure fallback. The opening reflection carries the FAILMODE sentinel,
// so the mock returns malformed output; after the retry the assessment is scoring_failed
// and the employee sees the recoverable message with a retry action (spec §7a.1/§7a.2).
test.use({ extraHTTPHeaders: { 'X-Userinfo': userinfo(EMAILS.failEmployee, 'Fail Case') } });

const opening = `My honest reflection on where I am with AI right now, written specifically for the end-to-end scoring fallback path so that it comfortably clears the minimum length. ${FAILMODE} marker included here.`;
const answer = (d: string) => `For ${d} I do use AI tools regularly and try to improve how I prompt them over time here.`;

test('employee sees the recoverable error when scoring fails', async ({ page }) => {
  await page.goto('/self-assessment');
  await page.getByRole('button', { name: /Begin/ }).click();

  await page.getByRole('textbox').fill(opening);
  await page.getByRole('button', { name: /Next/ }).click();

  const boxes = page.getByRole('textbox');
  for (let i = 0; i < 4; i += 1) await boxes.nth(i).fill(answer(`theme ${i}`));

  await page.getByRole('button', { name: /Review/ }).click();
  await page.getByRole('button', { name: /Submit for scoring/ }).click();

  await expect(page.getByText(/We couldn’t score your responses right now/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Try again/ })).toBeVisible();
});

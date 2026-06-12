import { expect, test } from '@playwright/test';
import { EMAILS, userinfo } from '../support/identities';

// Path 3 — ELT organisation dashboard loads for an ELT member (email in ELT_EMAILS).
test.use({ extraHTTPHeaders: { 'X-Userinfo': userinfo(EMAILS.elt, 'E2E Exec') } });

test('ELT dashboard loads with aggregates and export', async ({ page }) => {
  await page.goto('/elt');

  await expect(page.getByRole('heading', { name: 'Organisation — AI fluency' })).toBeVisible();
  await expect(page.getByText(/calibrated assessments/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Export anonymised CSV/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AI executive narrative' })).toBeVisible();
});

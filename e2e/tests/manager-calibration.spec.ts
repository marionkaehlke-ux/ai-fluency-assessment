import { expect, test } from '@playwright/test';
import { EMAILS, IDS, userinfo } from '../support/identities';

// Path 2 — manager calibration of an AI-scored assessment (seeded). The manager confirms
// the agreed levels (manager_confirmed gate) and the assessment becomes CALIBRATED.
test.use({ extraHTTPHeaders: { 'X-Userinfo': userinfo(EMAILS.manager, 'E2E Manager') } });

test('manager confirms agreed levels and the assessment is calibrated', async ({ page }) => {
  await page.goto(`/manager/calibrate/${IDS.assessmentAi}`);

  await expect(page.getByRole('heading', { name: 'Conversation guide' })).toBeVisible();
  // AI suggestions are shown for review.
  await expect(page.getByText(/AI suggestion — review with your employee/).first()).toBeVisible();

  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Confirm agreed levels/ }).click();

  await expect(page.getByText(/This assessment is calibrated/)).toBeVisible();
});

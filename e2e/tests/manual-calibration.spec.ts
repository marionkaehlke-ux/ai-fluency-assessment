import { expect, test } from '@playwright/test';
import { DIMENSIONS } from '@ai-fluency/shared';
import { EMAILS, IDS, userinfo } from '../support/identities';

// Path 5 — manual calibration without AI. The seeded assessment has scoring_failed and no
// AI suggestions; the manager sees the "AI scoring unavailable" banner and enters levels
// manually (spec §7a.3 — manual-only calibration is a supported path).
test.use({ extraHTTPHeaders: { 'X-Userinfo': userinfo(EMAILS.manager, 'E2E Manager') } });

test('manager calibrates manually when AI scoring is unavailable', async ({ page }) => {
  await page.goto(`/manager/calibrate/${IDS.assessmentNoAi}`);

  await expect(page.getByText(/AI scoring is unavailable for this employee/)).toBeVisible();

  // Set an agreed level per dimension (selects default to 0).
  const selects = page.getByRole('combobox');
  await expect(selects).toHaveCount(DIMENSIONS.length);
  for (let i = 0; i < DIMENSIONS.length; i += 1) await selects.nth(i).selectOption('2');

  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Confirm agreed levels/ }).click();

  await expect(page.getByText(/This assessment is calibrated/)).toBeVisible();
});

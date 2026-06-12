import { expect, test } from '@playwright/test';
import { EMAILS, userinfo } from '../support/identities';

// Path 1 — full employee self-assessment, ending in AI-suggested levels (mock scores valid).
test.use({ extraHTTPHeaders: { 'X-Userinfo': userinfo(EMAILS.newEmployee, 'New Grad') } });

const opening =
  'Honestly, I use AI tools a fair amount in my day-to-day work and I am genuinely keen to get a lot more structured and intentional about how I apply them over the coming year.';
const answer = (d: string) =>
  `For ${d}, I have been experimenting on my own initiative and iterating when results are weak, changing how I work.`;

test('employee completes the wizard and sees AI-suggested levels', async ({ page }) => {
  await page.goto('/self-assessment');

  await page.getByRole('button', { name: /Begin/ }).click();

  await page.getByRole('textbox').fill(opening);
  await page.getByRole('button', { name: /Next/ }).click();

  const boxes = page.getByRole('textbox');
  await expect(boxes).toHaveCount(4);
  for (let i = 0; i < 4; i += 1) await boxes.nth(i).fill(answer(`theme ${i}`));

  await page.getByRole('button', { name: /Review/ }).click();
  await page.getByRole('button', { name: /Submit for scoring/ }).click();

  await expect(page.getByText('AI suggestion — review with your manager')).toBeVisible();
  await expect(page.getByText('Your AI-suggested levels')).toBeVisible();
});

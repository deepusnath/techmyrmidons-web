import { expect, test, type Page } from '@playwright/test';

/**
 * Smoke coverage for the browser pilot's core loop.
 *
 * Each test starts from a clean localStorage so state from one does not leak
 * into another, and the persistence test explicitly reloads to prove the
 * local-first storage actually survives a refresh.
 */

async function freshVisit(page: Page, url: string) {
  await page.goto(url);
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(url);
}

/** Fails the test if the page logged a console error. */
function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('onboarding: land, see active and archived domains, enter Frontend', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await freshVisit(page, '/');

  await expect(page.getByRole('heading', { name: /Pick a domain/i })).toBeVisible();

  // Active pilot domain is present and reachable.
  const frontend = page.getByTestId('domain-frontend');
  await expect(frontend).toBeVisible();

  // Archived domains are preserved and explain themselves rather than vanishing.
  await expect(page.getByTestId('archived-quantum-computing')).toContainText(/archived/i);
  await expect(page.getByTestId('archived-quantum-computing')).toContainText(/duplicates the Android list/i);
  await expect(page.getByTestId('archived-actions-on-google')).toContainText(/No content was ever added/i);

  await frontend.click();
  await expect(page.getByRole('heading', { name: 'Frontend Myrmidon', level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test('draft editorial is labelled and never carries a byline', async ({ page }) => {
  await freshVisit(page, '/frontend/');

  const banner = page.getByText(/AI-assisted draft, awaiting domain-editor review/i).first();
  await expect(banner).toBeVisible();

  // The named editor must not appear as the author of unreviewed draft text.
  await expect(page.getByText('Unattributed pending review').first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('By Deepu S Nath');
});

test('landscape: search and category filter narrow the results', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await freshVisit(page, '/frontend/current/');

  const count = page.getByTestId('result-count');
  const total = Number(await count.textContent());
  expect(total).toBeGreaterThan(5);

  // Search narrows.
  await page.getByTestId('tool-search').fill('tailwind');
  await expect(count).not.toHaveText(String(total));
  await expect(page.getByTestId('tool-card').first()).toContainText('Tailwind');

  // Clearing restores.
  await page.getByTestId('tool-search').fill('');
  await expect(count).toHaveText(String(total));

  // Category filter narrows, and every remaining card matches.
  await page.getByTestId('category-filter').selectOption('testing');
  const cards = page.getByTestId('tool-card');
  await expect(cards.first()).toBeVisible();
  for (const c of await cards.all()) {
    await expect(c).toHaveAttribute('data-category', 'testing');
  }

  // An impossible combination gives an honest empty state, not a blank page.
  await page.getByTestId('tool-search').fill('zzzznotarealtool');
  await expect(page.getByText(/Nothing matches those filters/i)).toBeVisible();
  expect(errors).toEqual([]);
});

test('follow: toggles on, off, and survives a reload', async ({ page }) => {
  await freshVisit(page, '/frontend/');

  const follow = page.getByTestId('follow-button');
  await expect(follow).toHaveAttribute('data-following', 'false');

  await follow.click();
  await expect(follow).toHaveAttribute('data-following', 'true');
  await expect(follow).toContainText(/Following/i);

  await page.reload();
  await expect(page.getByTestId('follow-button')).toHaveAttribute('data-following', 'true');

  await page.getByTestId('follow-button').click();
  await expect(page.getByTestId('follow-button')).toHaveAttribute('data-following', 'false');
});

test('progress: mark a tool, toggle it off, and confirm it persists', async ({ page }) => {
  await freshVisit(page, '/frontend/tools/tailwind/');

  const using = page.getByTestId('state-using');
  await expect(using).toHaveAttribute('data-active', 'false');

  await using.click();
  await expect(using).toHaveAttribute('data-active', 'true');

  // Persistence across a full reload is the point of local-first storage.
  await page.reload();
  await expect(page.getByTestId('state-using')).toHaveAttribute('data-active', 'true');

  // Clicking the active state clears it.
  await page.getByTestId('state-using').click();
  await expect(page.getByTestId('state-using')).toHaveAttribute('data-active', 'false');

  // "Proven" is present but locked in this pilot.
  await expect(page.getByText(/Proven · locked/i)).toBeVisible();
});

test('snapshot: marked tools appear in Where I stand with explainable suggestions', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await freshVisit(page, '/me/');

  // Honest empty state before anything is marked.
  await expect(page.getByText(/You have not marked any tools yet/i)).toBeVisible();

  // Mark a declining tool so a suggestion can be derived from it.
  await page.goto('/frontend/tools/webpack/');
  await page.getByTestId('state-using').click();
  await expect(page.getByTestId('state-using')).toHaveAttribute('data-active', 'true');

  await page.goto('/frontend/tools/tailwind/');
  await page.getByTestId('state-shipped').click();

  await page.goto('/me/');
  await expect(page.getByTestId('marked-total')).toHaveText('2');
  await expect(page.getByTestId('snapshot-item-webpack')).toBeVisible();
  await expect(page.getByTestId('snapshot-item-tailwind')).toBeVisible();

  // Suggestions must state WHY, and must derive from the user's own marks.
  const suggestions = page.getByTestId('suggestions');
  await expect(suggestions).toContainText(/Why this:/);
  await expect(suggestions).toContainText(/webpack/i);

  // No composite score or ranking language anywhere on the page.
  await expect(page.locator('body')).not.toContainText(/overall score/i);
  expect(errors).toEqual([]);
});

test('activity: real, own and demonstration data are separated and labelled', async ({ page }) => {
  await freshVisit(page, '/frontend/activity/');

  await expect(page.getByRole('heading', { name: 'Practitioner activity' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your activity' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Demonstration members' })).toBeVisible();

  // Fictional users must be unmistakable.
  await expect(page.getByText(/These people do not exist/i)).toBeVisible();
  await expect(page.getByTestId('demo-activity')).toContainText('(demo)');

  // Sourced practitioner rows must link to a real commit.
  const sourced = page.getByTestId('sourced-activity');
  if (await sourced.isVisible()) {
    const link = sourced.getByRole('link', { name: /source/i }).first();
    await expect(link).toHaveAttribute('href', /github\.com\/.+\/commit\/[0-9a-f]{7,}/);
  }
});

test('submission: validates, queues locally, and survives a reload', async ({ page }) => {
  await freshVisit(page, '/submit/');

  // Validation rejects an incomplete submission rather than silently accepting.
  await page.getByTestId('sub-submit').click();
  await expect(page.getByTestId('sub-error')).toBeVisible();

  await page.getByTestId('sub-name').fill('Panda CSS');
  await page.getByTestId('sub-url').fill('not-a-url');
  await page.getByTestId('sub-submit').click();
  await expect(page.getByTestId('sub-error')).toContainText(/full URL/i);

  await page.getByTestId('sub-url').fill('https://panda-css.com');
  await page.getByTestId('sub-why').fill('Build-time CSS-in-JS; worth weighing against Tailwind.');
  await page.getByTestId('sub-submit').click();

  await expect(page.getByTestId('sub-success')).toBeVisible();
  await expect(page.getByTestId('submission-list')).toContainText('Panda CSS');

  await page.reload();
  await expect(page.getByTestId('submission-list')).toContainText('Panda CSS');
});

test('feedback: states the no-backend limitation and saves locally', async ({ page }) => {
  await freshVisit(page, '/frontend/');

  await page.getByTestId('feedback-open').click();
  const panel = page.getByTestId('feedback-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(/No backend is configured/i);

  await page.getByTestId('feedback-body').fill('The historical view is the most useful part.');
  await page.getByTestId('feedback-save').click();
  await expect(page.getByTestId('feedback-saved')).toBeVisible();
  await expect(page.getByTestId('feedback-saved')).toContainText(/has not been sent/i);
});

test('historical: shows decline, which the original archive could not express', async ({ page }) => {
  await freshVisit(page, '/frontend/historical/');

  await expect(page.getByTestId('year-2017')).toContainText(/original curation/i);
  await expect(page.getByTestId('year-2021')).toContainText(/Faded/);

  // The specific structural fix: AngularJS is recorded as fading.
  await expect(page.getByTestId('year-2021')).toContainText(/AngularJS/);
});

test('no horizontal overflow at mobile or desktop width', async ({ page }) => {
  for (const url of ['/', '/frontend/', '/frontend/current/', '/frontend/historical/', '/me/', '/submit/']) {
    await page.goto(url);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow, `horizontal overflow at ${url}`).toBe(false);
  }
});

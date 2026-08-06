import { expect, test, type Page } from '@playwright/test';

/**
 * Smoke coverage for the browser pilot's core loop.
 *
 * Each test starts from a clean localStorage so state from one does not leak
 * into another, and the persistence test explicitly reloads to prove the
 * local-first storage actually survives a refresh.
 */

/**
 * Deployments under a subpath (GitHub Pages project sites) need every route
 * prefixed. Without this a leading-slash path resolves against the origin and
 * silently drops the subpath.
 *   BASE_URL=https://user.github.io BASE_PREFIX=/repo npx playwright test
 */
const PREFIX = process.env.BASE_PREFIX ?? '';
const p = (route: string) => `${PREFIX}${route}`;

/** Set when running against a build made with NEXT_PUBLIC_SHOW_DRAFTS=false. */
const PRODUCTION_MODE = process.env.DRAFTS_HIDDEN === '1';

async function freshVisit(page: Page, route: string) {
  await page.goto(p(route));
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(p(route));
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
  test.skip(PRODUCTION_MODE, 'production withholds draft editorial rather than labelling it');
  await freshVisit(page, '/frontend/');

  const banner = page.getByText(/AI-assisted draft, awaiting domain-editor review/i).first();
  await expect(banner).toBeVisible();

  // The named editor must not appear as the author of unreviewed draft text.
  await expect(page.getByText('Unattributed pending review').first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('By Deepu S Nath');
});

test('landscape: search and category filter narrow the results', async ({ page }) => {
  // Production withholds every lifecycle classification, so the Current view is
  // legitimately empty and there is nothing to filter. Preview-only until
  // lifecycles are reviewed.
  test.skip(PRODUCTION_MODE, 'no lifecycle is reviewed, so production has no populated landscape');
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

test('snapshot: context assessment drives an explainable diagnosis', async ({ page }) => {
  test.skip(PRODUCTION_MODE, 'the diagnosis does not run in production; gating is covered in trust.spec');
  const errors = trackConsoleErrors(page);
  await freshVisit(page, '/me/');

  // Context is required before anything is recommended.
  await expect(page.getByTestId('needs-context')).toBeVisible();

  await page.getByTestId('work-legacy').click();
  await page.getByTestId('goal-modernize').click();
  await page.getByTestId('assessment-search').fill('webpack');
  await page.getByTestId('pick-webpack-using').click();
  await page.getByTestId('assessment-search').fill('tailwind');
  await page.getByTestId('pick-tailwind-shipped').click();
  await page.getByTestId('assessment-done').click();

  await expect(page.getByTestId('marked-total')).toHaveText('2');
  await expect(page.getByTestId('snapshot-item-webpack')).toBeVisible();
  await expect(page.getByTestId('snapshot-item-tailwind')).toBeVisible();

  // Suggestions state why they apply and when they would not.
  const suggestions = page.getByTestId('suggestions');
  await expect(suggestions).toContainText(/Why this applies to you:/);
  await expect(suggestions).toContainText(/Not for you if:/);

  await expect(page.locator('body')).not.toContainText(/overall score/i);
  expect(errors).toEqual([]);
});

test('activity: repository signals, own activity and demo data stay separated', async ({ page }) => {
  await freshVisit(page, '/frontend/activity/');

  await expect(page.getByRole('heading', { name: 'Repository signals' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your activity' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Demonstration members' })).toBeVisible();

  // Fictional users must be unmistakable.
  await expect(page.getByText(/These people do not exist/i)).toBeVisible();
  await expect(page.getByTestId('demo-activity')).toContainText('(demo)');

  // Repository rows link to a real commit and make no claim about a person.
  const rows = page.getByTestId('repo-signal');
  if ((await rows.count()) > 0) {
    await expect(rows.first().getByRole('link', { name: /commit/i })).toHaveAttribute(
      'href',
      /github\.com\/.+\/commit\/[0-9a-f]{7,}/,
    );
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

test('historical: records decline as a typed event with a stated basis', async ({ page }) => {
  await freshVisit(page, '/frontend/historical/');

  await expect(page.getByTestId('year-2017')).toContainText(/original curation/i);

  // The structural fix: AngularJS reaching end of life is recorded as a typed
  // event, and — being a factual claim about the project — it now cites the
  // project's own support-status page rather than resting on an AI reading.
  const eol = page.getByTestId('year-2021').getByTestId('event-angularjs');
  await expect(eol).toContainText(/Reached end of life/i);
  await expect(eol).toHaveAttribute('data-claim-status', 'sourced');
  await expect(eol).toContainText(/official source/i);
});

test('no horizontal overflow at mobile or desktop width', async ({ page }) => {
  for (const route of ['/', '/frontend/', '/frontend/current/', '/frontend/historical/', '/me/', '/submit/']) {
    await page.goto(p(route));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow, `horizontal overflow at ${route}`).toBe(false);
  }
});

test('landscape: tabs switch the tool list in place, without navigating', async ({ page }) => {
  // Lifecycle is unreviewed, so a production build has nothing to put in any of
  // the four panels. Preview-only until those classifications are reviewed.
  test.skip(PRODUCTION_MODE, 'no lifecycle is reviewed, so production has no populated landscape');
  const errors = trackConsoleErrors(page);
  await freshVisit(page, '/frontend/');

  const url = page.url();
  const panelCards = () => page.locator('[role="tabpanel"] [data-testid="tool-card"]');

  // Current is selected on arrival and its tools are already on the page —
  // the point of the change is not having to click through to see them.
  await expect(page.getByTestId('landscape-tab-current')).toHaveAttribute('aria-selected', 'true');
  const currentCount = await panelCards().count();
  expect(currentCount).toBeGreaterThan(5);

  // Switching is in place: the panel swaps and the URL does not change.
  await page.getByTestId('landscape-tab-emerging').click();
  await expect(page.getByTestId('landscape-panel-emerging')).toBeVisible();
  await expect(page.getByTestId('landscape-tab-emerging')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('landscape-tab-current')).toHaveAttribute('aria-selected', 'false');
  expect(page.url()).toBe(url);
  const emergingCount = await panelCards().count();
  expect(emergingCount).toBeGreaterThan(0);
  expect(emergingCount).not.toBe(currentCount);

  // Arrow keys drive the tablist, as a tablist is expected to.
  await page.getByTestId('landscape-tab-emerging').press('ArrowRight');
  await expect(page.getByTestId('landscape-tab-declining')).toHaveAttribute('aria-selected', 'true');

  // Each panel still offers its own page, so the views stay deep-linkable.
  await expect(page.getByTestId('landscape-full-declining')).toHaveAttribute('href', /\/frontend\/declining\/$/);

  // A query typed in one tab must not silently narrow the next one.
  await page.getByTestId('landscape-tab-current').click();
  await page.getByTestId('tool-search').fill('tailwind');
  const filtered = await panelCards().count();
  expect(filtered).toBeLessThan(currentCount);
  await page.getByTestId('landscape-tab-emerging').click();
  await page.getByTestId('landscape-tab-current').click();
  await expect(page.getByTestId('tool-search')).toHaveValue('');
  expect(await panelCards().count()).toBe(currentCount);

  expect(errors).toEqual([]);
});

test('landscape: pages 12 at a time and starts over when filters change', async ({ page }) => {
  test.skip(PRODUCTION_MODE, 'no lifecycle is reviewed, so production has no populated landscape');
  const errors = trackConsoleErrors(page);
  await freshVisit(page, '/frontend/current/');

  const cards = page.getByTestId('tool-card');
  const total = Number(await page.getByTestId('result-count').textContent());
  expect(total).toBeGreaterThan(12);

  // A long list arrives as one page, not as a scroll.
  await expect(cards).toHaveCount(12);
  await expect(page.getByTestId('load-more')).toBeVisible();

  // Each press adds a page, and the last one asks for only what is left.
  await page.getByTestId('load-more').click();
  await expect(cards).toHaveCount(Math.min(24, total));
  const remaining = total - 24;
  if (remaining > 0) {
    await expect(page.getByTestId('load-more')).toHaveText(`Show ${Math.min(12, remaining)} more`);
    await page.getByTestId('load-more').click();
  }

  // Once everything is shown the control goes away rather than sitting there dead.
  await expect(cards).toHaveCount(total);
  await expect(page.getByTestId('load-more')).toHaveCount(0);

  // Narrowing after expanding must start the count again, or the reader is left
  // on a page size they never chose.
  await page.getByTestId('tool-search').fill('e');
  const matching = Number(await page.getByTestId('result-count').textContent());
  if (matching > 12) {
    await expect(cards).toHaveCount(12);
    await expect(page.getByTestId('load-more')).toBeVisible();
  }

  // A filter narrower than one page offers nothing to load.
  await page.getByTestId('tool-search').fill('');
  await page.getByTestId('category-filter').selectOption('testing');
  expect(await cards.count()).toBeLessThan(12);
  await expect(page.getByTestId('load-more')).toHaveCount(0);

  expect(errors).toEqual([]);
});

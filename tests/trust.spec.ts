import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 2.5 — trust and diagnosis.
 *
 * These assert the properties that make the product honest rather than merely
 * functional: that AI-authored claims are visibly unreviewed, that no false
 * named-editor attribution appears, that repository signals never imply
 * personal usage, and that recommendations come from context rather than from
 * empty categories.
 */

const PREFIX = process.env.BASE_PREFIX ?? '';
const p = (route: string) => `${PREFIX}${route}`;

/** Set when the suite runs against a build made with NEXT_PUBLIC_SHOW_DRAFTS=false. */
const PRODUCTION_MODE = process.env.DRAFTS_HIDDEN === '1';

async function freshVisit(page: Page, route: string) {
  await page.goto(p(route));
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(p(route));
}

async function completeAssessment(
  page: Page,
  work: string,
  goal: string,
  tools: Array<[string, string]> = [],
) {
  await page.goto(p('/me/'));
  await page.getByTestId(`work-${work}`).click();
  await page.getByTestId(`goal-${goal}`).click();
  for (const [slug, state] of tools) {
    await page.getByTestId('assessment-search').fill(slug);
    await page.getByTestId(`pick-${slug}-${state}`).click();
  }
  await page.getByTestId('assessment-done').click();
}

// ---------------------------------------------------------------------------
// A. editorial provenance
// ---------------------------------------------------------------------------

test('every AI-authored tool claim is visibly marked unreviewed', async ({ page }) => {
  test.skip(PRODUCTION_MODE, 'preview-mode assertion');
  await freshVisit(page, '/frontend/current/');

  const cards = page.getByTestId('tool-card');
  const count = await cards.count();
  expect(count).toBeGreaterThan(5);

  // Not a sample — every single card must carry a review marker.
  for (let i = 0; i < count; i++) {
    await expect(cards.nth(i).getByTestId('review-chip-draft')).toBeVisible();
  }
});

test('tool detail marks its editorial claims as unreviewed', async ({ page }) => {
  test.skip(PRODUCTION_MODE, 'preview-mode assertion');
  await freshVisit(page, '/frontend/tools/tailwind/');
  await expect(page.getByTestId('review-chip-draft').first()).toBeVisible();
  await expect(page.getByText(/Lifecycle is an editorial classification/i).first()).toBeVisible();
});

test('no false named-editor wording appears anywhere', async ({ page }) => {
  for (const route of ['/frontend/', '/frontend/current/', '/frontend/historical/', '/frontend/tools/tailwind/', '/review/']) {
    await page.goto(p(route));
    const body = page.locator('body');
    await expect(body, route).not.toContainText('By Deepu S Nath');
    await expect(body, route).not.toContainText(/authored judgement by a named/i);
    await expect(body, route).not.toContainText(/An authored opinion by a named editor/i);
    // "Reviewed by <name>" may only appear where a review actually exists.
    const reviewedBy = await body.getByText(/Reviewed by /i).count();
    if (reviewedBy > 0) {
      await expect(page.getByTestId('review-chip-reviewed').first()).toBeVisible();
    }
  }
});

test('footer does not overclaim source coverage', async ({ page }) => {
  await page.goto(p('/frontend/'));
  const footer = page.locator('footer');
  await expect(footer).toContainText(/Sources and provenance are shown where available/i);
  await expect(footer).not.toContainText(/Every claim carries its source and date/i);
});

test('review inventory lists unreviewed claims without attributing them', async ({ page }) => {
  await page.goto(p('/review/'));
  await expect(page.getByRole('heading', { name: /Editorial review inventory/i })).toBeVisible();
  await expect(page.getByTestId('unreviewed-tools').locator('li').first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Deepu S Nath');
  // Coverage and gaps are stated, not implied.
  await expect(page.locator('body')).toContainText(/Signals eligible to inform trends/i);
  await expect(page.locator('body')).toContainText(/Community-verified evidence/i);
});

// ---------------------------------------------------------------------------
// B. repository signal semantics
// ---------------------------------------------------------------------------

test('repository signals never imply personal usage', async ({ page }) => {
  await freshVisit(page, '/frontend/activity/');

  await expect(page.getByRole('heading', { name: 'Repository signals' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Practitioner activity/i })).toHaveCount(0);

  const section = page.locator('body');
  await expect(section).toContainText(/A dependency change is not a statement about a person/i);

  const rows = page.getByTestId('repo-signal');
  if ((await rows.count()) > 0) {
    const first = rows.first();
    // States what happened to a file, with context and a commit link.
    await expect(first).toContainText(/was (added to|removed from)/i);
    await expect(first).toContainText(/context unknown/i);
    await expect(first).toContainText(/not used for trends/i);
    await expect(first.getByRole('link', { name: /commit/i })).toHaveAttribute(
      'href',
      /github\.com\/.+\/commit\/[0-9a-f]{7,}/,
    );
    // No verb that would turn a file change into a claim about a human.
    await expect(first).not.toContainText(/\b(uses|prefers|adopted|abandoned|switched to)\b/i);
  }
});

// ---------------------------------------------------------------------------
// C. context-driven diagnosis
// ---------------------------------------------------------------------------

test('recommendations require context rather than guessing', async ({ page }) => {
  await freshVisit(page, '/me/');
  await expect(page.getByTestId('needs-context')).toBeVisible();
  await expect(page.getByTestId('assessment')).toBeVisible();
  // Nothing is recommended before context exists.
  await expect(page.getByTestId('suggestions')).toHaveCount(0);
});

test('an empty category alone never triggers a recommendation', async ({ page }) => {
  await freshVisit(page, '/me/');
  // Design-system context with Storybook marked. Many categories are empty, but
  // suggestions must come from the context rules, not from those gaps.
  await completeAssessment(page, 'design_systems', 'stay_current', [['storybook', 'using']]);

  const suggestions = page.getByTestId('suggestions');
  await expect(suggestions).toBeVisible();

  // Tailwind is a populated category the user has nothing in — under the old
  // category-completion logic it would be suggested. It must not be, because
  // utility classes suit design systems poorly.
  await expect(page.getByTestId('suggestion-tailwind')).toHaveCount(0);
  await expect(page.getByTestId('suggestion-bootstrap')).toHaveCount(0);

  // And every suggestion explains itself both ways.
  await expect(suggestions).toContainText(/Why this applies to you:/);
  await expect(suggestions).toContainText(/Not for you if:/);
});

test('recommendations differ meaningfully by work context and goal', async ({ page }) => {
  const collect = async () => {
    const ids = await page.getByTestId('suggestions').locator('[data-testid^="suggestion-"]').all();
    const slugs: string[] = [];
    for (const el of ids) slugs.push(((await el.getAttribute('data-testid')) ?? '').replace('suggestion-', ''));
    return slugs;
  };

  // Journey 1 — legacy maintenance, modernizing an old stack.
  await freshVisit(page, '/me/');
  await completeAssessment(page, 'legacy', 'modernize', [
    ['gulp', 'using'], ['jquery', 'using'], ['bootstrap', 'using'], ['sass', 'using'],
  ]);
  const legacy = await collect();
  expect(legacy.length).toBeGreaterThan(0);
  expect(legacy.length).toBeLessThanOrEqual(3);
  await expect(page.getByTestId('reconsider-gulp')).toBeVisible();
  await expect(page.getByTestId('appropriate-sass')).toBeVisible();

  // Journey 2 — content site, new stack.
  await freshVisit(page, '/me/');
  await completeAssessment(page, 'content', 'new_stack');
  const content = await collect();
  expect(content).toContain('astro');

  // Journey 3 — SaaS app already on React and Vite.
  await freshVisit(page, '/me/');
  await completeAssessment(page, 'apps', 'stay_current', [['react', 'using'], ['vite', 'using']]);
  const apps = await collect();
  expect(apps).not.toContain('astro');
  expect(apps).not.toContain('react');

  // The three contexts must not produce the same answer.
  expect(new Set([legacy.join(), content.join(), apps.join()]).size).toBe(3);
});

test('no score, percentage, level or completeness meter is produced', async ({ page }) => {
  await freshVisit(page, '/me/');
  await completeAssessment(page, 'apps', 'stay_current', [['react', 'using']]);
  const body = page.locator('body');

  // Target a score being *presented*, not the vocabulary — the page legitimately
  // says it has no score, and that sentence must not trip the guard.
  await expect(body).not.toContainText(/\b\d{1,3}\s?%\s*(complete|coverage|match|current|modern)/i);
  await expect(body).not.toContainText(/(your|overall|readiness|modernity)\s+score\b/i);
  await expect(body).not.toContainText(/\bscore:\s*\d/i);
  await expect(body).not.toContainText(/\b\d+\s*\/\s*(100|10)\b/);
  await expect(body).not.toContainText(/\b(level|tier)\s*\d\b/i);

  // No meter widgets of any kind.
  await expect(page.locator('progress, meter, [role="progressbar"]')).toHaveCount(0);

  // And the actual constraint: at most three suggestions.
  const suggestions = page.getByTestId('suggestions').locator('[data-testid^="suggestion-"]');
  expect(await suggestions.count()).toBeLessThanOrEqual(3);
});

// ---------------------------------------------------------------------------
// D. historical event language
// ---------------------------------------------------------------------------

test('historical events are typed and display their evidence basis', async ({ page }) => {
  await freshVisit(page, '/frontend/historical/');

  // The old ambiguous labels are gone.
  await expect(page.locator('body')).not.toContainText(/^Arrived:/);
  await expect(page.locator('body')).not.toContainText(/\bFaded:/);

  // Archive-sourced events state their basis.
  const archiveEvent = page.getByTestId('year-2017').getByTestId(/^event-/).first();
  await expect(archiveEvent).toHaveAttribute('data-claim-status', 'sourced');
  await expect(archiveEvent).toContainText(/First included in TechMyrmidons/i);
  await expect(archiveEvent).toContainText(/archive record/i);

  if (!PRODUCTION_MODE) {
    // AI interpretations are typed AND flagged as unreviewed, never as dates.
    const aiEvent = page.getByTestId('year-2021').getByTestId(/^event-/).first();
    await expect(aiEvent).toHaveAttribute('data-claim-status', 'ai_draft');
    await expect(aiEvent).toContainText(/AI interpretation, unreviewed/i);
  }
});

// ---------------------------------------------------------------------------
// E. contact address
// ---------------------------------------------------------------------------

test('no contact address is exposed when none is configured', async ({ page }) => {
  await freshVisit(page, '/submit/');
  // No address of any shape, and no mail link to carry one.
  await expect(page.locator('body')).not.toContainText(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);

  await page.getByTestId('feedback-open').click();
  await expect(page.getByTestId('feedback-panel')).toContainText(/No contact address is configured/i);
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
});

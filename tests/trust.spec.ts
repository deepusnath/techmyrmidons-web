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
  const routes = ['/frontend/', '/frontend/current/', '/frontend/historical/', '/frontend/tools/tailwind/'];
  if (!PRODUCTION_MODE) routes.push('/review/');
  for (const route of routes) {
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
  test.skip(PRODUCTION_MODE, 'review routes are excluded from production builds entirely');
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
  test.skip(PRODUCTION_MODE, 'production withholds the rules entirely; covered by the gating test');
  await freshVisit(page, '/me/');
  await expect(page.getByTestId('needs-context')).toBeVisible();
  await expect(page.getByTestId('assessment')).toBeVisible();
  // Nothing is recommended before context exists.
  await expect(page.getByTestId('suggestions')).toHaveCount(0);
});

test('an empty category alone never triggers a recommendation', async ({ page }) => {
  test.skip(PRODUCTION_MODE, 'the diagnosis does not run in production; gating is covered separately');
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
  test.skip(PRODUCTION_MODE, 'the diagnosis does not run in production; gating is covered separately');
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
  test.skip(PRODUCTION_MODE, 'the diagnosis does not run in production; gating is covered separately');
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

// ---------------------------------------------------------------------------
// Phase 2.5.1 — gating, learner journey, redundancy
// ---------------------------------------------------------------------------

test('production runs the diagnosis on reviewed rules only', async ({ page }) => {
  test.skip(!PRODUCTION_MODE, 'production-mode assertion');
  await freshVisit(page, '/me/');

  // Until 2026-08-06 nothing was publishable and the whole diagnosis was
  // withheld. Six TypeScript rules now publish, so the diagnosis runs — but
  // only on those six. Every unreviewed rule must still be absent.
  const body = page.locator('body');
  await expect(body).not.toContainText(/The bundler now owns the dependency graph/i);
  await expect(body).not.toContainText(/A working stylesheet is an asset/i);

  // The user's own marked tools are their data and must survive. The diagnosis
  // now runs, so the snapshot appears after the assessment rather than beside a
  // withheld notice.
  await page.goto(p('/frontend/tools/gulp/'));
  await page.getByTestId('state-using').click();
  await completeAssessment(page, 'apps', 'stay_current');
  await expect(page.getByTestId('snapshot-item-gulp')).toBeVisible();

  // Withholding happens at the server boundary, not by hiding in the client:
  // anything passed to a client component ships in the page source.
  const source = await page.content();
  expect(source).not.toContain('bundler now owns the dependency graph');
  expect(source).not.toContain('A working stylesheet is an asset');
  expect(source).not.toContain('legacy.reconsider.gulp');
  expect(source).not.toContain('content.recommend.astro');
});

test('preview labels the whole diagnosis, not only the recommendations', async ({ page }) => {
  test.skip(PRODUCTION_MODE, 'preview-mode assertion');
  await freshVisit(page, '/me/');
  await completeAssessment(page, 'legacy', 'modernize', [['gulp', 'using'], ['sass', 'using']]);

  const notice = page.getByTestId('diagnosis-draft-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(/what remains appropriate/i);
  await expect(notice).toContainText(/what may deserve reconsideration/i);
  await expect(notice).toContainText(/worth exploring next/i);

  // It sits above all three sections.
  const noticeBox = await notice.boundingBox();
  const appropriateBox = await page.getByTestId('still-appropriate').boundingBox();
  expect(noticeBox!.y).toBeLessThan(appropriateBox!.y);
});

test('learner: baseline is required, then the diagnosis suits that level', async ({ page }) => {
  test.skip(PRODUCTION_MODE, 'preview-mode assertion');
  await freshVisit(page, '/me/');

  await page.getByTestId('work-learning').click();
  await page.getByTestId('goal-skill_gaps').click();

  // Work + goal are not enough for a learner with nothing marked.
  await expect(page.getByTestId('baseline-question')).toBeVisible();
  await expect(page.getByTestId('assessment-done')).toBeDisabled();

  // A beginner must not be handed an application toolchain.
  await page.getByTestId('baseline-new_to_web').click();
  await page.getByTestId('assessment-done').click();

  const suggestions = page.getByTestId('suggestions');
  await expect(suggestions).toBeVisible();
  await expect(page.getByTestId('suggestion-typescript')).toHaveCount(0);
  await expect(page.getByTestId('suggestion-react')).toHaveCount(0);
  await expect(page.getByTestId('suggestion-vite')).toHaveCount(0);

  // Recommending nothing is an acceptable and honest answer here.
  await expect(suggestions).toContainText(/No tool is worth recommending to you yet/i);
  await expect(suggestions).toContainText(/new to HTML, CSS and JavaScript/i);
  const shown = await suggestions.locator('[data-testid^="suggestion-"]').count();
  expect(shown).toBe(0);

  // A more advanced learner gets different, level-appropriate answers.
  await page.getByTestId('edit-assessment').click();
  await page.getByTestId('baseline-built_app').click();
  await page.getByTestId('assessment-done').click();
  await expect(page.getByTestId('suggestion-typescript')).toBeVisible();
});

test('recommendations are not internally contradictory', async ({ page }) => {
  test.skip(PRODUCTION_MODE, 'preview-mode assertion');
  await freshVisit(page, '/me/');
  await completeAssessment(page, 'content', 'new_stack');

  // Astro brings its own build. Recommending Vite alongside it as a separate
  // priority contradicts Vite's own stated "not for you if".
  await expect(page.getByTestId('suggestion-astro')).toBeVisible();
  await expect(page.getByTestId('suggestion-vite')).toHaveCount(0);
});

test('archive years keep sourced events but withhold new narrative in production', async ({ page }) => {
  test.skip(!PRODUCTION_MODE, 'production-mode assertion');
  await freshVisit(page, '/frontend/historical/');

  // Factual heading, no interpretive prose.
  await expect(page.getByTestId('factual-heading-2017')).toContainText(
    /Tools first included in TechMyrmidons in 2017/i,
  );
  const body = page.locator('body');
  await expect(body).not.toContainText(/preserved unedited/i);
  await expect(body).not.toContainText(/what a well-informed frontend developer used/i);

  // The sourced events themselves survive, because they are verifiable.
  await expect(page.getByTestId('year-2017').getByTestId(/^event-/).first()).toHaveAttribute(
    'data-claim-status',
    'sourced',
  );
  // AI interpretations do not.
  await expect(page.locator('[data-claim-status="ai_draft"]')).toHaveCount(0);
});

test('AngularJS end-of-life cites a primary source, not an AI reading', async ({ page }) => {
  await freshVisit(page, '/frontend/historical/');
  const eol = page.getByTestId('year-2021').getByTestId('event-angularjs');
  await expect(eol).toHaveAttribute('data-event-type', 'reached_end_of_life');
  await expect(eol).toHaveAttribute('data-claim-status', 'sourced');
  await expect(eol).toContainText(/official source/i);
  await expect(eol.getByRole('link', { name: /source/i })).toHaveAttribute('href', /angularjs\.org/);
});

// ---------------------------------------------------------------------------
// Phase 2.6 — editorial evidence and review preparation
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Review status vs publication eligibility
// ---------------------------------------------------------------------------

test('review queue distinguishes unreviewed, reviewed-blocked and publishable', async ({ page }) => {
  test.skip(PRODUCTION_MODE, 'review routes are excluded from production builds entirely');
  await freshVisit(page, '/review/priority/');

  await expect(page.getByTestId('rules-reviewed')).toHaveText('6');
  await expect(page.getByTestId('rules-blocked')).toHaveText('0');
  await expect(page.getByTestId('rules-publishable')).toHaveText('6');

  const apps = page.getByTestId('journey-apps');
  await apps.locator('summary').click();

  // The six TypeScript rules now read as publishable: reviewed, and with a
  // reviewed destination to send the reader to.
  const publishable = apps.locator('[data-rule-state="publishable"]');
  expect(await publishable.count()).toBeGreaterThan(0);

  // An unrelated rule in the same journey stays plainly unreviewed — approving
  // TypeScript released nothing else.
  await expect(apps.locator('[data-rule-state="unreviewed"]').first()).toContainText(/unreviewed/);
  await expect(apps.locator('[data-rule-state="reviewed-blocked"]')).toHaveCount(0);
});

test('production publishes reviewed rule text and withholds the rest', async ({ page }) => {
  test.skip(!PRODUCTION_MODE, 'production-mode assertion');
  await freshVisit(page, '/me/');
  const source = await page.content();

  // The six reviewed TypeScript rules publish, carrying their reviewer's name:
  // attribution is the point of reviewing, not a leak.
  expect(source).toContain('Retain TypeScript when the application already depends');
  expect(source).toContain('Deepu S Nath');

  // Every rule that is not reviewed stays out, wording and identifier alike.
  expect(source).not.toContain('bundler now owns the dependency graph');
  expect(source).not.toContain('A working stylesheet is an asset');
  expect(source).not.toContain('clearest example of a shift');
  expect(source).not.toContain('legacy.reconsider.gulp');
  expect(source).not.toContain('content.recommend.astro');

  // And approving the rules did not approve the rest of the tool card.
  expect(source).not.toContain('TypeScript stopped being a choice somewhere around 2020');
  expect(source).not.toContain('Any codebase more than one person maintains');
});

test('preview still shows draft material with correct labelling', async ({ page }) => {
  test.skip(PRODUCTION_MODE, 'preview-mode assertion');
  await freshVisit(page, '/me/');
  await completeAssessment(page, 'apps', 'stay_current', [['react', 'using']]);

  // Preview renders everything, still labelled as unreviewed overall.
  await expect(page.getByTestId('diagnosis-draft-notice')).toBeVisible();
  await expect(page.getByTestId('suggestions')).toBeVisible();

  // The reviewed TypeScript wording is the version approved on 2026-07-31.
  await expect(page.getByTestId('suggestion-typescript')).toContainText(
    /editor-assisted navigation, rename operations, and reference checking/i,
  );
  await expect(page.getByTestId('suggestion-typescript')).not.toContainText(
    /pay for themselves on refactoring and editor tooling long before/i,
  );
});

test('deferred lifecycle stays withheld on the TypeScript tool page', async ({ page }) => {
  await freshVisit(page, '/frontend/tools/typescript/');
  await expect(page.getByTestId('review-chip-draft').first()).toBeVisible();
  await expect(page.getByTestId('review-chip-reviewed')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/Reviewed by Deepu S Nath/i);
});

test('priority review queue shows evidence and records nothing as reviewed', async ({ page }) => {
  test.skip(PRODUCTION_MODE, 'review routes are excluded from production builds entirely');
  await freshVisit(page, '/review/priority/');

  await expect(page.getByRole('heading', { name: /Priority editorial review/i })).toBeVisible();
  await expect(page.getByText(/Nothing here is applied/i)).toBeVisible();

  const dossier = page.getByTestId('dossier');
  await expect(dossier).toBeVisible();

  // Facts, interpretation and gaps are shown as three distinct things.
  await expect(dossier).toContainText(/Verifiable facts/i);
  await expect(dossier).toContainText(/Editorial interpretation — NOT established by the source/i);
  await expect(dossier).toContainText(/Evidence gaps/i);
  await expect(dossier).toContainText(/would be wrong if/i);

  // The queue is ordered by leverage: the most depended-on tool comes first.
  await expect(dossier).toHaveAttribute('data-slug', 'typescript');

  // Nothing may present itself as reviewed.
  await expect(page.locator('body')).not.toContainText(/Reviewed by /i);
  await expect(page.locator('body')).not.toContainText('Deepu S Nath');
});

test('a reviewer decision stays local and changes no published claim', async ({ page }) => {
  test.skip(PRODUCTION_MODE, 'review routes are excluded from production builds entirely');
  await freshVisit(page, '/review/priority/');

  // An approval cannot be recorded anonymously.
  await expect(page.getByTestId('action-approve')).toBeDisabled();
  await page.getByTestId('reviewer-name').fill('Test Reviewer');
  await expect(page.getByTestId('action-approve')).toBeEnabled();

  await page.getByTestId('review-note').fill('Verified against the official docs.');
  await page.getByTestId('action-approve').click();

  await expect(page.getByTestId('decision-recorded')).toContainText(/not.*changed any published claim/i);
  await expect(page.getByTestId('review-export')).toBeVisible();

  // The tool page must be unaffected — still unreviewed.
  await page.goto(p('/frontend/tools/typescript/'));
  await expect(page.getByTestId('review-chip-draft').first()).toBeVisible();
  await expect(page.getByTestId('review-chip-reviewed')).toHaveCount(0);
});

test('readiness reports blockers without a score or meter', async ({ page }) => {
  test.skip(PRODUCTION_MODE, 'review routes are excluded from production builds entirely');
  await freshVisit(page, '/review/priority/');

  // Readiness is per journey. The four journeys carrying a TypeScript rule are
  // now partly available; "content" has none, so it stays fully blocked — which
  // is what shows the approval released only what it should.
  await expect(page.getByTestId('readiness-legacy')).toContainText(/partly available/i);
  await expect(page.getByTestId('readiness-design_systems')).toContainText(/partly available/i);
  await expect(page.getByTestId('readiness-content')).toContainText(/fully blocked/i);
  // TypeScript is done, so the recommendation has moved on to the next tool
  // carrying the most still-blocked rules.
  await expect(page.getByTestId('highest-leverage')).toContainText(/tailwind/i);

  const body = page.locator('body');
  await expect(body).not.toContainText(/\b\d{1,3}\s?%\s*(complete|reviewed|ready)/i);
  await expect(page.locator('progress, meter, [role="progressbar"]')).toHaveCount(0);
});

test('journey dependency map exposes rule-level review status', async ({ page }) => {
  test.skip(PRODUCTION_MODE, 'review routes are excluded from production builds entirely');
  await freshVisit(page, '/review/priority/');
  const journey = page.getByTestId('journey-legacy');
  await journey.locator('summary').click();
  await expect(journey).toContainText('legacy.recommend.vite');
  await expect(journey).toContainText('legacy.reconsider.gulp');
  await expect(journey).toContainText(/\[unreviewed\]/);
});

test('production ships only the rule text that has been reviewed', async ({ page }) => {
  test.skip(!PRODUCTION_MODE, 'production-mode assertion');
  await freshVisit(page, '/me/');

  const source = await page.content();
  // 6 of 56 rules are reviewed. The other 50 must be absent — checked by their
  // wording rather than by rule_id, since the six that publish legitimately
  // carry identifiers now.
  expect(source).not.toContain('bundler now owns the dependency graph');
  expect(source).not.toContain('A working stylesheet is an asset');
  expect(source).not.toContain('clearest example of a shift');
  expect(source).not.toContain('legacy.reconsider.gulp');
  expect(source).not.toContain('content.recommend.astro');
});

import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Review routes are internal editorial tooling. They render withheld dossier
 * bodies, unreviewed rule wording, decision logs and reviewer names in full.
 *
 * In a production build they must not exist — not hidden, not unlinked, not
 * disallowed by robots: absent. These tests assert both halves: the workflow
 * works in preview, and production emits nothing.
 */

const PREFIX = process.env.BASE_PREFIX ?? '';
const p = (route: string) => `${PREFIX}${route}`;
const PRODUCTION_MODE = process.env.DRAFTS_HIDDEN === '1';
const OUT = path.join(process.cwd(), 'out');

async function freshVisit(page: Page, route: string) {
  await page.goto(p(route));
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(p(route));
}

/** Every file in the static export, for artifact-level assertions. */
function allOutputFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(OUT);
  return out;
}

// --- 1. preview: the full workflow is present and works --------------------

test('preview serves the review inventory and priority queue', async ({ page }) => {
  test.skip(PRODUCTION_MODE, 'preview-mode assertion');

  await freshVisit(page, '/review/');
  await expect(page.getByRole('heading', { name: /Editorial review inventory/i })).toBeVisible();
  await expect(page.getByTestId('priority-link')).toBeVisible();

  await freshVisit(page, '/review/priority/');
  await expect(page.getByRole('heading', { name: /Priority editorial review/i })).toBeVisible();
  await expect(page.getByTestId('dossier')).toBeVisible();

  // The reviewer workflow itself still functions.
  await expect(page.getByTestId('action-approve')).toBeDisabled();
  await page.getByTestId('reviewer-name').fill('Test Reviewer');
  await page.getByTestId('action-approve').click();
  await expect(page.getByTestId('decision-recorded')).toBeVisible();
  await expect(page.getByTestId('review-export')).toBeVisible();
});

test('preview shows all three review states', async ({ page }) => {
  test.skip(PRODUCTION_MODE, 'preview-mode assertion');
  await freshVisit(page, '/review/priority/');

  await expect(page.getByTestId('rules-reviewed')).toHaveText('6');
  await expect(page.getByTestId('rules-blocked')).toHaveText('6');
  await expect(page.getByTestId('rules-publishable')).toHaveText('0');

  const apps = page.getByTestId('journey-apps');
  await apps.locator('summary').click();
  expect(await apps.locator('[data-rule-state="reviewed-blocked"]').count()).toBeGreaterThan(0);
  expect(await apps.locator('[data-rule-state="unreviewed"]').count()).toBeGreaterThan(0);
  await expect(apps.locator('[data-rule-state="publishable"]')).toHaveCount(0);
});

// --- 2, 3. production: the routes do not exist ------------------------------

test('production emits no review route files', async () => {
  test.skip(!PRODUCTION_MODE, 'production-mode assertion');
  const offenders = allOutputFiles().filter((f) => f.includes('review'));
  expect(offenders.map((f) => path.relative(OUT, f))).toEqual([]);
});

test('production requests for review routes do not return their content', async ({ page, baseURL }) => {
  test.skip(!PRODUCTION_MODE, 'production-mode assertion');
  const origin = new URL(baseURL ?? 'http://localhost:3100').origin;

  for (const route of ['/review/', '/review/priority/', '/review/index.html', '/review/priority/index.txt']) {
    const res = await page.request.get(`${origin}${PREFIX}${route}`);
    const body = res.status() < 400 ? await res.text() : '';
    // A 404 page may be served; what must never come back is the review content.
    expect(body, `${route} must not return review content`).not.toContain('Editorial review inventory');
    expect(body, `${route} must not return review content`).not.toContain('Priority editorial review');
    expect(body, `${route} must not return review content`).not.toContain('Verifiable facts');
  }
});

// --- 4. no review URLs anywhere in production output ------------------------

test('production output contains no review-route URL', async () => {
  test.skip(!PRODUCTION_MODE, 'production-mode assertion');
  const hits: string[] = [];
  for (const f of allOutputFiles()) {
    if (/\.(png|jpe?g|gif|woff2?|ico)$/i.test(f)) continue;
    if (fs.readFileSync(f, 'utf8').includes('/review')) hits.push(path.relative(OUT, f));
  }
  expect(hits, 'no navigation, manifest, index or bundle may reference a review route').toEqual([]);
});

// --- 5. withheld editorial does not leak through any production surface -----

test('withheld dossier bodies, rule text, decision logs and reviewer names do not leak', async () => {
  test.skip(!PRODUCTION_MODE, 'production-mode assertion');

  const forbidden = [
    // dossier bodies
    'Verifiable facts', 'Editorial interpretation', 'verifiable_facts', 'wrong_if', 'evidence_gaps',
    // decision log
    'decision_log', 'approve_with_edits',
    // AI-drafted rule text
    'bundler now owns the dependency graph', 'A working stylesheet is an asset',
    'clearest example of a shift',
    // reviewed-but-blocked TypeScript wording
    'Retain TypeScript when the application already depends',
    'editor-assisted navigation, rename operations',
    'treated as a migration project',
    // reviewer identity
    'Deepu S Nath',
  ];

  // Rule IDENTIFIERS must not appear as values. The property names `rule_id`
  // and `still_appropriate` legitimately ship inside the compiled diagnosis
  // code — the diagnosis runs client-side — so they are checked as values here
  // rather than banned as substrings, which would fail on the algorithm itself.
  const forbiddenRuleIds = [
    'apps.retain.typescript', 'design_systems.retain.typescript',
    'apps.recommend.typescript', 'legacy.recommend.typescript',
    'design_systems.recommend.typescript', 'learning.recommend.typescript',
    'legacy.reconsider.gulp', 'content.recommend.astro',
  ];
  forbidden.push(...forbiddenRuleIds);

  const leaks: Array<{ file: string; phrase: string }> = [];
  for (const f of allOutputFiles()) {
    if (/\.(png|jpe?g|gif|woff2?|ico)$/i.test(f)) continue;
    const text = fs.readFileSync(f, 'utf8');
    for (const phrase of forbidden) {
      if (text.includes(phrase)) leaks.push({ file: path.relative(OUT, f), phrase });
    }
  }
  expect(leaks).toEqual([]);
});

// --- 6. the six decisions survive, recorded but not publishable -------------

test('six TypeScript rules remain recorded and non-publishable', async () => {
  const h = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content/heuristics/frontend.json'), 'utf8'));
  const tool = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content/tools/frontend/typescript.json'), 'utf8'));

  const ts = [
    h.contexts.apps.still_appropriate.typescript,
    h.contexts.design_systems.still_appropriate.typescript,
    ...['apps', 'legacy', 'design_systems', 'learning'].map((c: string) =>
      h.contexts[c].candidates.find((x: { slug: string }) => x.slug === 'typescript')),
  ];

  expect(ts).toHaveLength(6);
  expect(ts.every((r) => r.editorial_status === 'reviewed')).toBe(true);
  expect(ts.every((r) => r.reviewed_by === 'Deepu S Nath')).toBe(true);
  expect(ts.every((r) => r.reviewed_at === '2026-07-31')).toBe(true);

  // Non-publishable because the destination is unreviewed.
  expect(tool.editorial_status).toBe('ai_draft');
  expect(tool.reviewed_fields).toEqual([]);
});

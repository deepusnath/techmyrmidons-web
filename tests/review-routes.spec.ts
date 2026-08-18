import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_FORBIDDEN } from '../scripts/withheld-editorial.ts';
import { getReadiness } from '../lib/review.ts';

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

/**
 * The review workstation renders a section per active domain, so a bare testid
 * matches once per Myrmidon. Tests scope to the domain they are asserting about.
 */
const priorityOf = (page: Page, domain = 'frontend') => page.getByTestId(`priority-${domain}`);
const inventoryOf = (page: Page, domain = 'frontend') => page.getByTestId(`inventory-${domain}`);

/**
 * Every file in the static export, for artifact-level assertions.
 *
 * `.git` is not part of the export. scripts/deploy-pages.sh builds a throwaway
 * repo inside out/ to push to gh-pages, and its reflog records the committer's
 * name — one of the reviewer identities asserted against below. It is never
 * published (`git add -A` cannot stage the .git it lives in), so skipping it
 * here fails no real leak.
 */
function allOutputFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '.git') continue;
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
  await expect(page.getByRole('heading', { name: /Editorial review inventory/i }).first()).toBeVisible();
  await expect(inventoryOf(page).getByTestId('priority-link')).toBeVisible();

  await freshVisit(page, '/review/priority/');
  await expect(page.getByRole('heading', { name: /Priority editorial review/i }).first()).toBeVisible();
  await expect(priorityOf(page).getByTestId('dossier')).toBeVisible();

  // The reviewer workflow itself still functions.
  await expect(priorityOf(page).getByTestId('action-approve')).toBeDisabled();
  await priorityOf(page).getByTestId('reviewer-name').fill('Test Reviewer');
  await priorityOf(page).getByTestId('action-approve').click();
  await expect(priorityOf(page).getByTestId('decision-recorded')).toBeVisible();
  await expect(priorityOf(page).getByTestId('review-export')).toBeVisible();
});

test('preview shows all three review states', async ({ page }) => {
  test.skip(PRODUCTION_MODE, 'preview-mode assertion');
  await freshVisit(page, '/review/priority/');

  // The workstation's numbers must agree with the same computation the page
  // uses — pinning literals here turned every review batch into a test edit.
  const r = getReadiness('frontend');
  await expect(priorityOf(page).getByTestId('rules-reviewed')).toHaveText(String(r.rulesReviewed));
  await expect(priorityOf(page).getByTestId('rules-blocked')).toHaveText(String(r.rulesReviewedButBlocked));
  await expect(priorityOf(page).getByTestId('rules-publishable')).toHaveText(String(r.rulesPublishable));

  const apps = priorityOf(page).getByTestId('journey-apps');
  await apps.locator('summary').click();
  expect(await apps.locator('[data-rule-state="publishable"]').count()).toBeGreaterThan(0);
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

  // ALL_FORBIDDEN covers withheld prose plus the rule IDENTIFIERS. The latter
  // are checked as values, not banned as substrings: the property names
  // `rule_id` and `still_appropriate` legitimately ship inside the compiled
  // diagnosis, which runs client-side.
  const leaks: Array<{ file: string; phrase: string }> = [];
  for (const f of allOutputFiles()) {
    if (/\.(png|jpe?g|gif|woff2?|ico)$/i.test(f)) continue;
    const text = fs.readFileSync(f, 'utf8');
    for (const phrase of ALL_FORBIDDEN) {
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

  // The destination was approved field by field on 2026-08-06, which lifted the
  // publication block. Crucially it was NOT approved by marking the whole record
  // reviewed: everything else on the card stays unreviewed and withheld.
  expect(tool.editorial_status).toBe('ai_draft');
  expect(tool.reviewed_fields).toEqual(['one_liner', 'what_it_is']);
  expect(tool.reviewed_by).toBe('Deepu S Nath');
  expect(tool.reviewed_at).toBe('2026-08-06');
  for (const deferred of ['lifecycle', 'why_it_matters', 'suitable_for', 'not_suitable_for', 'alternatives']) {
    expect(tool.reviewed_fields).not.toContain(deferred);
  }
});

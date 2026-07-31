import { expect, test, type Page } from '@playwright/test';

/**
 * Internal-link integrity.
 *
 * Crawls every reachable page and resolves every internal link. This exists
 * because a single raw <a href="/…"> in the timeline silently dropped the
 * GitHub Pages base path and 404'd in production while passing every other
 * test — a class of bug only a crawl catches.
 *
 * Runs against the local static export by default, and against the deployed
 * preview with BASE_URL / BASE_PREFIX.
 */

const PREFIX = process.env.BASE_PREFIX ?? '';
const START = `${PREFIX}/`;

/** Pages whose links we follow. Everything else is checked but not expanded. */
const MAX_PAGES = 120;

interface LinkRef {
  href: string;
  from: string;
  text: string;
}

async function linksOn(page: Page): Promise<LinkRef[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]')).map((a) => ({
      href: (a as HTMLAnchorElement).getAttribute('href') ?? '',
      from: location.pathname,
      text: (a.textContent ?? '').trim().slice(0, 40),
    })),
  );
}

test('every internal link resolves and stays within the deployment base path', async ({ page, baseURL }) => {
  test.setTimeout(180_000);

  const origin = new URL(baseURL ?? 'http://localhost:3100').origin;
  const visited = new Set<string>();
  const queue: string[] = [START];
  const allInternal = new Map<string, LinkRef>();
  const broken: Array<{ href: string; from: string; status: number | string }> = [];
  const escaped: LinkRef[] = [];

  while (queue.length && visited.size < MAX_PAGES) {
    const path = queue.shift()!;
    if (visited.has(path)) continue;
    visited.add(path);

    const res = await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' });
    const status = res?.status() ?? 0;
    if (status >= 400) {
      broken.push({ href: path, from: '(crawl)', status });
      continue;
    }

    for (const link of await linksOn(page)) {
      const raw = link.href;
      if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) continue;

      // External links are out of scope — this test is about internal routing.
      if (/^https?:\/\//i.test(raw) && !raw.startsWith(origin)) continue;

      const resolved = new URL(raw, `${origin}${path}`);
      if (resolved.origin !== origin) continue;

      const target = resolved.pathname;
      allInternal.set(target, link);

      // The core assertion: an internal link must never fall outside the
      // configured base path. That is precisely how the timeline links broke.
      if (PREFIX && !target.startsWith(PREFIX)) {
        escaped.push({ ...link, href: target });
        continue;
      }

      if (!visited.has(target) && !queue.includes(target)) queue.push(target);
    }
  }

  // Verify every discovered internal target actually resolves.
  for (const [target, ref] of allInternal) {
    if (PREFIX && !target.startsWith(PREFIX)) continue; // already reported
    const res = await page.request.get(`${origin}${target}`);
    if (res.status() >= 400) {
      broken.push({ href: target, from: ref.from, status: res.status() });
    }
  }

  console.log(
    `\ninternal-link crawl: ${visited.size} pages visited, ${allInternal.size} unique internal links checked` +
      (PREFIX ? ` (base path "${PREFIX}")` : ' (served at root)'),
  );

  if (escaped.length) {
    console.log('links escaping the base path:');
    for (const e of escaped) console.log(`  ${e.from} → ${e.href}  ("${e.text}")`);
  }
  if (broken.length) {
    console.log('broken links:');
    for (const b of broken) console.log(`  ${b.from} → ${b.href}  [${b.status}]`);
  }

  expect(escaped, 'internal links must stay within the base path').toEqual([]);
  expect(broken, 'no internal link may 404').toEqual([]);

  // Sanity: the crawl must actually have covered the app, not stopped at page 1.
  expect(visited.size).toBeGreaterThan(20);
  expect(allInternal.size).toBeGreaterThan(20);
});

test('timeline event links specifically resolve under the base path', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? 'http://localhost:3100').origin;
  await page.goto(`${origin}${PREFIX}/frontend/historical/`);

  const eventLinks = page.locator('[data-testid^="event-"] a[href]:not([target="_blank"])');
  const count = await eventLinks.count();
  expect(count, 'historical view should expose timeline event links').toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const href = await eventLinks.nth(i).getAttribute('href');
    expect(href, 'event link must carry the base path').toContain(`${PREFIX}/frontend/tools/`);
    const res = await page.request.get(`${origin}${href}`);
    expect(res.status(), `${href} should resolve`).toBeLessThan(400);
  }
});

#!/usr/bin/env node
/**
 * Import phase0/backfill.ts output as `observed`-tier signals.
 *
 * This is the ONE job repository-manifest tracking is actually good at:
 * attaching checkable, commit-dated evidence to tools that already exist in the
 * catalogue. It is not a source of truth for what belongs in the catalogue, and
 * it deliberately cannot create tools — a tool it observes but that no editor
 * has written about is reported as a gap for a human to consider, never
 * silently published.
 *
 * Observed signals land in content/observed/ rather than content/signals/ so
 * that re-running migrate-archive.ts (which regenerates signals/) cannot
 * destroy them.
 *
 * Prerequisite:
 *   GITHUB_TOKEN=ghp_xxx node phase0/backfill.ts
 *
 * Usage:
 *   node scripts/import-observed.ts [--domain frontend]
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { slugify, type Signal } from '../content/schema.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OBSERVATIONS = path.join(ROOT, 'phase0', 'out', 'observations.csv');
const COHORT = path.join(ROOT, 'phase0', 'cohort.json');

const domainArg = process.argv.indexOf('--domain');
const DOMAIN = domainArg === -1 ? 'frontend' : process.argv[domainArg + 1];

/**
 * backfill.ts canonicalises to npm package names; the catalogue uses editorial
 * slugs. Only genuine mismatches need listing — most names already agree.
 */
const PACKAGE_TO_SLUG: Record<string, string> = {
  next: 'nextjs',
  '@tanstack/react-query': 'tanstack-query',
  '@tanstack/query-core': 'tanstack-query',
  'react-query': 'tanstack-query',
  '@biomejs/biome': 'biome',
  'bootstrap': 'bootstrap',
  'node-sass': 'sass',
  '@playwright/test': 'playwright',
  'vue': 'vue',
  'svelte': 'svelte',
  '@angular/core': 'angular',
};

function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }

  const [header, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

async function main() {
  if (!existsSync(OBSERVATIONS)) {
    console.error(`No observations found at ${path.relative(ROOT, OBSERVATIONS)}.\n`);
    console.error('Run the backfill first (it needs a GitHub token):\n');
    console.error('  GITHUB_TOKEN=ghp_xxx node phase0/backfill.ts\n');
    process.exit(1);
  }

  // login -> practitioner slug, via the cohort file the backfill was run against
  const cohort = JSON.parse(await readFile(COHORT, 'utf8')) as {
    members: Array<{ name: string; github: string }>;
  };
  const loginToSlug = new Map(cohort.members.map((m) => [m.github.toLowerCase(), slugify(m.name)]));

  const toolDir = path.join(ROOT, 'content', 'tools', DOMAIN);
  const knownSlugs = new Set(
    (existsSync(toolDir) ? await readdir(toolDir) : []).map((f) => f.replace(/\.json$/, '')),
  );

  const observations = parseCsv(await readFile(OBSERVATIONS, 'utf8'));
  const signals: Signal[] = [];
  const unmapped = new Map<string, number>();
  let skippedUnknownTool = 0;

  for (const o of observations) {
    const slug = PACKAGE_TO_SLUG[o.tool] ?? slugify(o.tool);

    if (!knownSlugs.has(slug)) {
      // A tool the cohort demonstrably uses that the catalogue does not cover.
      // This is a gap report for an editor, not something to auto-publish.
      unmapped.set(o.tool, (unmapped.get(o.tool) ?? 0) + 1);
      skippedUnknownTool++;
      continue;
    }

    const actor = loginToSlug.get((o.github ?? '').toLowerCase()) ?? null;
    const verb = o.action === 'removed' ? 'was removed from' : 'was added to';
    signals.push({
      id: `${DOMAIN}:${slug}:observed:${o.sha.slice(0, 10)}:${o.action}`,
      tool_slug: slug,
      domain: DOMAIN,
      tier: 'observed',
      source_url: `https://github.com/${o.repo}/commit/${o.sha}`,
      // A literal statement about a file. It must not read as a claim that a
      // person uses, prefers, adopted or abandoned anything — a dependency edit
      // in a public repo supports no such conclusion.
      source_label: `${o.tool} ${verb} ${o.manifest_path || 'a manifest'} in ${o.repo}`,
      observed_at: o.observed_at,
      actor_type: 'practitioner',
      actor_id: actor,
      note: null,
      confidence: 'high',
      repo: o.repo,
      manifest_path: o.manifest_path || null,
      action: o.action === 'removed' ? 'removed' : 'added',
      // Never inferred. A repository's role cannot be established from the API,
      // and guessing it is how a dotfiles commit becomes a "trend".
      context_status: 'unknown',
      // Repository signals are inert until a human reviews the repo context.
      eligible_for_trends: false,
      is_seed: false,
      seed_source: null,
    });
  }

  // Deduplicate — the same commit can legitimately appear once per repo scanned.
  const byId = new Map(signals.map((s) => [s.id, s]));
  const deduped = [...byId.values()].sort((a, b) => a.observed_at.localeCompare(b.observed_at));

  const outDir = path.join(ROOT, 'content', 'observed');
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, `${DOMAIN}.json`), JSON.stringify(deduped, null, 2) + '\n');

  console.error(`imported ${deduped.length} observed signals for "${DOMAIN}"`);
  console.error(`skipped ${skippedUnknownTool} observations for tools not in the catalogue`);

  if (unmapped.size) {
    const top = [...unmapped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    console.error(`\nCatalogue gaps — observed in cohort repos but not covered (top ${top.length}):`);
    for (const [tool, count] of top) {
      console.error(`  ${String(count).padStart(4)}x  ${tool}`);
    }
    console.error('\nThese are candidates for an editor to consider. Nothing is published automatically.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

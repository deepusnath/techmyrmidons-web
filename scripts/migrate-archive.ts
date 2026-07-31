#!/usr/bin/env node
/**
 * Migrate the 2016-2021 hand-curated JSON archive into the new content model.
 *
 * Two principles govern this script:
 *
 *  1. Nothing is invented. Where the archive is broken, empty, or duplicated,
 *     that fact is recorded rather than papered over. Domains keep an honest
 *     `archived_reason` and `last_curated_year` that users will actually see.
 *
 *  2. Nothing imported is publishable. Every archive tool lands with
 *     `published: false` and `is_seed: true`. The archive can populate the
 *     Historical view immediately, but a tool cannot appear as a current
 *     recommendation until an editor has authored why it matters and, crucially,
 *     where it does not fit.
 *
 * Usage:  node scripts/migrate-archive.ts [--dry]
 */

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  slugify,
  toolKey,
  type Domain,
  type Practitioner,
  type Resource,
  type Signal,
  type Tool,
} from '../content/schema.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'src', 'data');
const OUT = path.join(ROOT, 'content');
const DRY = process.argv.includes('--dry');

/** The one domain the pilot activates. Everything else is preserved, archived. */
const ACTIVE_DOMAIN = 'frontend';

/**
 * Domain-specific archive caveats. These are shown to users verbatim, so they
 * state what is actually wrong rather than a generic "not maintained".
 */
const ARCHIVE_CAVEATS: Record<string, string> = {
  'quantum-computing':
    'The practitioner list for this domain duplicates the Android list (Andy Rubin, Gina Trapani and others) and was never curated for quantum computing.',
  'actions-on-google': 'No content was ever added to this domain.',
  biotech:
    'Only two practitioners were ever listed, one of them a placeholder ("The mystery guru"), and the 2021 file was empty.',
  arvr: 'The 2020 and 2021 files are byte-identical copies of 2019; no new curation happened after 2019.',
};

type ArchiveEntry = { title: string; description?: string; url?: string };

const warnings: string[] = [];
const warn = (msg: string) => {
  warnings.push(msg);
  console.error(`  ! ${msg}`);
};

// ---------------------------------------------------------------------------

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const text = await readFile(file, 'utf8');
    if (!text.trim()) {
      warn(`${path.relative(ROOT, file)} is empty — recorded as missing, not invented`);
      return null;
    }
    return JSON.parse(text) as T;
  } catch (err) {
    warn(`${path.relative(ROOT, file)} did not parse: ${(err as Error).message.slice(0, 70)}`);
    return null;
  }
}

/** Stable fingerprint of a year's entries, used to detect copy-pasted years. */
function fingerprint(entries: ArchiveEntry[]): string {
  return entries
    .map((e) => `${(e.title ?? '').trim()}|${(e.url ?? '').trim()}`)
    .sort()
    .join('\n');
}

async function loadYears(folder: string) {
  const dir = path.join(SRC, folder);
  const files = (await readdir(dir)).filter((f) => /^\d{4}\.json$/.test(f)).sort();

  const years: Array<{ year: number; entries: ArchiveEntry[]; duplicateOf: number | null }> = [];
  let prevPrint: string | null = null;
  let prevYear: number | null = null;

  for (const file of files) {
    const year = Number(file.replace('.json', ''));
    const json = await readJson<Record<string, ArchiveEntry[]>>(path.join(dir, file));
    if (!json) continue;

    const keys = Object.keys(json);
    let entries = json[String(year)];

    // arvr/2020.json and arvr/2021.json carry a "2019" key. Do not rename it —
    // that would assert curation that did not happen. Read it, then let the
    // fingerprint check below mark the year as a duplicate.
    if (!Array.isArray(entries) && keys.length === 1 && Array.isArray(json[keys[0]])) {
      warn(`${folder}/${file} has top-level key "${keys[0]}" rather than "${year}"`);
      entries = json[keys[0]];
    }
    if (!Array.isArray(entries)) {
      warn(`${folder}/${file} has no usable entry array`);
      continue;
    }

    const print = fingerprint(entries);
    const duplicateOf = print === prevPrint ? prevYear : null;
    years.push({ year, entries, duplicateOf });
    prevPrint = print;
    prevYear = year;
  }

  return years;
}

// ---------------------------------------------------------------------------

async function main() {
  console.error(`migrating archive from ${path.relative(ROOT, SRC)}\n`);

  const home = await readJson<{ home: Array<{ technology: string; logo: string; folderName: string }> }>(
    path.join(SRC, 'home.json'),
  );
  const homeByFolder = new Map((home?.home ?? []).map((h) => [h.folderName, h]));

  const folders = (await readdir(SRC, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const domains: Domain[] = [];
  const practitionersBySlug = new Map<string, Practitioner>();
  const toolsByDomain = new Map<string, Tool[]>();
  const signalsByDomain = new Map<string, Signal[]>();
  const resourcesByDomain = new Map<string, Resource[]>();

  for (const folder of folders) {
    const meta = homeByFolder.get(folder);
    const name = meta?.technology ?? folder.replace(/\b\w/g, (c) => c.toUpperCase());
    const domainSlug = slugify(folder);
    console.error(`${folder}`);

    // --- tools + archive signals ------------------------------------------
    const years = await loadYears(folder);
    const realYears = years.filter((y) => y.duplicateOf === null);
    const duplicateYears = years.filter((y) => y.duplicateOf !== null).map((y) => y.year);
    for (const y of years) {
      if (y.duplicateOf !== null) {
        warn(`${folder}/${y.year}.json duplicates ${y.duplicateOf} — no new curation recorded`);
      }
    }

    const tools = new Map<string, Tool>();
    const signals: Signal[] = [];

    for (const { year, entries } of realYears) {
      for (const entry of entries) {
        const title = (entry.title ?? '').trim();
        if (!title) continue;
        const key = toolKey(title);

        let tool: Tool | undefined = tools.get(key);
        if (!tool) {
          tool = {
            slug: key,
            domain: domainSlug,
            name: title,
            category: null,
            homepage: entry.url?.trim() || null,
            one_liner: null,
            // Archive prose is preserved as descriptive text, but never as the
            // authored judgement — why_it_matters stays null until an editor
            // writes it.
            what_it_is: entry.description?.trim() || null,
            why_it_matters: null,
            lifecycle: null,
            first_seen_year: year,
            archive_years: [],
            suitable_for: [],
            not_suitable_for: [],
            alternatives: [],
            published: false,
            // Archive imports are unreviewed by construction.
            editorial_status: 'ai_draft',
            reviewed_by: null,
            reviewed_at: null,
            reviewed_fields: [],
            is_seed: true,
            seed_source: `original curation, src/data/${folder}/${year}.json`,
          };
          tools.set(key, tool);
        }
        if (!tool!.archive_years.includes(year)) tool!.archive_years.push(year);
        if (!entry.url && !tool!.homepage) {
          warn(`${folder}/${year}: "${title}" has no url`);
        }

        signals.push({
          id: `${domainSlug}:${key}:archive:${year}`,
          tool_slug: key,
          domain: domainSlug,
          tier: 'editorial',
          source_url: null,
          source_label: `Original TechMyrmidons curation, ${year}`,
          observed_at: `${year}-01-01`,
          actor_type: 'editor',
          actor_id: null,
          note: null,
          confidence: 'medium',
          repo: null,
          manifest_path: null,
          action: null,
          context_status: 'unknown',
          eligible_for_trends: false,
          is_seed: true,
          seed_source: `src/data/${folder}/${year}.json`,
        });
      }
    }

    toolsByDomain.set(domainSlug, [...tools.values()]);
    signalsByDomain.set(domainSlug, signals);

    // --- practitioners ------------------------------------------------------
    const follow = await readJson<{ follow: Array<{ name: string; photo?: string; followLink?: string }> }>(
      path.join(SRC, folder, 'follow.json'),
    );
    let practitionerCount = 0;
    for (const person of follow?.follow ?? []) {
      const personName = (person.name ?? '').trim();
      if (!personName) continue;
      practitionerCount++;
      const slug = slugify(personName);

      const existing = practitionersBySlug.get(slug);
      if (existing) {
        if (!existing.domains.includes(domainSlug)) existing.domains.push(domainSlug);
        continue;
      }

      let avatar: string | null = null;
      if (person.photo) {
        const source = path.join(SRC, folder, 'images', person.photo);
        if (existsSync(source)) avatar = `/practitioners/${domainSlug}/${person.photo}`;
        else warn(`${folder}: avatar missing on disk for ${personName} (${person.photo})`);
      }

      const link = person.followLink?.trim() ?? '';
      const links: Practitioner['links'] = {};
      if (/github\.com/.test(link)) links.github = link;
      else if (/twitter\.com|x\.com/.test(link)) links.x = link;
      else if (link) links.site = link;

      practitionersBySlug.set(slug, {
        slug,
        name: personName,
        avatar,
        links,
        domains: [domainSlug],
        bio: null,
        is_seed: true,
        seed_source: `original curation, src/data/${folder}/follow.json`,
      });
    }

    // --- resources ----------------------------------------------------------
    const blog = await readJson<{ blog: Array<{ blog: string; author: string }> }>(
      path.join(SRC, folder, 'blog.json'),
    );
    const resources: Resource[] = [];
    for (const item of blog?.blog ?? []) {
      const title = (item.author ?? '').trim();
      const url = (item.blog ?? '').trim();
      if (!title || !url) continue;
      resources.push({
        slug: slugify(title),
        domain: domainSlug,
        title,
        url,
        kind: 'blog',
        is_seed: true,
        seed_source: `original curation, src/data/${folder}/blog.json`,
      });
    }
    resourcesByDomain.set(domainSlug, resources);

    // --- domain record ------------------------------------------------------
    const lastCurated = realYears.length ? Math.max(...realYears.map((y) => y.year)) : null;
    const isActive = domainSlug === ACTIVE_DOMAIN;

    let archivedReason: string | null = null;
    if (!isActive) {
      const caveat = ARCHIVE_CAVEATS[domainSlug];
      const base = lastCurated
        ? `Not maintained since ${lastCurated}.`
        : 'No tool content was ever published for this domain.';
      archivedReason = caveat ? `${base} ${caveat}` : base;
    }

    domains.push({
      slug: domainSlug,
      name,
      status: isActive ? 'active' : 'archived',
      archived_reason: archivedReason,
      last_curated_year: lastCurated,
      logo: meta?.logo ?? null,
      legacy_folder: folder,
      duplicate_years: duplicateYears,
      tool_count: tools.size,
      practitioner_count: practitionerCount,
      is_seed: true,
      seed_source: 'original curation, src/data/home.json',
    });

    console.error(
      `  -> ${tools.size} tools, ${signals.length} signals, ${practitionerCount} practitioners, ${resources.length} resources`,
    );
  }

  if (DRY) {
    console.error('\n--dry: nothing written');
    return;
  }

  // --- write ----------------------------------------------------------------
  // Files are written in place and stale ones pruned individually. Directories
  // are deliberately never deleted and recreated: this repository lives under
  // ~/Documents, which iCloud Drive syncs, and rapidly removing then recreating
  // a synced directory leaves "name 2" conflict copies behind.
  const desired = new Set<string>();

  const write = async (file: string, data: unknown) => {
    desired.add(path.resolve(file));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(data, null, 2) + '\n');
  };

  await write(
    path.join(OUT, 'practitioners.json'),
    [...practitionersBySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
  );

  // Authored cards win over archive imports. An editor who has written a card
  // must never lose it to a re-run, so the seed version is simply not written.
  let toolFiles = 0;
  let preserved = 0;
  for (const [domain, tools] of toolsByDomain) {
    for (const tool of tools) {
      const file = path.join(OUT, 'tools', domain, `${tool.slug}.json`);
      toolFiles++;
      if (existsSync(file)) {
        const existing = JSON.parse(await readFile(file, 'utf8')) as Tool;
        if (existing.published || existing.is_seed === false) {
          desired.add(path.resolve(file));
          preserved++;
          continue;
        }
      }
      await write(file, tool);
    }
  }
  // Purely authored cards have no archive counterpart; keep them too.
  for (const domain of toolsByDomain.keys()) {
    const dir = path.join(OUT, 'tools', domain);
    if (!existsSync(dir)) continue;
    for (const file of await readdir(dir)) {
      const full = path.join(dir, file);
      if (desired.has(path.resolve(full))) continue;
      const existing = JSON.parse(await readFile(full, 'utf8')) as Tool;
      if (existing.published || existing.is_seed === false) {
        desired.add(path.resolve(full));
        preserved++;
      }
    }
  }
  if (preserved) console.error(`\npreserved ${preserved} authored tool file(s) across re-run`);

  for (const [domain, signals] of signalsByDomain) {
    await write(path.join(OUT, 'signals', `${domain}.json`), signals);
  }
  for (const [domain, resources] of resourcesByDomain) {
    await write(path.join(OUT, 'resources', `${domain}.json`), resources);
  }

  // Prune only files, never directories.
  for (const dir of ['tools', 'signals', 'resources']) {
    const base = path.join(OUT, dir);
    if (!existsSync(base)) continue;
    const stack = [base];
    while (stack.length) {
      const current = stack.pop()!;
      for (const entry of await readdir(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (!desired.has(path.resolve(full))) await rm(full, { force: true });
      }
    }
  }

  // Count from disk, after authored files are folded in, so the figure matches
  // what actually exists rather than what the archive alone contributed.
  for (const domain of domains) {
    const dir = path.join(OUT, 'tools', domain.slug);
    domain.tool_count = existsSync(dir) ? (await readdir(dir)).length : 0;
  }
  toolFiles = domains.reduce((n, d) => n + d.tool_count, 0);
  await write(path.join(OUT, 'domains.json'), domains);

  await write(path.join(OUT, '_migration-report.json'), {
    generated_at: new Date().toISOString(),
    source: 'src/data',
    domains: domains.length,
    active_domains: domains.filter((d) => d.status === 'active').map((d) => d.slug),
    tools: toolFiles,
    practitioners: practitionersBySlug.size,
    signals: [...signalsByDomain.values()].reduce((n, s) => n + s.length, 0),
    resources: [...resourcesByDomain.values()].reduce((n, r) => n + r.length, 0),
    warnings,
  });

  const totalSignals = [...signalsByDomain.values()].reduce((n, s) => n + s.length, 0);
  const totalResources = [...resourcesByDomain.values()].reduce((n, r) => n + r.length, 0);

  console.error(`\n${'='.repeat(58)}`);
  console.error(`domains       ${domains.length} (1 active: ${ACTIVE_DOMAIN}, ${domains.length - 1} archived)`);
  console.error(`tools         ${toolFiles}`);
  console.error(`practitioners ${practitionersBySlug.size} (deduped across domains)`);
  console.error(`signals       ${totalSignals}`);
  console.error(`resources     ${totalResources}`);
  console.error(`warnings      ${warnings.length} (recorded in _migration-report.json)`);
  console.error('='.repeat(58));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

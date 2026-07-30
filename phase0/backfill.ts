#!/usr/bin/env node
/**
 * Phase 0 backfill — does the cohort-tracking thesis hold?
 *
 * For each member of a myrmidon cohort, walk the git history of every
 * package.json in their significant public repos, and emit one row per
 * (tool, added|removed, timestamp). Roll those events up into a per-year
 * adoption timeline.
 *
 * The whole point is falsification: if the printed timeline does not look
 * like the real history of frontend development, the cohort-tracking model
 * is wrong and we stop here.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_... node phase0/backfill.ts
 *
 * No npm install. Node >= 23.6 strips the TypeScript annotations natively.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

type Args = {
  cohort: string;
  out: string;
  cache: string;
  maxRepos: number;
  maxCommits: number;
  minStars: number;
  concurrency: number;
};

function parseArgs(argv: string[]): Args {
  const get = (flag: string, fallback: string) => {
    const i = argv.indexOf(`--${flag}`);
    return i === -1 ? fallback : argv[i + 1];
  };
  const here = path.dirname(new URL(import.meta.url).pathname);
  return {
    cohort: get('cohort', path.join(here, 'cohort.json')),
    out: get('out', path.join(here, 'out')),
    cache: get('cache', path.join(here, '.cache')),
    maxRepos: Number(get('max-repos', '25')),
    maxCommits: Number(get('max-commits', '120')),
    minStars: Number(get('min-stars', '5')),
    concurrency: Number(get('concurrency', '4')),
  };
}

const ARGS = parseArgs(process.argv.slice(2));
const TOKEN = process.env.GITHUB_TOKEN;
const API = 'https://api.github.com';

// ---------------------------------------------------------------------------
// github client: cached, rate-limit aware, resumable
// ---------------------------------------------------------------------------

type Res = { status: number; body: any };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ghFetch(url: string): Promise<Res> {
  const key = createHash('sha1').update(url).digest('hex');
  const file = path.join(ARGS.cache, `${key}.json`);

  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    // cache miss
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'techmyrmidons-phase0',
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      },
    });

    // Primary rate limit exhausted: wait for the window to reset.
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (res.status === 403 && remaining === '0') {
      const reset = Number(res.headers.get('x-ratelimit-reset') ?? 0) * 1000;
      const wait = Math.max(reset - Date.now(), 1000) + 2000;
      console.error(`  rate limit reached, sleeping ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      continue;
    }

    // Secondary / abuse rate limit.
    if (res.status === 403 || res.status === 429) {
      const wait = Number(res.headers.get('retry-after') ?? 0) * 1000 || 5000 * (attempt + 1);
      await sleep(wait);
      continue;
    }

    if (res.status >= 500) {
      await sleep(2000 * (attempt + 1));
      continue;
    }

    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    const out: Res = { status: res.status, body };
    // Cache successes AND 404s — a missing file is a real, stable answer.
    if (res.status === 200 || res.status === 404) {
      await writeFile(file, JSON.stringify(out));
    }
    return out;
  }

  return { status: 599, body: null };
}

// ---------------------------------------------------------------------------
// tool canonicalisation
//
// Deliberately small. Its only job is to stop plugin sprawl from drowning the
// signal (a repo with 14 gulp-* packages is one data point about gulp, not 14).
// This map is the first thing to tune once you have looked at the output.
// ---------------------------------------------------------------------------

const ALIASES: Record<string, string> = {
  'react-dom': 'react',
  'react-scripts': 'react',
  'node-sass': 'sass',
  'dart-sass': 'sass',
  'vue-loader': 'vue',
  'tailwindcss': 'tailwind',
  'ts-node': 'typescript',
  'ts-loader': 'typescript',
  'yo': 'yeoman',
  'uglifyjs-webpack-plugin': 'uglify-js',
  'coffee-script': 'coffeescript',
};

const PREFIXES: Array<[string, string | null]> = [
  ['@types/', null], // type stubs are noise, not tool choices
  ['@angular/', 'angular'],
  ['@babel/', 'babel'],
  ['babel-plugin-', 'babel'],
  ['babel-preset-', 'babel'],
  ['babel-core', 'babel'],
  ['babel-loader', 'babel'],
  ['babel-register', 'babel'],
  ['gulp-', 'gulp'],
  ['grunt-', 'grunt'],
  ['eslint-plugin-', 'eslint'],
  ['eslint-config-', 'eslint'],
  ['stylelint-', 'stylelint'],
  ['karma-', 'karma'],
  ['postcss-', 'postcss'],
  ['rollup-plugin-', 'rollup'],
  ['@rollup/', 'rollup'],
  ['vite-plugin-', 'vite'],
  ['@vitejs/', 'vite'],
  ['webpack-', 'webpack'],
  ['@webpack-cli/', 'webpack'],
  ['jest-', 'jest'],
  ['@jest/', 'jest'],
  ['@storybook/', 'storybook'],
  ['@tailwindcss/', 'tailwind'],
  ['@vue/', 'vue'],
  ['@nuxt/', 'nuxt'],
  ['@sveltejs/', 'svelte'],
  ['@playwright/', 'playwright'],
  ['@testing-library/', 'testing-library'],
];

export function canonicalize(name: string): string | null {
  if (ALIASES[name]) return ALIASES[name];
  for (const [prefix, target] of PREFIXES) {
    if (name.startsWith(prefix)) return target;
  }
  return name;
}

/** Returns null when the manifest is unparseable, so we can skip that revision
 *  rather than emitting a wall of phantom removals. */
export function parseManifest(text: string): Set<string> | null {
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (!json || typeof json !== 'object') return null;

  const tools = new Set<string>();
  for (const field of ['dependencies', 'devDependencies']) {
    const deps = json[field];
    if (!deps || typeof deps !== 'object') continue;
    for (const raw of Object.keys(deps)) {
      const tool = canonicalize(raw);
      if (tool) tools.add(tool);
    }
  }
  return tools;
}

// ---------------------------------------------------------------------------
// data collection
// ---------------------------------------------------------------------------

type Member = { name: string; github: string };
type Repo = { full_name: string; stars: number };
type Observation = {
  person: string;
  github: string;
  repo: string;
  tool: string;
  action: 'added' | 'removed';
  at: string;
  sha: string;
};

async function verifyMember(m: Member): Promise<boolean> {
  const res = await ghFetch(`${API}/users/${m.github}`);
  if (res.status !== 200) {
    console.error(`  ! ${m.name}: github login "${m.github}" returned ${res.status} — fix cohort.json`);
    return false;
  }
  return true;
}

async function listRepos(login: string): Promise<Repo[]> {
  const repos: Repo[] = [];
  for (let page = 1; page <= 3; page++) {
    const res = await ghFetch(
      `${API}/users/${login}/repos?per_page=100&page=${page}&type=owner&sort=pushed`,
    );
    if (res.status !== 200 || !Array.isArray(res.body)) break;
    for (const r of res.body) {
      if (r.fork) continue; // forks are someone else's tool choices
      repos.push({ full_name: r.full_name, stars: r.stargazers_count ?? 0 });
    }
    if (res.body.length < 100) break;
  }
  return repos
    .filter((r) => r.stars >= ARGS.minStars)
    .sort((a, b) => b.stars - a.stars)
    .slice(0, ARGS.maxRepos);
}

async function listCommits(fullName: string, file: string) {
  const commits: Array<{ sha: string; date: string }> = [];
  for (let page = 1; commits.length < ARGS.maxCommits; page++) {
    const res = await ghFetch(
      `${API}/repos/${fullName}/commits?path=${encodeURIComponent(file)}&per_page=100&page=${page}`,
    );
    if (res.status !== 200 || !Array.isArray(res.body) || res.body.length === 0) break;
    for (const c of res.body) {
      const date = c.commit?.committer?.date ?? c.commit?.author?.date;
      if (date) commits.push({ sha: c.sha, date });
    }
    if (res.body.length < 100) break;
  }
  // GitHub returns newest-first; we want to replay history forwards.
  return commits.slice(0, ARGS.maxCommits).reverse();
}

async function fileAt(fullName: string, file: string, sha: string): Promise<string | null> {
  const res = await ghFetch(
    `${API}/repos/${fullName}/contents/${encodeURIComponent(file)}?ref=${sha}`,
  );
  if (res.status !== 200 || !res.body?.content) return null; // deleted / absent
  return Buffer.from(res.body.content, 'base64').toString('utf8');
}

async function scanRepo(member: Member, repo: Repo, file: string): Promise<Observation[]> {
  const commits = await listCommits(repo.full_name, file);
  const observations: Observation[] = [];
  let prev = new Set<string>();

  for (const c of commits) {
    const text = await fileAt(repo.full_name, file, c.sha);
    const cur = text === null ? new Set<string>() : parseManifest(text);
    if (cur === null) continue; // unparseable revision — skip, do not infer removals

    for (const tool of cur) {
      if (!prev.has(tool)) {
        observations.push({
          person: member.name, github: member.github, repo: repo.full_name,
          tool, action: 'added', at: c.date, sha: c.sha,
        });
      }
    }
    for (const tool of prev) {
      if (!cur.has(tool)) {
        observations.push({
          person: member.name, github: member.github, repo: repo.full_name,
          tool, action: 'removed', at: c.date, sha: c.sha,
        });
      }
    }
    prev = cur;
  }

  return observations;
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// rollup: events -> intervals -> per-year adoption
// ---------------------------------------------------------------------------

type Interval = { person: string; tool: string; from: number; to: number };

export function buildIntervals(observations: Observation[]): Interval[] {
  const byKey = new Map<string, Observation[]>();
  for (const o of observations) {
    const key = `${o.github} ${o.repo} ${o.tool}`;
    const list = byKey.get(key);
    if (list) list.push(o);
    else byKey.set(key, [o]);
  }

  const now = Date.now();
  const intervals: Interval[] = [];

  for (const events of byKey.values()) {
    events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    let open: number | null = null;
    for (const e of events) {
      const t = Date.parse(e.at);
      if (e.action === 'added' && open === null) open = t;
      else if (e.action === 'removed' && open !== null) {
        intervals.push({ person: events[0].person, tool: events[0].tool, from: open, to: t });
        open = null;
      }
    }
    if (open !== null) {
      intervals.push({ person: events[0].person, tool: events[0].tool, from: open, to: now });
    }
  }

  return intervals;
}

/** tool -> year -> set of people using it at any point that year */
export function buildTimeline(intervals: Interval[]) {
  const timeline = new Map<string, Map<number, Set<string>>>();
  const thisYear = new Date().getUTCFullYear();

  for (const iv of intervals) {
    const startYear = new Date(iv.from).getUTCFullYear();
    const endYear = new Date(iv.to).getUTCFullYear();
    for (let y = startYear; y <= Math.min(endYear, thisYear); y++) {
      let years = timeline.get(iv.tool);
      if (!years) timeline.set(iv.tool, (years = new Map()));
      let people = years.get(y);
      if (!people) years.set(y, (people = new Set()));
      people.add(iv.person);
    }
  }

  return timeline;
}

// ---------------------------------------------------------------------------
// output
// ---------------------------------------------------------------------------

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvRow = (cells: Array<string | number>) => cells.map(csvCell).join(',');

function printVerdict(timeline: Map<string, Map<number, Set<string>>>, cohortSize: number) {
  const years = new Set<number>();
  for (const byYear of timeline.values()) for (const y of byYear.keys()) years.add(y);
  const sorted = [...years].sort((a, b) => a - b);

  const countsFor = (year: number) => {
    const rows: Array<[string, number]> = [];
    for (const [tool, byYear] of timeline) {
      const n = byYear.get(year)?.size ?? 0;
      if (n > 0) rows.push([tool, n]);
    }
    return rows.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };

  console.log(`\n${'='.repeat(64)}`);
  console.log(`ADOPTION BY YEAR  (of ${cohortSize} cohort members)`);
  console.log('='.repeat(64));

  for (const year of sorted) {
    const rows = countsFor(year).filter(([, n]) => n >= 2).slice(0, 12);
    if (rows.length === 0) continue;
    console.log(`\n${year}`);
    for (const [tool, n] of rows) {
      console.log(`  ${'#'.repeat(n).padEnd(cohortSize)} ${String(n).padStart(2)}  ${tool}`);
    }
  }

  console.log(`\n${'='.repeat(64)}`);
  console.log('MOVERS  (change in adopters vs. previous year)');
  console.log('='.repeat(64));

  for (let i = 1; i < sorted.length; i++) {
    const year = sorted[i];
    const prev = new Map(countsFor(sorted[i - 1]));
    const cur = new Map(countsFor(year));
    const deltas: Array<[string, number]> = [];
    for (const tool of new Set([...prev.keys(), ...cur.keys()])) {
      const d = (cur.get(tool) ?? 0) - (prev.get(tool) ?? 0);
      if (d !== 0) deltas.push([tool, d]);
    }
    if (deltas.length === 0) continue;
    deltas.sort((a, b) => b[1] - a[1]);
    const up = deltas.filter(([, d]) => d > 0).slice(0, 5);
    const down = deltas.filter(([, d]) => d < 0).slice(-5).reverse();
    console.log(`\n${year}`);
    if (up.length) console.log(`  rising   ${up.map(([t, d]) => `${t} +${d}`).join(', ')}`);
    if (down.length) console.log(`  fading   ${down.map(([t, d]) => `${t} ${d}`).join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  if (!TOKEN) {
    console.error(
      'No GITHUB_TOKEN set. Unauthenticated requests are capped at 60/hour,\n' +
      'which is not enough to finish. Create a classic token with public_repo\n' +
      'scope (or a fine-grained token with public read) and re-run.\n',
    );
    process.exit(1);
  }

  await mkdir(ARGS.cache, { recursive: true });
  await mkdir(ARGS.out, { recursive: true });

  const cohort = JSON.parse(await readFile(ARGS.cohort, 'utf8'));
  const manifest: string = cohort.manifest ?? 'package.json';
  const members: Member[] = cohort.members;

  console.error(`stream: ${cohort.stream}  manifest: ${manifest}  members: ${members.length}`);
  console.error('verifying github logins...');

  const valid: Member[] = [];
  for (const m of members) {
    if (await verifyMember(m)) valid.push(m);
  }
  if (valid.length === 0) {
    console.error('No valid cohort members. Fix the github logins in cohort.json.');
    process.exit(1);
  }

  const observations: Observation[] = [];

  for (const member of valid) {
    const repos = await listRepos(member.github);
    console.error(`\n${member.name} (@${member.github}) — ${repos.length} repos`);

    const perRepo = await pool(repos, ARGS.concurrency, async (repo) => {
      const obs = await scanRepo(member, repo, manifest);
      if (obs.length) {
        console.error(`  ${repo.full_name} (${repo.stars}*) -> ${obs.length} events`);
      }
      return obs;
    });

    for (const obs of perRepo) observations.push(...obs);
  }

  if (observations.length === 0) {
    console.error('\nNo observations. Either the manifest name is wrong for this stream, or');
    console.error('these repos genuinely carry no dependency manifests. That is a real answer.');
    process.exit(2);
  }

  observations.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const intervals = buildIntervals(observations);
  const timeline = buildTimeline(intervals);

  // observations.csv — the raw event log; this is the `observation` table.
  const obsCsv = [csvRow(['person', 'github', 'repo', 'tool', 'action', 'observed_at', 'sha'])];
  for (const o of observations) {
    obsCsv.push(csvRow([o.person, o.github, o.repo, o.tool, o.action, o.at, o.sha]));
  }
  await writeFile(path.join(ARGS.out, 'observations.csv'), obsCsv.join('\n'));

  // timeline.csv — the rollup you actually look at.
  const timeCsv = [csvRow(['year', 'tool', 'adopters', 'adopter_pct', 'people'])];
  const rows: Array<[number, string, string[]]> = [];
  for (const [tool, byYear] of timeline) {
    for (const [year, people] of byYear) rows.push([year, tool, [...people].sort()]);
  }
  rows.sort((a, b) => a[0] - b[0] || b[2].length - a[2].length || a[1].localeCompare(b[1]));
  for (const [year, tool, people] of rows) {
    const pct = Math.round((people.length / valid.length) * 100);
    timeCsv.push(csvRow([year, tool, people.length, `${pct}%`, people.join('; ')]));
  }
  await writeFile(path.join(ARGS.out, 'timeline.csv'), timeCsv.join('\n'));

  printVerdict(timeline, valid.length);

  console.error(
    `\n${observations.length} observations, ${timeline.size} distinct tools, ` +
    `${valid.length}/${members.length} members scanned`,
  );
  console.error(`wrote ${path.join(ARGS.out, 'observations.csv')}`);
  console.error(`wrote ${path.join(ARGS.out, 'timeline.csv')}`);
}

// Only run when executed directly, so the pure functions above stay importable
// from a test harness.
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

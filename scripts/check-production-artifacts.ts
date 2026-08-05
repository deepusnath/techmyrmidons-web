#!/usr/bin/env node
/**
 * Deploy gate: refuse to publish an export that contains editorial review tooling.
 *
 * The review routes render withheld dossier bodies, unreviewed rule wording,
 * decision logs and reviewer names in full. They are preview-only. A production
 * export must not contain them — not hidden, not unlinked, not merely unlinked
 * from navigation: absent.
 *
 * Why this exists: the exclusion in next.config.ts gates route discovery on
 * NEXT_PUBLIC_SHOW_DRAFTS, but nothing on the deploy path set it, so a build
 * made with the flag unset was published to GitHub Pages with /review and
 * /review/priority publicly readable. A flag can be forgotten; this checks the
 * artifact that is about to be pushed instead of trusting how it was built.
 *
 * tests/review-routes.spec.ts asserts the same properties in more depth, from
 * inside the Playwright suite. This is the cheap gate that runs on the deploy
 * path itself, without a browser. Both read the same phrase list from
 * scripts/withheld-editorial.ts, so the two cannot drift.
 *
 * Usage: node scripts/check-production-artifacts.ts [--dir out]
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { ALL_FORBIDDEN } from './withheld-editorial.ts';

const arg = (flag: string, fallback: string) => {
  const i = process.argv.indexOf(`--${flag}`);
  return i === -1 ? fallback : process.argv[i + 1];
};

const OUT = path.resolve(process.cwd(), arg('dir', 'out'));

/**
 * Extensions whose bytes are not text. Everything else is read as UTF-8 and
 * scanned, including .txt RSC payloads and .js bundles — the 2026-07-31
 * exposure shipped review content in `__next.review.*.txt` flight data, not
 * only in HTML.
 */
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|pdf|mp4|webm|zip)$/i;

/**
 * Every file under `dir`, as paths relative to it, with `/` separators on any OS.
 *
 * `.git` is skipped: it is not part of the export, and deploy-pages.sh builds a
 * throwaway repo inside out/ whose reflog names the committer — which would
 * otherwise trip the reviewer-identity check on a tree that is perfectly clean.
 */
function allFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...allFiles(full, base));
    else if (entry.isFile()) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

const failures: string[] = [];
function check(label: string, offenders: string[]) {
  if (offenders.length === 0) {
    console.log(`PASS  ${label}`);
    return;
  }
  failures.push(label);
  console.log(`FAIL  ${label}`);
  for (const o of offenders.slice(0, 20)) console.log(`        ${o}`);
  if (offenders.length > 20) console.log(`        ... +${offenders.length - 20} more`);
}

function main() {
  if (!existsSync(OUT) || !statSync(OUT).isDirectory()) {
    console.error(`x no export at ${OUT} — run \`npm run build:production\` first`);
    process.exit(1);
  }

  const files = allFiles(OUT);
  if (files.length === 0) {
    console.error(`x export at ${OUT} is empty`);
    process.exit(1);
  }
  console.log(`checking ${files.length} files in ${path.relative(process.cwd(), OUT) || OUT}\n`);

  // 1. No review route, and no child artifact of one, may exist at all.
  //    Matched case-insensitively: macOS is case-insensitive by default and
  //    would otherwise hide a `/Review/` directory that Linux would serve.
  check(
    'no review route or child artifact exists under out/',
    files.filter((f) => f.toLowerCase().includes('review')),
  );

  // 2. No reference to a review URL may survive in navigation, a manifest, a
  //    router payload or a bundle.
  const urlHits: string[] = [];
  const textHits: string[] = [];
  for (const f of files) {
    if (BINARY.test(f)) continue;
    let text: string;
    try {
      text = readFileSync(path.join(OUT, f), 'utf8');
    } catch {
      continue; // unreadable as text — the binary skip list missed it
    }
    if (text.includes('/review')) urlHits.push(f);
    for (const phrase of ALL_FORBIDDEN) {
      if (text.includes(phrase)) textHits.push(`${f} :: ${phrase}`);
    }
  }
  check('no /review URL remains anywhere in out/', urlHits);

  // 3. Withheld editorial must not leak through any other surface either.
  check('no withheld dossier text, decision log, rule id or reviewer name leaks', textHits);

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed — this export must not be deployed`);
    process.exit(1);
  }
  console.log('\nproduction export clean');
}

main();

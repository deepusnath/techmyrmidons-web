#!/usr/bin/env node
/**
 * Proves that review status is genuinely rule-level.
 *
 * The risk this guards against: a reviewer approves one recommendation and the
 * build quietly publishes every other unreviewed judgement alongside it. That
 * would be worse than publishing nothing, because it would look reviewed.
 *
 * Runs against an in-memory copy of the real heuristics. Never writes content.
 *
 * Usage: node scripts/tests/rule-isolation.test.ts
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { listRules, redactToReviewed } from '../../lib/review.ts';
import { diagnose } from '../../lib/assessment.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got  ${a}\n        want ${e}`}`);
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

async function main() {
  const raw = await readFile(path.join(ROOT, 'content', 'heuristics', 'frontend.json'), 'utf8');
  const base = JSON.parse(raw);

  const toolsDir = path.join(ROOT, 'content', 'tools', 'frontend');
  const { readdir } = await import('node:fs/promises');
  const toolNames: Record<string, string> = {};
  for (const f of await readdir(toolsDir)) {
    const t = JSON.parse(await readFile(path.join(toolsDir, f), 'utf8'));
    toolNames[t.slug] = t.name;
  }

  // --- baseline: nothing reviewed -----------------------------------------
  check('no rules reviewed in committed content', listRules(base).filter((r) => r.reviewed).length, 0);
  check('redaction yields nothing publishable', redactToReviewed(base), null);

  // --- approve exactly one rule -------------------------------------------
  const one = clone(base);
  one.contexts.legacy.candidates[0].editorial_status = 'reviewed';
  one.contexts.legacy.candidates[0].reviewed_by = 'Test Reviewer';
  one.contexts.legacy.candidates[0].reviewed_at = '2026-07-31';
  const approvedId: string = one.contexts.legacy.candidates[0].rule_id;

  const redacted = redactToReviewed(one);
  const survived = redacted ? listRules(redacted) : [];
  check('exactly one rule survives redaction', survived.length, 1);
  check('and it is the approved one', survived[0]?.rule_id, approvedId);

  // The approved rule is legacy.recommend.vite. Nothing in any OTHER context
  // may appear, and no retain/reconsider rule may appear either.
  check('no rules leak from other contexts', survived.filter((r) => r.context !== 'legacy').length, 0);
  check('no retain rules leak', survived.filter((r) => r.kind === 'retain').length, 0);
  check('no reconsider rules leak', survived.filter((r) => r.kind === 'reconsider').length, 0);

  // --- the diagnosis built from redacted rules shows only that conclusion ---
  const marked = { gulp: 'using', jquery: 'using', bootstrap: 'using', sass: 'using' } as never;
  const d = diagnose({
    answers: { work: 'legacy', goal: 'modernize', baseline: null, completed_at: 'x' },
    marked,
    heuristics: redacted!,
    toolNames,
  });
  check('one suggestion survives', d.suggestions.map((s) => s.slug), ['vite']);
  check('no retain conclusions published', d.appropriate.length, 0);
  check('no reconsider conclusions published', d.reconsider.length, 0);

  // --- an unrelated journey stays completely empty -------------------------
  const other = diagnose({
    answers: { work: 'design_systems', goal: 'stay_current', baseline: null, completed_at: 'x' },
    marked: { storybook: 'using' } as never,
    heuristics: redacted!,
    toolNames,
  });
  check('unrelated journey publishes nothing', {
    s: other.suggestions.length, a: other.appropriate.length, r: other.reconsider.length,
  }, { s: 0, a: 0, r: 0 });

  // --- reviewedOnly gating on the full (unredacted) document ---------------
  const gated = diagnose({
    answers: { work: 'legacy', goal: 'modernize', baseline: null, completed_at: 'x' },
    marked,
    heuristics: one,
    toolNames,
    reviewedOnly: true,
  });
  check('reviewedOnly yields the same single conclusion', gated.suggestions.map((s) => s.slug), ['vite']);
  check('reviewedOnly suppresses unreviewed retain rules', gated.appropriate.length, 0);

  // --- redacted output carries no unreviewed prose -------------------------
  const serialised = JSON.stringify(redacted);
  check('no unreviewed rule text survives redaction',
    /bundler now owns the dependency graph|A working stylesheet is an asset/.test(serialised), false);

  console.log(failures === 0 ? '\nall green' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

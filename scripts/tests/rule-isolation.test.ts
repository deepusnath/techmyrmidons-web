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
import { DESTINATION_FIELDS, listRules, redactToReviewed, rulePublicationStatus, toolProvidesDestination } from '../../lib/review.ts';
import { diagnose } from '../../lib/assessment.ts';
import { isFieldReviewed } from '../../lib/provenance.ts';
import { EDITORIAL_TOOL_FIELDS } from '../../content/schema.ts';

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
  const realTools = new Map<string, any>();
  for (const f of await readdir(toolsDir)) {
    const t = JSON.parse(await readFile(path.join(toolsDir, f), 'utf8'));
    toolNames[t.slug] = t.name;
    realTools.set(t.slug, t);
  }

  /**
   * For the rule-isolation proof we need every tool to provide a destination, so
   * that the ONLY variable is rule review status. Otherwise the publication gate
   * would mask the thing being tested.
   */
  const destinationReady = new Map(
    [...realTools].map(([slug, t]) => [slug, { ...t, reviewed_fields: ['one_liner', 'what_it_is'] }]),
  );

  /**
   * The mirror of the above: every tool stripped back to having no reviewed
   * destination.
   *
   * The isolation proofs assert what happens *while* a destination is missing,
   * so they must construct that state rather than assume the committed content
   * still has it. Once TypeScript's destination fields were approved on
   * 2026-08-06 the committed content legitimately began publishing, and six
   * assertions that had silently depended on "nothing is approved yet" failed.
   * They were testing a snapshot of review progress, not an invariant.
   */
  const destinationBlocked = new Map(
    [...realTools].map(([slug, t]) => [slug, { ...t, editorial_status: 'ai_draft', reviewed_fields: [] }]),
  );

  // --- baseline: only the six reviewed TypeScript rules exist --------------
  const baseReviewed = listRules(base, realTools).filter((r) => r.reviewed);
  check('exactly the six reviewed rules are TypeScript',
    [...new Set(baseReviewed.map((r) => r.tool_slug))], ['typescript']);
  check('and there are six of them', baseReviewed.length, 6);
  check('none is publishable without a destination',
    listRules(base, destinationBlocked).some((r) => r.publishable), false);
  check('and nothing at all publishes without one',
    redactToReviewed(base, destinationBlocked), null);

  // --- approve exactly one rule -------------------------------------------
  const one = clone(base);
  one.contexts.legacy.candidates[0].editorial_status = 'reviewed';
  one.contexts.legacy.candidates[0].reviewed_by = 'Test Reviewer';
  one.contexts.legacy.candidates[0].reviewed_at = '2026-07-31';
  const approvedId: string = one.contexts.legacy.candidates[0].rule_id;

  // Destination-ready tools throughout, so review status is the only variable.
  // TypeScript's six reviewed rules are reverted here for the same reason.
  for (const ctx of Object.values(one.contexts) as any[]) {
    for (const v of Object.values(ctx.still_appropriate ?? {}) as any[]) {
      if (v.rule_id?.includes('typescript')) { v.editorial_status = 'ai_draft'; v.reviewed_by = null; v.reviewed_at = null; }
    }
    for (const c of ctx.candidates ?? []) {
      if (c.rule_id?.includes('typescript')) { c.editorial_status = 'ai_draft'; c.reviewed_by = null; c.reviewed_at = null; }
    }
  }

  const redacted = redactToReviewed(one, destinationReady);
  const survived = redacted ? listRules(redacted, destinationReady) : [];
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

  // =========================================================================
  // Publication gate: review status vs publication eligibility
  // =========================================================================
  const toolIndex = realTools;
  const committed = JSON.parse(raw);
  const tsRules = listRules(committed, toolIndex).filter((r) => r.tool_slug === 'typescript');

  // (1) the six TypeScript rules are recorded reviewed, with reviewer and date
  check('six TypeScript rules recorded', tsRules.length, 6);
  check('all six are reviewed', tsRules.every((r) => r.reviewed), true);
  const tsRaw = [
    committed.contexts.apps.still_appropriate.typescript,
    committed.contexts.design_systems.still_appropriate.typescript,
    ...['apps', 'legacy', 'design_systems', 'learning'].map((c: string) =>
      committed.contexts[c].candidates.find((x: any) => x.slug === 'typescript')),
  ];
  check('reviewer recorded on all six', tsRaw.every((r: any) => r.reviewed_by === 'Deepu S Nath'), true);
  check('date recorded on all six', tsRaw.every((r: any) => r.reviewed_at === '2026-07-31'), true);

  // (2) no unrelated rule became reviewed
  const otherReviewed = listRules(committed, toolIndex).filter((r) => r.reviewed && r.tool_slug !== 'typescript');
  check('no unrelated rule reviewed', otherReviewed.map((r) => r.rule_id), []);

  // (3) with no reviewed destination, the six reviewed rules stay blocked
  const tsBlocked = listRules(committed, destinationBlocked).filter((r) => r.tool_slug === 'typescript');
  check('nothing publishable while destination unreviewed',
    redactToReviewed(committed, destinationBlocked), null);
  check('all six blocked on destination',
    tsBlocked.every((r) => !r.publishable && /destination/.test(r.blockedBy ?? '')), true);

  // (4) no rule text, reason or condition leaks into that redacted output
  check('redacted output is empty, so nothing can leak',
    redactToReviewed(committed, destinationBlocked), null);

  // (4b) and the committed content, whose destination IS approved, publishes
  // exactly those six rules and nothing else.
  const committedRedacted = redactToReviewed(committed, toolIndex);
  const committedRules = committedRedacted ? listRules(committedRedacted, toolIndex) : [];
  check('committed content publishes exactly six rules', committedRules.length, 6);
  check('all of them TypeScript', [...new Set(committedRules.map((r) => r.tool_slug))], ['typescript']);

  // (5) naming the fields while values are blank does not unblock
  const blankTool = { ...toolIndex.get('typescript'), one_liner: '   ', what_it_is: '', reviewed_fields: ['one_liner', 'what_it_is'] };
  check('blank values do not unblock', toolProvidesDestination(blankTool as never), false);

  // (6) reviewing only one of the two fields does not unblock
  const halfTool = { ...toolIndex.get('typescript'), reviewed_fields: ['one_liner'] };
  check('one field alone does not unblock', toolProvidesDestination(halfTool as never), false);

  // (7) both non-empty reviewed fields unblock all six, with NO rule edit
  const readyTools = new Map(toolIndex);
  readyTools.set('typescript', { ...toolIndex.get('typescript'), reviewed_fields: ['one_liner', 'what_it_is'] });
  const unblocked = listRules(committed, readyTools).filter((r) => r.tool_slug === 'typescript');
  check('all six become publishable', unblocked.every((r) => r.publishable), true);
  const redactedReady = redactToReviewed(committed, readyTools);
  check('exactly six rules survive redaction', redactedReady ? listRules(redactedReady, readyTools).length : 0, 6);
  check('and only TypeScript rules do',
    redactedReady ? [...new Set(listRules(redactedReady, readyTools).map((r) => r.tool_slug))] : [], ['typescript']);

  // (8) the deferred lifecycle stays withheld even once rules publish
  check('tool record still unreviewed after rules publish',
    readyTools.get('typescript').editorial_status, 'ai_draft');
  check('lifecycle still unreviewed (not in reviewed_fields)',
    (readyTools.get('typescript').reviewed_fields ?? []).includes('lifecycle'), false);

  // (9) the renderer must agree with the publication gate, field by field.
  // Gating the render on editorial_status alone let the six rules publish
  // while the fields they point at stayed blank — a published recommendation
  // leading to an empty card.
  const readyTs = readyTools.get('typescript');
  check('approved one_liner renders', isFieldReviewed(readyTs, 'one_liner'), true);
  check('approved what_it_is renders', isFieldReviewed(readyTs, 'what_it_is'), true);
  check('unapproved lifecycle stays withheld', isFieldReviewed(readyTs, 'lifecycle'), false);
  check('unapproved why_it_matters stays withheld', isFieldReviewed(readyTs, 'why_it_matters'), false);
  check('every field the destination gate needs also renders',
    DESTINATION_FIELDS.every((f) => isFieldReviewed(readyTs, f)), toolProvidesDestination(readyTs));

  // Record-level review still covers everything; an untouched record covers nothing.
  const wholeTs = { ...readyTs, editorial_status: 'reviewed', reviewed_by: 'A Reviewer', reviewed_at: '2026-01-01' };
  check('record-level review covers every field',
    EDITORIAL_TOOL_FIELDS.every((f) => isFieldReviewed(wholeTs as never, f)), true);
  check('an unreviewed tool renders no editorial field',
    EDITORIAL_TOOL_FIELDS.some((f) => isFieldReviewed(destinationBlocked.get('typescript'), f)), false);

  // A reviewed rule pointing at a nonexistent tool must never publish.
  check('missing tool blocks publication',
    rulePublicationStatus(tsRaw[0] as never, undefined).publishable, false);

  console.log(failures === 0 ? '\nall green' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

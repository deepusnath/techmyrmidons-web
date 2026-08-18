#!/usr/bin/env node
/**
 * Proves the completion model keeps its promises.
 *
 * The risks this guards against: a score that rewards hoarding marks over
 * shipping, a tier reachable without building anything, journey numbers with a
 * dishonest denominator, and — the governance one — any formatted percentage
 * escaping into caller-visible output.
 *
 * Runs against synthetic fixtures. Never reads user state, never writes.
 *
 * Usage: node scripts/tests/completion.test.ts
 */
import {
  ASSESSMENT_POINTS,
  computeCompletion,
  JOURNEY_MULTIPLIER,
  recencyMultiplier,
  STATE_WEIGHT,
  TIERS,
  type CompletionInput,
} from '../../lib/completion.ts';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got  ${a}\n        want ${e}`}`);
}

const NOW = new Date('2026-08-08T00:00:00Z');
const fresh = '2026-08-01T00:00:00.000Z';
const stale18mo = '2025-02-01T00:00:00.000Z';
const stale3yr = '2023-08-01T00:00:00.000Z';

/** Ten categories, two tools each — shaped like the AI catalogue. */
const tools = Array.from({ length: 10 }, (_, c) => [
  { slug: `t${c}a`, category: `cat${c}` },
  { slug: `t${c}b`, category: `cat${c}` },
]).flat();

const base: CompletionInput = {
  tools,
  marked: {},
  assessmentCompleted: false,
  journeySlugs: null,
  now: NOW,
};

function main() {
  // --- (1) zero state is "not started", not a tier -------------------------
  const empty = computeCompletion(base);
  check('no activity yields no tier', empty.tier, null);
  check('and points at the first tier', empty.nextMilestone?.tier, 'Scout');
  check('potential is 18×categories + assessment', empty.potential, 18 * 10 + ASSESSMENT_POINTS);

  // --- (2) any activity is a Scout ------------------------------------------
  const oneMark = computeCompletion({ ...base, marked: { t0a: { state: 'exploring', updated_at: fresh } } });
  check('one exploration reaches Scout', oneMark.tier, 'Scout');

  // --- (3) shipping outweighs hoarding --------------------------------------
  const hoarder = computeCompletion({
    ...base,
    marked: Object.fromEntries(['t0a', 't1a', 't2a', 't3a', 't4a'].map((s) => [s, { state: 'exploring' as const, updated_at: fresh }])),
  });
  const shipper = computeCompletion({ ...base, marked: { t0a: { state: 'shipped', updated_at: fresh } } });
  check('one shipped tool outscores five explored', shipper.raw > hoarder.raw, true);

  // --- (4) journey marks count harder, off-journey unchanged ----------------
  const inJ = computeCompletion({ ...base, journeySlugs: ['t0a'], marked: { t0a: { state: 'using', updated_at: fresh } } });
  const offJ = computeCompletion({ ...base, journeySlugs: ['t9b'], marked: { t0a: { state: 'using', updated_at: fresh } } });
  check('journey bonus applies to journey tools', inJ.raw, STATE_WEIGHT.using * JOURNEY_MULTIPLIER);
  check('and not to the rest', offJ.raw, STATE_WEIGHT.using);

  // --- (5) recency decay ----------------------------------------------------
  check('fresh mark at full weight', recencyMultiplier(fresh, NOW), 1.0);
  check('18-month mark decays', recencyMultiplier(stale18mo, NOW), 0.7);
  check('3-year mark decays further', recencyMultiplier(stale3yr, NOW), 0.4);
  const stale = computeCompletion({ ...base, marked: { t0a: { state: 'shipped', updated_at: stale3yr } } });
  check('stale ship scores less than fresh', stale.raw < shipper.raw, true);

  // --- (6) tier gates: no summit without shipping ---------------------------
  // Every tool explored, fresh, assessment done — maximal browsing, zero building.
  const allExplored = computeCompletion({
    ...base,
    assessmentCompleted: true,
    marked: Object.fromEntries(tools.map((t) => [t.slug, { state: 'exploring' as const, updated_at: fresh }])),
  });
  check('exploring the ENTIRE catalogue stays Explorer', allExplored.tier, 'Explorer');

  // Using a dozen tools clears the Practitioner fraction — and the next gap is
  // explicitly a ship, not more volume.
  const heavyUser = computeCompletion({
    ...base,
    assessmentCompleted: true,
    marked: Object.fromEntries(tools.slice(0, 12).map((t) => [t.slug, { state: 'using' as const, updated_at: fresh }])),
  });
  check('real use reaches Practitioner', heavyUser.tier, 'Practitioner');
  check('the gap to Shipwright is a ship, not a fraction', heavyUser.nextMilestone?.needsShipped, true);

  // Heavy shipping in one category only: Myrmidon stays out of reach.
  const oneTrick = computeCompletion({
    ...base,
    assessmentCompleted: true,
    journeySlugs: ['t0a', 't0b'],
    marked: {
      t0a: { state: 'shipped', updated_at: fresh },
      t0b: { state: 'shipped', updated_at: fresh },
    },
  });
  check('shipping in one category is not a Myrmidon', oneTrick.tier === 'Myrmidon', false);
  if (oneTrick.nextMilestone?.tier === 'Myrmidon') {
    check('the Myrmidon gap names categories', oneTrick.nextMilestone.needsShippedCategories > 0, true);
  }

  // --- (7) the Myrmidon gate is reachable and demands breadth ---------------
  const summit = computeCompletion({
    ...base,
    assessmentCompleted: true,
    journeySlugs: tools.map((t) => t.slug),
    marked: Object.fromEntries(tools.slice(0, 14).map((t) => [t.slug, { state: 'shipped' as const, updated_at: fresh }])),
  });
  check('broad fresh shipping reaches Myrmidon', summit.tier, 'Myrmidon');
  check('summit has no next milestone', summit.nextMilestone, null);

  // --- (8) journey fractions have honest denominators -----------------------
  const j = computeCompletion({
    ...base,
    journeySlugs: ['t0a', 't1a', 't2a', 't3a', 't4a'],
    marked: {
      t0a: { state: 'shipped', updated_at: fresh },
      t1a: { state: 'using', updated_at: fresh },
      t5a: { state: 'shipped', updated_at: fresh }, // off-journey
    },
  });
  check('journey total is the journey, not the catalogue', j.journey?.total, 5);
  check('touched counts journey marks only', j.journey?.touched, 2);
  check('using-or-better is cumulative', j.journey?.usingOrBetter, 2);
  check('journey shipped excludes off-journey ships', j.journey?.shipped, 1);

  // --- (9) withheld rules mean no journey, not a fake one -------------------
  check('null journey slugs yield null journey', computeCompletion(base).journey, null);

  // --- (10) unknown marks score nothing -------------------------------------
  const ghost = computeCompletion({ ...base, marked: { deleted_tool: { state: 'shipped', updated_at: fresh } } });
  check('a mark on an unpublished tool scores zero', ghost.raw, 0);
  check('and is not counted', ghost.markedCount, 0);

  // --- (11) no percentage ever escapes --------------------------------------
  const surface = JSON.stringify([empty, shipper, allExplored, summit, TIERS]);
  check('no formatted percentage in any output', /%/.test(surface), false);
  check('tier names carry no numerals', TIERS.every((t) => !/\d/.test(t.name)), true);

  console.log(failures === 0 ? '\nall green' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main();

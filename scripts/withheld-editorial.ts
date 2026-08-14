/**
 * The editorial material that must never reach a production artifact.
 *
 * Single source for both checkers, which assert the same property from
 * different angles and previously kept their own copies of this list:
 *
 *  - scripts/check-production-artifacts.ts — the deploy gate, runs without a
 *    browser and blocks `npm run deploy` before it pushes
 *  - tests/review-routes.spec.ts — the Playwright production assertions
 *
 * Deliberately NOT in lib/. Anything under lib/ is reachable from the app's
 * import graph, so these strings would be compiled into the production bundle —
 * where the guard would then find them and fail the build. The one place a list
 * of forbidden phrases must not live is inside the artifact it polices.
 */

/**
 * This list is a snapshot of what is *not yet approved*, so it shrinks as
 * review progresses. An entry may only be removed once the material it names
 * has genuinely been approved — never to make a failing build pass. Removing
 * one without an approval behind it turns the guard into a rubber stamp.
 *
 * Removed on 2026-08-06, when TypeScript's destination fields were reviewed and
 * the six TypeScript rules became publishable:
 *   - three reviewed rule wordings ("Retain TypeScript when the application
 *     already depends", "editor-assisted navigation, rename operations",
 *     "treated as a migration project") — approved 2026-07-31, blocked only on
 *     a destination, and now published
 *   - the six approved TypeScript rule ids
 *   - "Deepu S Nath" — the reviewer of that published content, whose
 *     attribution the trust model requires the site to show
 * Each was verified present in the export for that reason and no other; the
 * unapproved rule ids and every unreviewed field stayed absent.
 */

/** Withheld editorial, checked as substrings. */
export const FORBIDDEN_TEXT = [
  // dossier bodies — the review workspace never ships
  'Verifiable facts', 'Editorial interpretation', 'verifiable_facts', 'wrong_if', 'evidence_gaps',
  // decision log
  'decision_log', 'approve_with_edits',
  // AI-drafted editorial, still unreviewed. Two rule phrases have left this
  // list the earned way — 'A working stylesheet is an asset' (2026-08-13,
  // legacy.retain.sass) and 'bundler now owns the dependency graph'
  // (2026-08-14, legacy.reconsider.gulp reviewed and its destination signed).
  // 'clearest example of a shift' stays: tailwind's why_it_matters remains
  // unreviewed.
  'clearest example of a shift',
];

/**
 * Rule identifiers, checked as values rather than banned as substrings: the
 * property names `rule_id` and `still_appropriate` legitimately ship inside the
 * compiled diagnosis, which runs client-side.
 */
export const FORBIDDEN_RULE_IDS = [
  // Emptied 2026-08-14: legacy.reconsider.gulp and content.recommend.astro were
  // reviewed and their destinations signed, so those ids publish. The four
  // §2-withheld AI-assistance rules are candidates for this list, but their
  // ids never serialize while withheld — redaction drops them — so listing
  // them would assert nothing the redaction tests do not already prove.
];

/** Everything above, for checkers that scan with one pass. */
export const ALL_FORBIDDEN = [...FORBIDDEN_TEXT, ...FORBIDDEN_RULE_IDS];

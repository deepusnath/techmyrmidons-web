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

/** Withheld editorial, checked as substrings. */
export const FORBIDDEN_TEXT = [
  // dossier bodies
  'Verifiable facts', 'Editorial interpretation', 'verifiable_facts', 'wrong_if', 'evidence_gaps',
  // decision log
  'decision_log', 'approve_with_edits',
  // AI-drafted rule text
  'bundler now owns the dependency graph', 'A working stylesheet is an asset',
  'clearest example of a shift',
  // reviewed-but-blocked TypeScript wording
  'Retain TypeScript when the application already depends',
  'editor-assisted navigation, rename operations',
  'treated as a migration project',
  // reviewer identity
  'Deepu S Nath',
];

/**
 * Rule identifiers, checked as values rather than banned as substrings: the
 * property names `rule_id` and `still_appropriate` legitimately ship inside the
 * compiled diagnosis, which runs client-side.
 */
export const FORBIDDEN_RULE_IDS = [
  'apps.retain.typescript', 'design_systems.retain.typescript',
  'apps.recommend.typescript', 'legacy.recommend.typescript',
  'design_systems.recommend.typescript', 'learning.recommend.typescript',
  'legacy.reconsider.gulp', 'content.recommend.astro',
];

/** Everything above, for checkers that scan with one pass. */
export const ALL_FORBIDDEN = [...FORBIDDEN_TEXT, ...FORBIDDEN_RULE_IDS];

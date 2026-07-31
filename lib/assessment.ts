/**
 * Context-aware diagnosis.
 *
 * Replaces the previous "you have nothing in this category, here is something"
 * logic, which recommended tools purely because a bucket was empty. Filling
 * categories is not a diagnosis — it produces the same generic list for a
 * legacy maintainer and a design-system author.
 *
 * Rules here:
 *  - a recommendation requires work context AND goal; without them we ask for
 *    context rather than guessing
 *  - every suggestion states why it applies to THIS user and what would make it
 *    unsuitable
 *  - at most three suggestions
 *  - no score, percentage, level or completeness meter is produced anywhere
 *  - repository signals never contribute
 */
import type { ProgressState } from './state.ts';

export type WorkContext = 'content' | 'apps' | 'design_systems' | 'legacy' | 'learning';
export type Goal = 'stay_current' | 'modernize' | 'new_stack' | 'ai_productivity' | 'skill_gaps';

/**
 * Conditional follow-up for learners. Work type and goal alone cannot
 * distinguish somebody who has never written CSS from somebody who has shipped
 * an application, and recommending TypeScript, Vite and React to the former is
 * actively unhelpful.
 */
export type Baseline = 'new_to_web' | 'static_pages' | 'writes_js' | 'built_app';

export const BASELINE_OPTIONS: Array<{ value: Baseline; label: string }> = [
  { value: 'new_to_web', label: 'New to HTML, CSS, and JavaScript' },
  { value: 'static_pages', label: 'Comfortable building static pages' },
  { value: 'writes_js', label: 'Comfortable writing JavaScript' },
  { value: 'built_app', label: 'Have already built a frontend application' },
];

export const WORK_OPTIONS: Array<{ value: WorkContext; label: string; hint: string }> = [
  { value: 'content', label: 'Content or marketing sites', hint: 'Documentation, marketing, editorial, blogs' },
  { value: 'apps', label: 'Web applications or SaaS', hint: 'Dashboards, products, stateful interfaces' },
  { value: 'design_systems', label: 'Design systems or component libraries', hint: 'Components other teams consume' },
  { value: 'legacy', label: 'Legacy maintenance', hint: 'Keeping an older codebase working' },
  { value: 'learning', label: 'Learning or exploring', hint: 'Building your foundation' },
];

export const GOAL_OPTIONS: Array<{ value: Goal; label: string; hint: string }> = [
  { value: 'stay_current', label: 'Stay current', hint: 'Know what changed and why' },
  { value: 'modernize', label: 'Modernize an existing project', hint: 'Reduce the cost of what you already run' },
  { value: 'new_stack', label: 'Choose a stack for a new project', hint: 'Starting from scratch' },
  { value: 'ai_productivity', label: 'Improve productivity with AI', hint: 'Where assistance actually helps' },
  { value: 'skill_gaps', label: 'Identify skill gaps', hint: 'What you have drifted past' },
];

export interface AssessmentAnswers {
  work: WorkContext | null;
  goal: Goal | null;
  baseline: Baseline | null;
  completed_at: string | null;
}

export const EMPTY_ASSESSMENT: AssessmentAnswers = {
  work: null, goal: null, baseline: null, completed_at: null,
};

/** Only the learning context needs the extra baseline question. */
export function needsBaseline(work: WorkContext | null): boolean {
  return work === 'learning';
}

// ---------------------------------------------------------------------------
// heuristics shape (content/heuristics/<domain>.json)
// ---------------------------------------------------------------------------

export interface Candidate {
  slug: string;
  why: string;
  unsuitable_if: string;
  /** Only offered when the user has marked one of these. */
  requires_any?: string[];
  goals?: Goal[];
  /** Only offered at these learner baselines (learning context only). */
  baselines?: Baseline[];
  /**
   * Roles this tool already covers. If a higher-priority suggestion provides a
   * role, a lower one offering only that same role is redundant and suppressed
   * — recommending Astro and Vite side by side as separate priorities when
   * Astro brings its own build is a contradiction, not a richer answer.
   */
  provides?: string[];
  /** Roles this tool needs from elsewhere; it is redundant without them. */
  role?: string;
}

export interface ContextRules {
  label: string;
  still_appropriate: Record<string, string>;
  reconsider: Record<string, string>;
  candidates: Candidate[];
}

export interface Heuristics {
  domain: string;
  editorial_status: 'ai_draft' | 'reviewed';
  reviewed_by: string | null;
  reviewed_at: string | null;
  note: string;
  contexts: Record<WorkContext, ContextRules>;
}

// ---------------------------------------------------------------------------
// diagnosis
// ---------------------------------------------------------------------------

export interface Judged {
  slug: string;
  name: string;
  reason: string;
}

export interface Suggestion {
  slug: string;
  name: string;
  why: string;
  unsuitable_if: string;
}

export interface Diagnosis {
  status: 'needs_context' | 'ready';
  /** What we still need before recommending anything. */
  missing: Array<'work' | 'goal' | 'baseline'>;
  contextLabel: string | null;
  appropriate: Judged[];
  reconsider: Judged[];
  suggestions: Suggestion[];
  /** True when rules used were unreviewed AI-authored judgements. */
  rulesAreDraft: boolean;
}

export const MAX_SUGGESTIONS = 3;

export function diagnose({
  answers,
  marked,
  heuristics,
  toolNames,
}: {
  answers: AssessmentAnswers;
  marked: Record<string, ProgressState>;
  heuristics: Heuristics;
  toolNames: Record<string, string>;
}): Diagnosis {
  const rulesAreDraft = heuristics.editorial_status !== 'reviewed';
  const missing: Array<'work' | 'goal' | 'baseline'> = [];
  if (!answers.work) missing.push('work');
  if (!answers.goal) missing.push('goal');
  // A learner with nothing marked and no stated starting point has given us no
  // usable context, so we ask instead of guessing at their level.
  const noToolsMarked = Object.keys(marked).length === 0;
  if (needsBaseline(answers.work) && noToolsMarked && !answers.baseline) missing.push('baseline');

  // Without context we ask rather than produce something generic.
  if (missing.length > 0 || !answers.work || !answers.goal) {
    return {
      status: 'needs_context',
      missing,
      contextLabel: null,
      appropriate: [],
      reconsider: [],
      suggestions: [],
      rulesAreDraft,
    };
  }

  const rules = heuristics.contexts[answers.work];
  if (!rules) {
    return {
      status: 'needs_context',
      missing: ['work'],
      contextLabel: null,
      appropriate: [],
      reconsider: [],
      suggestions: [],
      rulesAreDraft,
    };
  }

  const name = (slug: string) => toolNames[slug] ?? slug;
  const markedSlugs = Object.keys(marked).sort();

  // What the user already has that still serves this kind of work.
  const appropriate: Judged[] = markedSlugs
    .filter((s) => rules.still_appropriate[s])
    .map((s) => ({ slug: s, name: name(s), reason: rules.still_appropriate[s] }));

  // What they have that specifically does not serve this kind of work.
  const reconsider: Judged[] = markedSlugs
    .filter((s) => rules.reconsider[s])
    .map((s) => ({ slug: s, name: name(s), reason: rules.reconsider[s] }));

  // Candidates must match the goal, must not already be marked, any
  // `requires_any` precondition must hold, and — for learners — the candidate
  // must suit the stated baseline.
  const eligible = rules.candidates
    .filter((c) => !(c.slug in marked))
    .filter((c) => !c.goals || c.goals.includes(answers.goal as Goal))
    .filter((c) => !c.requires_any || c.requires_any.some((r) => r in marked))
    .filter((c) => !c.baselines || (answers.baseline ? c.baselines.includes(answers.baseline) : false));

  /**
   * Suppress a candidate whose only role is already covered — by a
   * higher-priority suggestion, or by something the user already marked.
   *
   * Recommending Astro and Vite side by side as separate learning priorities
   * contradicts Vite's own "not for you if you are using a framework that
   * brings its own build". A contradiction is worse than a shorter list.
   */
  const provided = new Set<string>();
  for (const slug of markedSlugs) {
    const c = rules.candidates.find((x) => x.slug === slug);
    for (const r of c?.provides ?? []) provided.add(r);
    if (c?.role) provided.add(c.role);
  }

  const suggestions: Suggestion[] = [];
  for (const c of eligible) {
    if (suggestions.length >= MAX_SUGGESTIONS) break;
    if (c.role && provided.has(c.role)) continue;
    for (const r of c.provides ?? []) provided.add(r);
    if (c.role) provided.add(c.role);
    suggestions.push({ slug: c.slug, name: name(c.slug), why: c.why, unsuitable_if: c.unsuitable_if });
  }

  return {
    status: 'ready',
    missing: [],
    contextLabel: rules.label,
    appropriate,
    reconsider,
    suggestions,
    rulesAreDraft,
  };
}

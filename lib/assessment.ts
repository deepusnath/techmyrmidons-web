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
  completed_at: string | null;
}

export const EMPTY_ASSESSMENT: AssessmentAnswers = { work: null, goal: null, completed_at: null };

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
  missing: Array<'work' | 'goal'>;
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
  const missing: Array<'work' | 'goal'> = [];
  if (!answers.work) missing.push('work');
  if (!answers.goal) missing.push('goal');

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

  // Candidates must match the goal, must not already be marked, and any
  // `requires_any` precondition must actually hold for this user.
  const suggestions: Suggestion[] = rules.candidates
    .filter((c) => !(c.slug in marked))
    .filter((c) => !c.goals || c.goals.includes(answers.goal as Goal))
    .filter((c) => !c.requires_any || c.requires_any.some((r) => r in marked))
    .slice(0, MAX_SUGGESTIONS)
    .map((c) => ({
      slug: c.slug,
      name: name(c.slug),
      why: c.why,
      unsuitable_if: c.unsuitable_if,
    }));

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

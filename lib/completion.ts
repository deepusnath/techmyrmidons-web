/**
 * Personal completion over the exploring/using/shipped marks.
 *
 * This grades exactly one thing: the user's own self-reported journey through a
 * domain. It is fenced off from everything editorial — the diagnosis produces
 * no score, and nothing here feeds a lifecycle, a rule, or a trend claim. The
 * fence is written into docs/PRODUCT_PLAN_PROFILES.md (§4.6, D2, D3) and this
 * module keeps to it structurally:
 *
 *  - no percentage is exported or formatted anywhere; callers get tiers,
 *    milestones and fractions with honest denominators
 *  - journey slugs are supplied by the caller, so a production caller passes
 *    only publishable-rule targets and withheld editorial cannot leak through
 *    a profile
 *  - weights make one shipped tool outweigh a shelf of explored ones: the
 *    product celebrates building, not bookmarking
 *  - marks decay with age, because this is a staying-current product and a
 *    2023 "shipped" says little about today
 *
 * Weights are v1 constants awaiting calibration against real usage.
 */
import type { ProgressState, ToolStateRecord } from './state.ts';

export const STATE_WEIGHT: Record<ProgressState, number> = {
  exploring: 1,
  using: 3,
  shipped: 6,
};

/** Marks on tools inside the user's assessed journey count harder. */
export const JOURNEY_MULTIPLIER = 1.5;

/** Completing the assessment is itself progress: context is what makes the rest mean anything. */
export const ASSESSMENT_POINTS = 6;

/** Per-category potential: two shipped, in-journey tools (2 × 6 × 1.5). */
const CATEGORY_POTENTIAL = 18;

const DAY_MS = 86_400_000;

/** A mark fades as it ages; renewing it (re-toggling) restores full weight. */
export function recencyMultiplier(updatedAt: string, now: Date): number {
  const age = (now.getTime() - new Date(updatedAt).getTime()) / DAY_MS;
  if (Number.isNaN(age) || age <= 365) return 1.0;
  if (age <= 730) return 0.7;
  return 0.4;
}

export interface TierGate {
  name: string;
  /** Minimum raw/potential fraction (internal — never displayed). */
  minFraction: number;
  minShipped?: number;
  minShippedCategories?: number;
  requiresAssessment?: boolean;
}

/**
 * The end state is named after the product on purpose: you become the Myrmidon.
 * Gates beyond the fraction keep the top tiers about shipping breadth, so no
 * amount of exploring alone reaches them.
 */
export const TIERS: TierGate[] = [
  { name: 'Scout', minFraction: 0 },
  { name: 'Explorer', minFraction: 0.08 },
  { name: 'Practitioner', minFraction: 0.18 },
  { name: 'Shipwright', minFraction: 0.32, minShipped: 1 },
  { name: 'Myrmidon', minFraction: 0.55, minShippedCategories: 3, requiresAssessment: true },
];

export interface CompletionInput {
  /** Published catalogue for the domain. */
  tools: Array<{ slug: string; category: string | null }>;
  /** The user's marks for this domain, keyed by bare slug. */
  marked: Record<string, ToolStateRecord>;
  assessmentCompleted: boolean;
  /**
   * Tool slugs referenced by the rules of the user's assessed work context.
   * Null when unknown — no assessment, or the rules are withheld in this
   * build. Callers in production must derive this from publishable rules only.
   */
  journeySlugs: string[] | null;
  now?: Date;
}

export interface JourneyProgress {
  total: number;
  /** Any mark at all. */
  touched: number;
  usingOrBetter: number;
  shipped: number;
}

export interface NextMilestone {
  tier: string;
  /** Structured hints for UI copy — never a percentage. */
  needsShipped: boolean;
  needsShippedCategories: number;
  needsAssessment: boolean;
  /** Rough count of fresh, in-journey ships that would close the fraction gap. */
  shipsToClose: number;
}

export interface DomainCompletion {
  raw: number;
  potential: number;
  shipped: number;
  shippedCategories: number;
  markedCount: number;
  /** Null when there is no activity at all — "not started", not "Scout". */
  tier: string | null;
  nextMilestone: NextMilestone | null;
  journey: JourneyProgress | null;
}

export function computeCompletion(input: CompletionInput): DomainCompletion {
  const now = input.now ?? new Date();
  const bySlug = new Map(input.tools.map((t) => [t.slug, t]));
  const journey = input.journeySlugs ? new Set(input.journeySlugs) : null;

  const categories = new Set<string>();
  for (const t of input.tools) if (t.category) categories.add(t.category);
  const potential = CATEGORY_POTENTIAL * Math.max(1, categories.size) + ASSESSMENT_POINTS;

  let raw = input.assessmentCompleted ? ASSESSMENT_POINTS : 0;
  let shipped = 0;
  let markedCount = 0;
  const shippedCats = new Set<string>();

  for (const [slug, rec] of Object.entries(input.marked)) {
    const tool = bySlug.get(slug);
    // A mark on a tool no longer in the published catalogue scores nothing:
    // the score describes a journey through what the Myrmidon curates today.
    if (!tool) continue;
    markedCount++;
    const inJourney = journey?.has(slug) ?? false;
    raw +=
      STATE_WEIGHT[rec.state] *
      (inJourney ? JOURNEY_MULTIPLIER : 1) *
      recencyMultiplier(rec.updated_at, now);
    if (rec.state === 'shipped') {
      shipped++;
      if (tool.category) shippedCats.add(tool.category);
    }
  }

  const f = raw / potential;
  const meets = (g: TierGate) =>
    f >= g.minFraction &&
    shipped >= (g.minShipped ?? 0) &&
    shippedCats.size >= (g.minShippedCategories ?? 0) &&
    (!g.requiresAssessment || input.assessmentCompleted);

  let tier: string | null = null;
  let next: TierGate | null = null;
  if (raw > 0) {
    for (const g of TIERS) {
      if (meets(g)) tier = g.name;
      else { next = g; break; }
    }
  } else {
    next = TIERS[0];
  }

  const nextMilestone: NextMilestone | null = next
    ? {
        tier: next.name,
        needsShipped: shipped < (next.minShipped ?? 0),
        needsShippedCategories: Math.max(0, (next.minShippedCategories ?? 0) - shippedCats.size),
        needsAssessment: (next.requiresAssessment ?? false) && !input.assessmentCompleted,
        shipsToClose: Math.max(
          0,
          Math.ceil((next.minFraction * potential - raw) / (STATE_WEIGHT.shipped * JOURNEY_MULTIPLIER)),
        ),
      }
    : null;

  let journeyProgress: JourneyProgress | null = null;
  if (journey && journey.size > 0) {
    let touched = 0, usingOrBetter = 0, jShipped = 0;
    for (const slug of journey) {
      const rec = input.marked[slug];
      if (!rec) continue;
      touched++;
      if (rec.state === 'using' || rec.state === 'shipped') usingOrBetter++;
      if (rec.state === 'shipped') jShipped++;
    }
    journeyProgress = { total: journey.size, touched, usingOrBetter, shipped: jShipped };
  }

  return {
    raw,
    potential,
    shipped,
    shippedCategories: shippedCats.size,
    markedCount,
    tier,
    nextMilestone,
    journey: journeyProgress,
  };
}

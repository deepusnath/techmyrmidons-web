/**
 * TechMyrmidons content model.
 *
 * The single source of truth for the shape of editorial content. Content lives
 * in git as JSON and is reviewed by PR; this file is what makes that content
 * typed and validatable.
 *
 * The load-bearing idea is `EvidenceTier`. Every claim the product renders about
 * a tool must declare where it came from, so the four kinds of evidence can
 * never silently blur into one another in the UI.
 */

// ---------------------------------------------------------------------------
// evidence provenance — the spine of the trust model
// ---------------------------------------------------------------------------

/**
 * - `observed`  machine-derived from a public artifact (a commit, a release, a
 *               published talk). Must carry a resolvable source_url.
 * - `declared`  a named person said they use it. Unverified by anyone else.
 * - `community` corroborated across multiple members' declared states.
 * - `editorial` an authored judgement by a named human editor.
 */
export type EvidenceTier = 'observed' | 'declared' | 'community' | 'editorial';

export const EVIDENCE_TIERS: EvidenceTier[] = ['observed', 'declared', 'community', 'editorial'];

/** Describes trajectory, NOT merit. Rendered with that caveat attached. */
export type Lifecycle = 'emerging' | 'established' | 'declining' | 'legacy';

export const LIFECYCLES: Lifecycle[] = ['emerging', 'established', 'declining', 'legacy'];

/** Personal progress. `proven` is reserved — defined here, locked in pilot UI. */
export type ProgressState = 'exploring' | 'using' | 'shipped' | 'proven';

export const PROGRESS_STATES: ProgressState[] = ['exploring', 'using', 'shipped', 'proven'];

export type DomainStatus = 'active' | 'archived' | 'planned';

// ---------------------------------------------------------------------------
// seeded content
// ---------------------------------------------------------------------------

/**
 * Every record that was not authored fresh for the current product carries this.
 * The UI is required to render a visible chip whenever `is_seed` is true, so
 * seeded and demonstration data is always identifiable and attributable.
 */
export interface Seeded {
  is_seed: boolean;
  /** Human-readable origin, e.g. "original curation, src/data/frontend/2019.json" */
  seed_source: string | null;
}

// ---------------------------------------------------------------------------
// editorial review status
// ---------------------------------------------------------------------------

/**
 * Whether an editorial claim has been reviewed by a human.
 *
 * `ai_draft` is the default and applies to EVERY AI-authored claim: summaries,
 * descriptions, why-it-matters, lifecycle classifications, suitable-for and
 * not-suitable-for guidance, alternatives, and historical interpretations.
 *
 * Nothing may be described as authored or judged by a named editor unless
 * `reviewed_by` and `reviewed_at` are both set — enforced in
 * validate-content.ts, not left to wording discipline.
 */
export type EditorialStatus = 'ai_draft' | 'reviewed';

export interface EditorialReview {
  editorial_status: EditorialStatus;
  /** Required when editorial_status is 'reviewed'. Never set speculatively. */
  reviewed_by: string | null;
  reviewed_at: string | null;
  /** Fields a reviewer has signed off individually, if not the whole record. */
  reviewed_fields: string[];
}

/** The tool fields that constitute editorial claims requiring review. */
export const EDITORIAL_TOOL_FIELDS = [
  'one_liner',
  'what_it_is',
  'why_it_matters',
  'lifecycle',
  'suitable_for',
  'not_suitable_for',
  'alternatives',
] as const;

export type EditorialToolField = (typeof EDITORIAL_TOOL_FIELDS)[number];

// ---------------------------------------------------------------------------
// entities
// ---------------------------------------------------------------------------

export interface Domain extends Seeded {
  slug: string;
  name: string;
  status: DomainStatus;
  /** Required when status is 'archived'. Shown to users verbatim — be honest. */
  archived_reason: string | null;
  /** Last year this domain received genuinely new curation. */
  last_curated_year: number | null;
  logo: string | null;
  /** Original folder name in src/data, kept for traceability. */
  legacy_folder: string | null;
  /** Years whose content duplicated the prior year rather than adding anything. */
  duplicate_years: number[];
  tool_count: number;
  practitioner_count: number;
}

/**
 * No portrait field, deliberately. There was nowhere to record where a
 * photograph came from or under what licence, which is the one thing this
 * content model exists to track. The UI renders initials from `name`.
 */
export interface Practitioner extends Seeded {
  slug: string;
  name: string;
  links: { site?: string; github?: string; x?: string };
  domains: string[];
  bio: string | null;
}

export interface Tool extends Seeded, EditorialReview {
  slug: string;
  domain: string;
  name: string;
  category: string | null;
  homepage: string | null;
  one_liner: string | null;
  what_it_is: string | null;
  why_it_matters: string | null;
  lifecycle: Lifecycle | null;
  first_seen_year: number | null;
  /** Years this tool appeared in the original curation. Drives Historical view. */
  archive_years: number[];
  suitable_for: string[];
  /**
   * REQUIRED (non-empty) before a tool may be published as a recommendation.
   * This is the structural guard against presenting popularity as suitability.
   */
  not_suitable_for: string[];
  alternatives: string[];
  /** False until an editor has authored the judgement fields above. */
  published: boolean;
}

/**
 * How much is known about what a repository actually is. A dependency change in
 * someone's dotfiles means something very different from one in a production
 * application, and we usually cannot tell which from the API alone.
 *
 * Never infer this. `unknown` is the honest default and the only value the
 * importer is allowed to assign automatically.
 */
export type RepoContext =
  | 'unknown'
  | 'production_unknown'
  | 'personal_config'
  | 'library'
  | 'demo'
  | 'legacy';

export interface Signal extends Seeded {
  id: string;
  tool_slug: string;
  domain: string;
  /** Non-nullable by design. Nothing renders without a declared provenance. */
  tier: EvidenceTier;
  source_url: string | null;
  /**
   * A literal description of the artifact change. It must state what happened
   * to a file in a repository — never that a person uses, prefers, adopted or
   * abandoned anything. A dependency edit is not a statement about a human.
   */
  source_label: string;
  observed_at: string;
  actor_type: 'practitioner' | 'member' | 'org' | 'editor';
  actor_id: string | null;
  note: string | null;
  confidence: 'high' | 'medium' | 'low';

  /* --- repository-signal specifics (null for editorial/archive signals) --- */
  repo: string | null;
  manifest_path: string | null;
  action: 'added' | 'removed' | null;
  context_status: RepoContext;
  /**
   * Repository signals are evidence that a file changed, nothing more. They may
   * not feed lifecycle classification or recommendations until a human has
   * reviewed the repository's context and set this true.
   */
  eligible_for_trends: boolean;
}

export interface EditorialNote extends Seeded {
  id: string;
  domain: string;
  tool_slug: string | null;
  /**
   * Named human byline. Null while unreviewed — an unreviewed claim must not be
   * attributed to a real person anywhere, including in stored data.
   */
  author: string | null;
  published_at: string;
  body: string;
  /** Required. A recommendation without stated trade-offs does not publish. */
  tradeoffs: string;
  /**
   * True while the text is drafted but the named author has not yet signed off.
   * Draft notes must never render publicly: attributing unreviewed text to a
   * real person is precisely the failure this product's trust model exists to
   * prevent. Enforced in validate-content.ts rather than left to reviewer care.
   */
  draft: boolean;
}

/**
 * What kind of event a timeline entry records.
 *
 * The previous "arrived"/"faded" labels were ambiguous: they blurred a release
 * date, an adoption trend and an editorial opinion into one word. Each type
 * below means exactly one thing, and every event must state its basis.
 */
export type TimelineEventType =
  | 'first_released'
  | 'first_observed_in_repos'
  | 'first_included_in_techmyrmidons'
  | 'editorial_turning_point'
  | 'removed_from_observed_repo'
  | 'reached_end_of_life';

/**
 * Where an event's claim comes from.
 * - `archive_record`  the tool appears in a dated file in the original archive
 * - `observed_commit` a real commit changed a manifest; links to the commit
 * - `primary_source`   an official publication by the project itself (a release
 *                      announcement, a support-status page). Required for
 *                      factual event types such as a release or an end of life.
 * - `ai_interpretation` an AI-authored reading of what mattered; ALWAYS a draft
 */
export type TimelineBasis =
  | 'archive_record'
  | 'observed_commit'
  | 'primary_source'
  | 'ai_interpretation';

/**
 * Event types that assert a checkable fact about the tool itself rather than an
 * opinion about its significance. These may never rest on an AI interpretation.
 */
export const FACTUAL_EVENT_TYPES = ['first_released', 'reached_end_of_life'] as const;

export interface TimelineEvent {
  type: TimelineEventType;
  tool_slug: string;
  basis: TimelineBasis;
  /** Human-readable justification, shown alongside the event. Required. */
  basis_detail: string;
  source_url: string | null;
  /** 'sourced' only for archive_record / observed_commit. */
  claim_status: 'sourced' | 'ai_draft';
}

/**
 * One year in a domain's Historical view.
 *
 * The archive only ever recorded what was added, which is why the old site
 * could never show a tool losing ground. Typed events make both directions —
 * and the difference between a release and an opinion — explicit.
 */
export interface TimelineEntry extends Seeded {
  id: string;
  domain: string;
  year: number;
  headline: string;
  /**
   * Headline and body are newly authored narrative ABOUT the year. Their review
   * status is deliberately separate from the events: an archive event can be
   * sourced and verifiable while the paragraph interpreting it is not.
   */
  headline_status: EditorialStatus;
  body: string;
  events: TimelineEvent[];
  /** Null while unreviewed. See EditorialNote.author. */
  author: string | null;
  /** Same rule as EditorialNote: unsigned text must not render publicly. */
  draft: boolean;
}

export interface Resource extends Seeded {
  slug: string;
  domain: string;
  title: string;
  url: string;
  kind: 'blog' | 'talk' | 'newsletter' | 'docs' | 'course';
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Key used to detect the same tool listed across multiple year files. Strips a
 * trailing hyphenated version so "Android Studio 4.2" and "Android Studio 2.2"
 * collapse to one tool — but leaves names like "web3" or "es2015" intact.
 */
export function toolKey(title: string): string {
  const slug = slugify(title);
  return slug.replace(/-\d+(-\d+)*$/, '') || slug;
}

/**
 * A tool is publishable as a recommendation only with authored judgement AND a
 * stated limitation. Enforced by validate-content.ts, not left to reviewer care.
 */
export function isPublishable(tool: Tool): boolean {
  return Boolean(
    tool.why_it_matters?.trim() &&
      tool.what_it_is?.trim() &&
      tool.lifecycle &&
      tool.not_suitable_for.length > 0 &&
      tool.suitable_for.length > 0,
  );
}

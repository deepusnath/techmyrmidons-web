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

export interface Practitioner extends Seeded {
  slug: string;
  name: string;
  avatar: string | null;
  links: { site?: string; github?: string; x?: string };
  domains: string[];
  bio: string | null;
}

export interface Tool extends Seeded {
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

export interface Signal extends Seeded {
  id: string;
  tool_slug: string;
  domain: string;
  /** Non-nullable by design. Nothing renders without a declared provenance. */
  tier: EvidenceTier;
  source_url: string | null;
  source_label: string;
  observed_at: string;
  actor_type: 'practitioner' | 'member' | 'org' | 'editor';
  actor_id: string | null;
  note: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface EditorialNote extends Seeded {
  id: string;
  domain: string;
  tool_slug: string | null;
  /** Named human byline. The character is the brand; the byline is the source. */
  author: string;
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
 * One year in a domain's Historical view.
 *
 * The archive only ever recorded what was *added*, which is why the old site
 * could never show a tool losing ground. `faded` exists so that decline is a
 * first-class part of the record rather than an omission.
 */
export interface TimelineEntry extends Seeded {
  id: string;
  domain: string;
  year: number;
  headline: string;
  body: string;
  /** Tool slugs that became notable this year. */
  arrived: string[];
  /** Tool slugs that lost default status this year. */
  faded: string[];
  author: string;
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

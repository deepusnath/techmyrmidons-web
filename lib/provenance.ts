/**
 * Provenance and review-status display rules.
 *
 * Product constraints enforced here rather than left to each component:
 *
 *  1. No claim is described as authored or judged by a named editor unless it
 *     actually carries `reviewed_by` and `reviewed_at`. Every AI-authored
 *     editorial field defaults to `ai_draft`.
 *  2. Draft material never carries a human byline: `bylineFor` returns null
 *     while unreviewed, and callers render the draft label instead.
 *  3. With NEXT_PUBLIC_SHOW_DRAFTS=false, unreviewed editorial claims and
 *     classifications are withheld rather than shown as published facts.
 *  4. Repository signals describe file changes, never a person's preferences.
 */
import type { EditorialReview, EditorialStatus, EvidenceTier, RepoContext } from '../content/schema.ts';

/** Preview shows drafts (labelled). A production build withholds them. */
export const SHOW_DRAFTS = process.env.NEXT_PUBLIC_SHOW_DRAFTS !== 'false';

/**
 * Optional destination for feedback and submissions.
 *
 * Deliberately unset by default. No address is hard-coded and none is invented:
 * publishing a real person's address in a static public build is not something
 * to do implicitly. When unset, the UI keeps Save locally and Copy, and says so.
 *
 * Configure with NEXT_PUBLIC_FEEDBACK_EMAIL at build time.
 */
export const FEEDBACK_EMAIL = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL?.trim() || null;

export const DRAFT_LABEL = 'AI-assisted draft, awaiting domain-editor review';
export const DRAFT_LABEL_SHORT = 'AI draft · unreviewed';

export interface Drafted {
  author: string | null;
  draft: boolean;
}

/** The byline to display, or null when the item is unreviewed. */
export function bylineFor(item: Drafted): string | null {
  return item.draft ? null : item.author;
}

/** Whether a draft-flagged item may render at all in the current build. */
export function isVisible(item: { draft: boolean }): boolean {
  return SHOW_DRAFTS || !item.draft;
}

// ---------------------------------------------------------------------------
// editorial review
// ---------------------------------------------------------------------------

export function isReviewed(r: Pick<EditorialReview, 'editorial_status'>): boolean {
  return r.editorial_status === 'reviewed';
}

/**
 * May an AI-authored editorial claim — a description, a why-it-matters, a
 * lifecycle classification, suitability guidance — be rendered at all?
 *
 * Preview: yes, with a visible draft marker.
 * Production: no. An unreviewed classification shown without qualification is
 * indistinguishable from a verified fact, which is the failure being fixed.
 */
export function canShowEditorialClaim(r: Pick<EditorialReview, 'editorial_status'>): boolean {
  return SHOW_DRAFTS || isReviewed(r);
}

/** Attribution line for a reviewed record. Never invents a reviewer. */
export function reviewAttribution(r: EditorialReview): string | null {
  if (!isReviewed(r) || !r.reviewed_by || !r.reviewed_at) return null;
  return `Reviewed by ${r.reviewed_by} on ${formatDate(r.reviewed_at)}`;
}

export const EDITORIAL_STATUS_META: Record<EditorialStatus, { label: string; description: string }> = {
  ai_draft: {
    label: DRAFT_LABEL_SHORT,
    description:
      'Written with AI assistance and not reviewed by a human editor. It carries no byline and should be read as a proposal, not as an established fact.',
  },
  reviewed: {
    label: 'Reviewed',
    description: 'Checked and signed off by a named human editor, with the review date recorded.',
  },
};

// ---------------------------------------------------------------------------
// evidence tiers
// ---------------------------------------------------------------------------

export interface TierMeta {
  label: string;
  short: string;
  description: string;
  color: string;
}

export const TIER_META: Record<EvidenceTier, TierMeta> = {
  observed: {
    label: 'Repository signal',
    short: 'Repo signal',
    description:
      'A recorded change to a file in a public repository, linked to the commit that made it. It shows that a dependency was added or removed — not that any person uses, prefers, adopted or abandoned the tool.',
    color: 'var(--color-tier-observed)',
  },
  declared: {
    label: 'Self-declared',
    short: 'Declared',
    description:
      'Someone stated they use this. Not verified by anyone else, and shown as their claim rather than as fact.',
    color: 'var(--color-tier-declared)',
  },
  community: {
    label: 'Community-verified',
    short: 'Community',
    description:
      'Corroborated across several members who independently declared the same thing. Not yet implemented.',
    color: 'var(--color-tier-community)',
  },
  editorial: {
    label: 'Editorial claim',
    short: 'Editorial',
    description:
      'A written judgement about the tool. Unless it shows a reviewer and review date, it is AI-drafted and unreviewed — an argument to weigh, not a measurement and not a verified fact.',
    color: 'var(--color-tier-editorial)',
  },
};

export const ARCHIVE_META: TierMeta = {
  label: 'Legacy archive record',
  short: 'Archive',
  description:
    'Imported from the original hand-curated TechMyrmidons lists (2017–2019). A dated record of what was listed then, not a current recommendation.',
  color: 'var(--color-tier-archive)',
};

export const DEMO_META: TierMeta = {
  label: 'Demonstration data',
  short: 'Demo',
  description:
    'A fictional entry that exists only so the interface can be tested. Not a real person and not real activity.',
  color: 'var(--color-tier-demo)',
};

// ---------------------------------------------------------------------------
// repository context
// ---------------------------------------------------------------------------

export const REPO_CONTEXT_META: Record<RepoContext, { label: string; description: string }> = {
  unknown: {
    label: 'context unknown',
    description:
      'Nothing is known about what this repository is for. It has not been reviewed, and its role cannot be read off the API, so no conclusion should be drawn from the change.',
  },
  production_unknown: {
    label: 'production use unknown',
    description: 'A real project, but whether it is production software has not been established.',
  },
  personal_config: {
    label: 'personal configuration',
    description: 'Dotfiles or personal setup. Says nothing about professional or team practice.',
  },
  library: {
    label: 'library or package',
    description: 'A published library. Its dependencies are authoring tooling, not application stack choices.',
  },
  demo: {
    label: 'demo or example',
    description: 'A demonstration or teaching repository, often deliberately minimal or deliberately elaborate.',
  },
  legacy: {
    label: 'legacy or archived',
    description: 'No longer actively developed.',
  },
};

// ---------------------------------------------------------------------------
// lifecycle
// ---------------------------------------------------------------------------

export const LIFECYCLE_META: Record<string, { label: string; blurb: string; color: string }> = {
  emerging: {
    label: 'Emerging',
    blurb: 'Gaining real use, but the outcome is not settled. Adopting means accepting you may migrate again.',
    color: '#7a9b5c',
  },
  established: {
    label: 'Established',
    blurb: 'In widespread production use and a reasonable default for its job.',
    color: '#4a9db5',
  },
  declining: {
    label: 'Declining',
    blurb: 'Losing default status. Still capable, still maintained — but new projects need a specific reason to choose it.',
    color: '#c8913a',
  },
  legacy: {
    label: 'Legacy',
    blurb: 'Superseded. Useful mainly for reading existing code and for recognising when something was written.',
    color: '#8d7f74',
  },
};

/**
 * Lifecycle is an AI-drafted editorial classification until reviewed. It is not
 * measured adoption, and repository signals do not feed it.
 */
export const LIFECYCLE_CAVEAT =
  'Lifecycle is an editorial classification, not a measurement — it is not computed from repository signals and it is not a quality rating. Read “where it may not fit” before deciding.';

// ---------------------------------------------------------------------------
// timeline events
// ---------------------------------------------------------------------------

export const EVENT_TYPE_META: Record<string, { label: string; meaning: string }> = {
  first_released: {
    label: 'First released',
    meaning: 'The date the tool was first publicly released.',
  },
  first_observed_in_repos: {
    label: 'First observed in tracked repositories',
    meaning: 'The earliest commit in a tracked repository that added this dependency.',
  },
  first_included_in_techmyrmidons: {
    label: 'First included in TechMyrmidons',
    meaning: 'The year this tool first appeared in the hand-curated TechMyrmidons list.',
  },
  editorial_turning_point: {
    label: 'Editorial turning point',
    meaning: 'A written opinion that this is when the tool became — or stopped being — significant. Not a release date and not measured adoption.',
  },
  removed_from_observed_repo: {
    label: 'Removed from a tracked repository',
    meaning: 'A commit removed this dependency from a tracked repository.',
  },
  reached_end_of_life: {
    label: 'Reached end of life',
    meaning: 'Support formally ended.',
  },
};

export const BASIS_META: Record<string, { label: string; color: string }> = {
  archive_record: { label: 'archive record', color: 'var(--color-tier-archive)' },
  observed_commit: { label: 'commit', color: 'var(--color-tier-observed)' },
  primary_source: { label: 'official source', color: 'var(--color-tier-community)' },
  ai_interpretation: { label: 'AI interpretation, unreviewed', color: '#c8913a' },
};

// ---------------------------------------------------------------------------
// formatting
// ---------------------------------------------------------------------------

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatYearMonth(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' });
}

/**
 * Renders a repository signal as a literal statement about a file change.
 * Deliberately has no way to express "X uses Y".
 */
export function describeRepoSignal(s: {
  tool_slug: string;
  repo: string | null;
  manifest_path: string | null;
  action: 'added' | 'removed' | null;
  source_url: string | null;
  observed_at: string;
}): string {
  const verb = s.action === 'removed' ? 'was removed from' : 'was added to';
  const where = s.manifest_path ? `${s.manifest_path} in ` : '';
  const repo = s.repo ?? 'a tracked repository';
  const sha = s.source_url?.split('/commit/')[1]?.slice(0, 7);
  const commit = sha ? ` in commit ${sha}` : '';
  return `${s.tool_slug} ${verb} ${where}${repo}${commit} on ${formatDate(s.observed_at)}.`;
}

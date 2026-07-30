/**
 * Provenance display rules.
 *
 * Two product constraints are enforced here rather than left to each component:
 *
 *  1. Draft material never carries a human byline. An AI-assisted draft awaiting
 *     review must not appear to be signed by the named editor, so `bylineFor`
 *     returns null while `draft` is true and callers render the draft label
 *     instead.
 *
 *  2. A production build can hide unreviewed drafts entirely by setting
 *     NEXT_PUBLIC_SHOW_DRAFTS=false. The preview shows them, prominently
 *     labelled, so they can be reviewed.
 */
import type { EvidenceTier } from '../content/schema.ts';

export const SHOW_DRAFTS = process.env.NEXT_PUBLIC_SHOW_DRAFTS !== 'false';

export const DRAFT_LABEL = 'AI-assisted draft, awaiting domain-editor review';

export interface Drafted {
  author: string;
  draft: boolean;
}

/** The byline to display, or null when the item is an unreviewed draft. */
export function bylineFor(item: Drafted): string | null {
  return item.draft ? null : item.author;
}

/** Whether an item may render at all in the current build. */
export function isVisible(item: { draft: boolean }): boolean {
  return SHOW_DRAFTS || !item.draft;
}

export interface TierMeta {
  label: string;
  short: string;
  description: string;
  color: string;
}

export const TIER_META: Record<EvidenceTier, TierMeta> = {
  observed: {
    label: 'Observed evidence',
    short: 'Observed',
    description:
      'Derived from a public artifact — a commit, release or published talk. Every observed signal links to its source and carries the date it happened.',
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
      'Corroborated across several members who independently declared the same thing.',
    color: 'var(--color-tier-community)',
  },
  editorial: {
    label: 'Editorial judgement',
    short: 'Editorial',
    description:
      'An authored opinion by a named editor, dated and accompanied by its trade-offs. Not a measurement.',
    color: 'var(--color-tier-editorial)',
  },
};

export const ARCHIVE_META: TierMeta = {
  label: 'Legacy archive record',
  short: 'Archive',
  description:
    'Imported from the original hand-curated TechMyrmidons lists (2017–2019). Preserved as a historical record of what was recommended then, not as a current recommendation.',
  color: 'var(--color-tier-archive)',
};

export const DEMO_META: TierMeta = {
  label: 'Demonstration data',
  short: 'Demo',
  description:
    'A fictional entry that exists only so the interface can be tested. Not a real person and not real activity.',
  color: 'var(--color-tier-demo)',
};

export const LIFECYCLE_META: Record<
  string,
  { label: string; blurb: string; color: string }
> = {
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
 * Shown wherever lifecycle appears. Lifecycle describes trajectory, and saying
 * so explicitly is the point — the product must never let "widely used" be read
 * as "good for you".
 */
export const LIFECYCLE_CAVEAT =
  'Lifecycle describes how widely a tool is being adopted or dropped over time. It is not a quality rating and not a recommendation for your situation — read “where it may not fit” before deciding.';

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

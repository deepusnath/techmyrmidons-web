/**
 * Build-time view models. Pages are server components in a static export, so
 * these run once at build and hand plain serialisable objects to the client
 * components that do search, filtering and progress marking.
 */
import type { EvidenceTier } from '../content/schema.ts';
import { getEditorialFor, getPublishedTools, getSignalsFor, getTools, type Tool } from './content.ts';
import { isVisible } from './provenance.ts';

export interface EvidenceSummary {
  tier: EvidenceTier;
  count: number;
  latest: string;
}

export interface ToolView {
  slug: string;
  name: string;
  category: string | null;
  homepage: string | null;
  one_liner: string | null;
  what_it_is: string | null;
  why_it_matters: string | null;
  lifecycle: string | null;
  first_seen_year: number | null;
  archive_years: number[];
  suitable_for: string[];
  not_suitable_for: string[];
  alternatives: string[];
  published: boolean;
  is_seed: boolean;
  seed_source: string | null;
  /** Distinct evidence tiers backing this tool, with counts and newest date. */
  evidence: EvidenceSummary[];
  /** True when the only editorial attached to it is an unreviewed draft. */
  hasDraftNote: boolean;
  hasSignedNote: boolean;
}

function summarise(domain: string, slug: string): EvidenceSummary[] {
  const byTier = new Map<EvidenceTier, { count: number; latest: string }>();
  for (const s of getSignalsFor(domain, slug)) {
    const cur = byTier.get(s.tier);
    if (!cur) byTier.set(s.tier, { count: 1, latest: s.observed_at });
    else {
      cur.count++;
      if (s.observed_at > cur.latest) cur.latest = s.observed_at;
    }
  }
  return [...byTier.entries()]
    .map(([tier, v]) => ({ tier, ...v }))
    .sort((a, b) => b.latest.localeCompare(a.latest));
}

function toView(domain: string, tool: Tool): ToolView {
  const notes = getEditorialFor(domain, tool.slug);
  return {
    ...tool,
    evidence: summarise(domain, tool.slug),
    hasDraftNote: notes.some((n) => n.draft && isVisible(n)),
    hasSignedNote: notes.some((n) => !n.draft),
  };
}

export function getToolViews(domain: string): ToolView[] {
  return getPublishedTools(domain).map((t) => toView(domain, t));
}

/** Includes unpublished archive records — used only by the Historical view. */
export function getAllToolViews(domain: string): ToolView[] {
  return getTools(domain).map((t) => toView(domain, t));
}

export function getToolView(domain: string, slug: string): ToolView | undefined {
  const tool = getTools(domain).find((t) => t.slug === slug);
  return tool ? toView(domain, tool) : undefined;
}

export const LANDSCAPE_VIEWS = {
  current: {
    slug: 'current',
    title: 'Current',
    lede: 'Established tools in widespread production use — reasonable defaults for their job today.',
    lifecycles: ['established'],
  },
  emerging: {
    slug: 'emerging',
    title: 'Emerging',
    lede: 'Gaining real use, but not settled. Adopting these means accepting you might migrate again.',
    lifecycles: ['emerging'],
  },
  declining: {
    slug: 'declining',
    title: 'Declining',
    lede: 'Losing default status. Still capable and still maintained — but a new project needs a specific reason to choose one.',
    lifecycles: ['declining'],
  },
  historical: {
    slug: 'historical',
    title: 'Historical',
    lede: 'What the field looked like, year by year — including what faded. The record the original archive could not keep.',
    lifecycles: ['legacy'],
  },
} as const;

export type LandscapeSlug = keyof typeof LANDSCAPE_VIEWS;

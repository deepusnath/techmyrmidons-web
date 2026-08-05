/**
 * Build-time view models. Pages are server components in a static export, so
 * these run once at build and hand plain serialisable objects to the client
 * components that do search, filtering and progress marking.
 */
import { EDITORIAL_TOOL_FIELDS, type EvidenceTier } from '../content/schema.ts';
import { getEditorialFor, getPublishedTools, getSignalsFor, getTools, type Tool } from './content.ts';
import { canShowEditorialClaim, canShowEditorialField, isVisible } from './provenance.ts';

export interface EvidenceSummary {
  tier: EvidenceTier;
  count: number;
  latest: string;
}

export interface ToolView {
  slug: string;
  /** Factual: the tool's own name. Not an editorial claim. */
  name: string;
  editorial_status: 'ai_draft' | 'reviewed';
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewed_fields: string[];
  /** False when the build withholds unreviewed editorial claims. */
  showEditorial: boolean;
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
  const showEditorial = canShowEditorialClaim(tool);
  // Per field, not per record: a reviewer may sign off `one_liner` and
  // `what_it_is` without vouching for the lifecycle or the suitability
  // guidance, and `toolProvidesDestination` opens the publication gate on
  // exactly that. Blanking here means no component can leak an unreviewed
  // claim by forgetting to check.
  const show = (field: string) => canShowEditorialField(tool, field);
  return {
    ...tool,
    one_liner: show('one_liner') ? tool.one_liner : null,
    what_it_is: show('what_it_is') ? tool.what_it_is : null,
    why_it_matters: show('why_it_matters') ? tool.why_it_matters : null,
    lifecycle: show('lifecycle') ? tool.lifecycle : null,
    suitable_for: show('suitable_for') ? tool.suitable_for : [],
    not_suitable_for: show('not_suitable_for') ? tool.not_suitable_for : [],
    alternatives: show('alternatives') ? tool.alternatives : [],
    showEditorial,
    evidence: summarise(domain, tool.slug),
    hasDraftNote: notes.some((n) => n.draft && isVisible(n)),
    hasSignedNote: notes.some((n) => !n.draft),
  };
}

export function getToolViews(domain: string): ToolView[] {
  return getPublishedTools(domain).map((t) => toView(domain, t));
}

/**
 * Tools whose editorial claims this build withholds because they are
 * unreviewed. Surfaced as an explicit list so a production build says
 * "withheld pending review" rather than silently having fewer tools.
 *
 * A tool counts as withheld only when *no* editorial field survives. One
 * signed-off field is enough to give the reader something real, so listing it
 * as withheld would misdescribe the page they would land on.
 */
export function getWithheldTools(domain: string): Array<{ slug: string; name: string; homepage: string | null }> {
  return getPublishedTools(domain)
    .filter((t) => !EDITORIAL_TOOL_FIELDS.some((f) => canShowEditorialField(t, f)))
    .map((t) => ({ slug: t.slug, name: t.name, homepage: t.homepage }));
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

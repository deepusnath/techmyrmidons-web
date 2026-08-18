/**
 * Review status, redaction, priority selection and readiness.
 *
 * Two rules govern everything here:
 *
 *  1. Publishing is decided per rule, never per file. Approving one
 *     recommendation must not release an unrelated one, so redaction strips
 *     individual rules rather than gating the whole heuristics document.
 *
 *  2. Redaction happens on the server, before content reaches a client
 *     component. Anything passed to the client is serialised into the page,
 *     so "hidden in the UI" is not the same as withheld.
 */
import type { Tool } from '../content/schema.ts';
import type { Candidate, ContextRules, Heuristics, RuleValue, WorkContext } from './assessment.ts';
import { ruleId, ruleReviewed, ruleText } from './assessment.ts';
import { getHeuristics, getPublishedTools, getTools } from './content.ts';

// ---------------------------------------------------------------------------
// editorial review status vs production publication eligibility
// ---------------------------------------------------------------------------

/**
 * These are two different questions and were previously one.
 *
 *   reviewed    — a named human approved this specific wording. A completed
 *                 editorial decision, and a permanent record of it.
 *   publishable — that reviewed decision may appear in production *now*.
 *
 * A rule can be reviewed and still not publishable: approving a recommendation
 * whose tool page has no reviewed description sends the reader from useful
 * guidance to a blank card. The reviewer's decision stands; only its release
 * waits.
 *
 * Publication eligibility is derived, never stored. A stored flag would need
 * hand-maintaining and could disagree with reality; a derived one lifts by
 * itself the moment the real precondition is met, and cannot be stale.
 */

/**
 * The reader-facing minimum that makes a tool page a destination rather than a
 * stub. Both must be individually reviewed AND non-empty — listing a field name
 * in `reviewed_fields` while its value is blank approves nothing.
 */
export const DESTINATION_FIELDS = ['one_liner', 'what_it_is'] as const;

export function toolProvidesDestination(tool: Tool | undefined): boolean {
  if (!tool) return false;

  // Values must actually exist. A reviewed-but-empty field is not a destination.
  const present = DESTINATION_FIELDS.every((f) => {
    const v = tool[f as 'one_liner' | 'what_it_is'];
    return typeof v === 'string' && v.trim().length > 0;
  });
  if (!present) return false;

  // A whole-record review covers the fields; otherwise each must be named.
  if (tool.editorial_status === 'reviewed') return true;
  const reviewed = new Set(tool.reviewed_fields ?? []);
  return DESTINATION_FIELDS.every((f) => reviewed.has(f));
}

export interface PublicationStatus {
  reviewed: boolean;
  publishable: boolean;
  blockedBy: string | null;
}

/**
 * Lifecycle is deliberately NOT part of this. A deferred classification does not
 * block a contextual rule — the rule's conclusion does not display lifecycle.
 * Lifecycle gates the lifecycle views, and only those.
 */
export function rulePublicationStatus(
  rule: RuleValue | Candidate,
  tool: Tool | undefined,
): PublicationStatus {
  const reviewed = ruleReviewed(rule);
  if (!reviewed) return { reviewed: false, publishable: false, blockedBy: 'awaiting editorial review' };
  if (!tool) return { reviewed: true, publishable: false, blockedBy: 'target tool does not exist' };
  if (!toolProvidesDestination(tool)) {
    return {
      reviewed: true,
      publishable: false,
      blockedBy: `destination: ${tool.slug} has no reviewed reader-facing content (${DESTINATION_FIELDS.join(' + ')})`,
    };
  }
  return { reviewed: true, publishable: true, blockedBy: null };
}

// ---------------------------------------------------------------------------
// rule inventory
// ---------------------------------------------------------------------------

export type RuleKind = 'retain' | 'reconsider' | 'recommend';

export interface RuleRef {
  rule_id: string;
  context: WorkContext;
  kind: RuleKind;
  tool_slug: string;
  text: string;
  reviewed: boolean;
  publishable: boolean;
  blockedBy: string | null;
}

export function listRules(h: Heuristics, tools?: Map<string, Tool>): RuleRef[] {
  const out: RuleRef[] = [];
  for (const [context, rules] of Object.entries(h.contexts) as Array<[WorkContext, ContextRules]>) {
    for (const [slug, v] of Object.entries(rules.still_appropriate ?? {})) {
      out.push({
        rule_id: ruleId(v as RuleValue, `${context}.retain.${slug}`),
        context, kind: 'retain', tool_slug: slug,
        text: ruleText(v as RuleValue),
        ...rulePublicationStatus(v as RuleValue, tools?.get(slug)),
      });
    }
    for (const [slug, v] of Object.entries(rules.reconsider ?? {})) {
      out.push({
        rule_id: ruleId(v as RuleValue, `${context}.reconsider.${slug}`),
        context, kind: 'reconsider', tool_slug: slug,
        text: ruleText(v as RuleValue),
        ...rulePublicationStatus(v as RuleValue, tools?.get(slug)),
      });
    }
    for (const c of rules.candidates ?? []) {
      out.push({
        rule_id: c.rule_id ?? `${context}.recommend.${c.slug}`,
        context, kind: 'recommend', tool_slug: c.slug,
        text: c.why,
        ...rulePublicationStatus(c, tools?.get(c.slug)),
      });
    }
  }
  return out.sort((a, b) => a.rule_id.localeCompare(b.rule_id));
}

// ---------------------------------------------------------------------------
// redaction
// ---------------------------------------------------------------------------

/**
 * Returns a heuristics document containing only PUBLISHABLE rules — reviewed
 * AND with a reader-facing destination. A reviewed-but-blocked rule is removed
 * entirely, text included, so nothing about it reaches the page source.
 *
 * Unreviewed rule text is removed entirely rather than flagged, so it cannot
 * appear in a production page's source. Returns null when nothing survives —
 * the caller then ships no rules at all.
 */
export function redactToReviewed(h: Heuristics, tools?: Map<string, Tool>): Heuristics | null {
  const contexts = {} as Record<WorkContext, ContextRules>;
  let kept = 0;

  for (const [context, rules] of Object.entries(h.contexts) as Array<[WorkContext, ContextRules]>) {
    const retain: Record<string, RuleValue> = {};
    const reconsider: Record<string, RuleValue> = {};
    const candidates: Candidate[] = [];

    for (const [slug, v] of Object.entries(rules.still_appropriate ?? {})) {
      if (rulePublicationStatus(v as RuleValue, tools?.get(slug)).publishable) {
        retain[slug] = v as RuleValue; kept++;
      }
    }
    for (const [slug, v] of Object.entries(rules.reconsider ?? {})) {
      if (rulePublicationStatus(v as RuleValue, tools?.get(slug)).publishable) {
        reconsider[slug] = v as RuleValue; kept++;
      }
    }
    for (const c of rules.candidates ?? []) {
      if (rulePublicationStatus(c, tools?.get(c.slug)).publishable) { candidates.push(c); kept++; }
    }

    contexts[context] = { label: rules.label, still_appropriate: retain, reconsider, candidates };
  }

  if (kept === 0) return null;
  return { ...h, contexts };
}

// ---------------------------------------------------------------------------
// priority set
// ---------------------------------------------------------------------------

export interface PriorityEntry {
  slug: string;
  name: string;
  /** Every rule that depends on this tool, with the journey it serves. */
  dependencies: Array<{ rule_id: string; context: WorkContext; kind: RuleKind }>;
  contexts: WorkContext[];
  ruleCount: number;
  lifecycle: string | null;
  toolReviewed: boolean;
  reviewedRules: number;
}

/**
 * Derived from the active rules, not from a hand-kept list. A tool is in the
 * priority set exactly when a live rule retains, reconsiders, recommends or
 * requires it — so the set cannot drift from what the diagnosis actually uses.
 */
export function getPrioritySet(domain: string): PriorityEntry[] {
  const h = getHeuristics(domain);
  if (!h) return [];
  const tools = new Map(getTools(domain).map((t) => [t.slug, t]));
  const rules = listRules(h, tools);

  const byTool = new Map<string, PriorityEntry>();
  const ensure = (slug: string): PriorityEntry => {
    let e = byTool.get(slug);
    if (!e) {
      const tool = tools.get(slug);
      e = {
        slug,
        name: tool?.name ?? slug,
        dependencies: [],
        contexts: [],
        ruleCount: 0,
        lifecycle: tool?.lifecycle ?? null,
        toolReviewed: tool?.editorial_status === 'reviewed',
        reviewedRules: 0,
      };
      byTool.set(slug, e);
    }
    return e;
  };

  for (const r of rules) {
    const e = ensure(r.tool_slug);
    e.dependencies.push({ rule_id: r.rule_id, context: r.context, kind: r.kind });
    e.ruleCount++;
    if (r.reviewed) e.reviewedRules++;
    if (!e.contexts.includes(r.context)) e.contexts.push(r.context);
  }

  // Prerequisites pull their tool in too — a rule that fires only when the user
  // marked jQuery depends on jQuery being described accurately.
  for (const [context, ctxRules] of Object.entries(h.contexts) as Array<[WorkContext, ContextRules]>) {
    for (const c of ctxRules.candidates ?? []) {
      for (const pre of c.requires_any ?? []) {
        const e = ensure(pre);
        const id = c.rule_id ?? `${context}.recommend.${c.slug}`;
        if (!e.dependencies.some((d) => d.rule_id === id && d.kind === 'recommend')) {
          e.dependencies.push({ rule_id: id, context, kind: 'recommend' });
          e.ruleCount++;
        }
        if (!e.contexts.includes(context)) e.contexts.push(context);
      }
    }
  }

  return [...byTool.values()].sort(
    (a, b) => b.ruleCount - a.ruleCount || a.slug.localeCompare(b.slug),
  );
}

// ---------------------------------------------------------------------------
// journey dependency maps + readiness
// ---------------------------------------------------------------------------

export interface JourneyMap {
  context: WorkContext;
  label: string;
  retain: RuleRef[];
  reconsider: RuleRef[];
  recommend: RuleRef[];
  /** Tool records whose editorial claims the conclusions depend on. */
  toolsInvolved: Array<{ slug: string; name: string; reviewed: boolean }>;
  blockedBy: string[];
  fullyBlocked: boolean;
}

export function getJourneyMaps(domain: string): JourneyMap[] {
  const h = getHeuristics(domain);
  if (!h) return [];
  const tools = new Map(getTools(domain).map((t) => [t.slug, t]));
  const rules = listRules(h, tools);

  return (Object.entries(h.contexts) as Array<[WorkContext, ContextRules]>).map(([context, r]) => {
    const mine = rules.filter((x) => x.context === context);
    const retain = mine.filter((x) => x.kind === 'retain');
    const reconsider = mine.filter((x) => x.kind === 'reconsider');
    const recommend = mine.filter((x) => x.kind === 'recommend');

    const slugs = [...new Set(mine.map((x) => x.tool_slug))].sort();
    const toolsInvolved = slugs.map((s) => ({
      slug: s,
      name: tools.get(s)?.name ?? s,
      reviewed: tools.get(s)?.editorial_status === 'reviewed',
    }));

    // A conclusion needs BOTH its rule reviewed and the tool it names reviewed:
    // an approved recommendation pointing at an unreviewed lifecycle would still
    // publish an unreviewed claim.
    // A rule blocks the journey if it is unreviewed OR reviewed-but-unpublishable.
    const blockedBy = [
      ...mine.filter((x) => !x.publishable).map((x) => `rule ${x.rule_id}${x.reviewed ? ' (reviewed, destination missing)' : ''}`),
      ...toolsInvolved.filter((t) => !t.reviewed).map((t) => `tool ${t.slug}`),
    ];

    return {
      context,
      label: r.label,
      retain,
      reconsider,
      recommend,
      toolsInvolved,
      blockedBy,
      fullyBlocked: mine.every((x) => !x.publishable),
    };
  });
}

export interface Readiness {
  journeys: Array<{
    context: WorkContext;
    label: string;
    fullyBlocked: boolean;
    blockingRules: number;
    blockingTools: number;
  }>;
  priorityToolsTotal: number;
  priorityToolsReviewed: number;
  rulesTotal: number;
  rulesReviewed: number;
  rulesPublishable: number;
  rulesReviewedButBlocked: number;
  lifecycleViewsBlocked: string[];
  /** The single action unlocking the most surface area, with its reasoning. */
  highestLeverage: { action: string; unlocks: string } | null;
}

export function getReadiness(domain: string): Readiness {
  const h = getHeuristics(domain);
  const tools = new Map(getTools(domain).map((t) => [t.slug, t]));
  const rules = h ? listRules(h, tools) : [];
  const priority = getPrioritySet(domain);
  const published = getPublishedTools(domain);
  const maps = getJourneyMaps(domain);

  const unreviewedLifecycles = published.filter((t) => t.editorial_status !== 'reviewed');
  const lifecycleViewsBlocked = ['current', 'emerging', 'declining', 'historical'].filter((view) => {
    const wanted =
      view === 'current' ? 'established' : view === 'historical' ? 'legacy' : view;
    return published
      .filter((t) => t.lifecycle === wanted)
      .every((t) => t.editorial_status !== 'reviewed');
  });

  // Rank by rules that are still blocked, so the recommendation is derived
  // rather than asserted — and so it stops naming work already finished once a
  // tool's rules start publishing.
  const blockedRules = rules.filter((r) => !r.publishable);
  const byTool = new Map<string, number>();
  for (const r of blockedRules) byTool.set(r.tool_slug, (byTool.get(r.tool_slug) ?? 0) + 1);
  const topTool = [...byTool.entries()].sort((a, b) => b[1] - a[1])[0];
  const topJourneys = topTool
    ? new Set(blockedRules.filter((r) => r.tool_slug === topTool[0]).map((r) => r.context)).size
    : 0;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  return {
    journeys: maps.map((m) => ({
      context: m.context,
      label: m.label,
      fullyBlocked: m.fullyBlocked,
      blockingRules: m.blockedBy.filter((b) => b.startsWith('rule ')).length,
      blockingTools: m.blockedBy.filter((b) => b.startsWith('tool ')).length,
    })),
    priorityToolsTotal: priority.length,
    priorityToolsReviewed: priority.filter((p) => p.toolReviewed).length,
    rulesTotal: rules.length,
    rulesReviewed: rules.filter((r) => r.reviewed).length,
    rulesPublishable: rules.filter((r) => r.publishable).length,
    rulesReviewedButBlocked: rules.filter((r) => r.reviewed && !r.publishable).length,
    lifecycleViewsBlocked,
    highestLeverage: topTool
      ? {
          /**
           * Names the field that actually gates these rules. Lifecycle is
           * deliberately not named: it gates the lifecycle views and nothing
           * else (see rulePublicationStatus), so recommending it here would
           * send a reviewer to read the evidence, record a decision, and
           * publish nothing.
           */
          action: toolProvidesDestination(tools.get(topTool[0]))
            // Destination already reviewed, so what remains is the rules.
            ? `Review the ${plural(topTool[1], 'unpublished rule')} targeting "${topTool[0]}"`
            : `Review the reader-facing destination for "${topTool[0]}" (${DESTINATION_FIELDS.join(' + ')})`,
          unlocks: `${plural(topTool[1], 'blocked rule')} across ${plural(
            topJourneys,
            'journey',
          )} depend on it — more than any other single tool.`,
        }
      : null,
  };
}

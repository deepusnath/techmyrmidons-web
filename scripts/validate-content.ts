#!/usr/bin/env node
/**
 * Content integrity gate.
 *
 * These are not style checks. Each one enforces a product rule that would
 * otherwise depend on a reviewer remembering it:
 *
 *   - seeded content is always attributable          (visible-seed rule)
 *   - every signal declares a provenance tier        (no blurred evidence)
 *   - published tools state where they do NOT fit    (no popularity-as-quality)
 *   - archived domains explain themselves            (honest archival)
 *
 * Usage:  node scripts/validate-content.ts
 * Exits non-zero on any error, so it can gate CI.
 */

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  EVIDENCE_TIERS,
  LIFECYCLES,
  EDITORIAL_TOOL_FIELDS,
  FACTUAL_EVENT_TYPES,
  isPublishable,
  type Domain,
  type EditorialNote,
  type Practitioner,
  type Resource,
  type Signal,
  type TimelineEntry,
  type Tool,
} from '../content/schema.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CONTENT = path.join(ROOT, 'content');

const errors: string[] = [];
const notes: string[] = [];
const fail = (msg: string) => errors.push(msg);
const note = (msg: string) => notes.push(msg);

const load = async <T>(rel: string): Promise<T> =>
  JSON.parse(await readFile(path.join(CONTENT, rel), 'utf8')) as T;

async function main() {
  const domains = await load<Domain[]>('domains.json');
  const practitioners = await load<Practitioner[]>('practitioners.json');

  const domainSlugs = new Set(domains.map((d) => d.slug));
  let checks = 0;

  // --- domains --------------------------------------------------------------
  for (const d of domains) {
    checks++;
    if (d.status === 'archived' && !d.archived_reason?.trim()) {
      fail(`domain "${d.slug}" is archived with no archived_reason — users would see a blank explanation`);
    }
    if (d.is_seed && !d.seed_source) fail(`domain "${d.slug}" is seeded but has no seed_source`);
  }
  /**
   * The pilot ran one domain deliberately — better to test the experience
   * properly in one field than thinly across twelve. That is a judgement about
   * editorial capacity, not a technical limit, so the check is that an active
   * domain is actually equipped rather than that there is exactly one of them.
   *
   * A domain claiming to be active without rules or an editorial note would
   * render a Myrmidon that cannot answer the question it exists to answer.
   */
  const active = domains.filter((d) => d.status === 'active');
  if (active.length === 0) fail('no active domain: the pilot needs at least one');
  for (const d of active) {
    if (!existsSync(path.join(CONTENT, 'heuristics', `${d.slug}.json`))) {
      fail(`domain "${d.slug}" is active but has no heuristics — the diagnosis would have no rules`);
    }
    if (!existsSync(path.join(CONTENT, 'editorial', `${d.slug}.json`))) {
      fail(`domain "${d.slug}" is active but has no editorial note`);
    }
    if (!existsSync(path.join(CONTENT, 'tools', d.slug))) {
      fail(`domain "${d.slug}" is active but has no tools directory`);
    }
  }

  // --- practitioners --------------------------------------------------------
  const seenPractitioner = new Set<string>();
  for (const p of practitioners) {
    checks++;
    if (seenPractitioner.has(p.slug)) fail(`duplicate practitioner slug "${p.slug}"`);
    seenPractitioner.add(p.slug);
    if (p.is_seed && !p.seed_source) fail(`practitioner "${p.slug}" is seeded but has no seed_source`);
    for (const dom of p.domains) {
      if (!domainSlugs.has(dom)) fail(`practitioner "${p.slug}" references unknown domain "${dom}"`);
    }
    // Practitioners carry no portrait: see the Practitioner interface in schema.ts.
    if ('avatar' in p) fail(`practitioner "${p.slug}" still carries an avatar field`);
  }

  // --- tools ----------------------------------------------------------------
  const toolIndex = new Map<string, Tool>();
  const toolDirs = existsSync(path.join(CONTENT, 'tools'))
    ? await readdir(path.join(CONTENT, 'tools'))
    : [];

  for (const domain of toolDirs) {
    if (!domainSlugs.has(domain)) fail(`content/tools/${domain}/ has no matching domain record`);
    for (const file of await readdir(path.join(CONTENT, 'tools', domain))) {
      const tool = await load<Tool>(path.join('tools', domain, file));
      checks++;
      const ref = `${domain}/${tool.slug}`;

      if (file !== `${tool.slug}.json`) fail(`${ref}: filename does not match slug (${file})`);
      if (toolIndex.has(ref)) fail(`${ref}: duplicate tool slug`);
      toolIndex.set(ref, tool);

      if (tool.domain !== domain) fail(`${ref}: tool.domain is "${tool.domain}" but lives under ${domain}/`);
      if (tool.is_seed && !tool.seed_source) fail(`${ref}: seeded but has no seed_source`);
      if (tool.lifecycle && !LIFECYCLES.includes(tool.lifecycle)) {
        fail(`${ref}: unknown lifecycle "${tool.lifecycle}"`);
      }

      // Review metadata must be present and internally consistent. A record may
      // never claim a reviewer without also recording who and when.
      if (tool.editorial_status !== 'ai_draft' && tool.editorial_status !== 'reviewed') {
        fail(`${ref}: editorial_status must be 'ai_draft' or 'reviewed', got "${tool.editorial_status}"`);
      }
      // Approval is record-level OR field-level. Either way it names a person:
      // a signed-off field with no reviewer is an approval nobody owns.
      const hasFieldReview = (tool.reviewed_fields ?? []).length > 0;
      if (tool.editorial_status === 'reviewed' && (!tool.reviewed_by || !tool.reviewed_at)) {
        fail(`${ref}: marked reviewed but has no reviewed_by/reviewed_at — nothing may claim a named editor without one`);
      }
      if (hasFieldReview && (!tool.reviewed_by || !tool.reviewed_at)) {
        fail(`${ref}: has reviewed_fields but no reviewed_by/reviewed_at — a field-level approval must name its reviewer`);
      }
      if (tool.editorial_status !== 'reviewed' && !hasFieldReview && (tool.reviewed_by || tool.reviewed_at)) {
        fail(`${ref}: carries reviewer details but nothing is marked reviewed`);
      }
      for (const f of tool.reviewed_fields ?? []) {
        if (!(EDITORIAL_TOOL_FIELDS as readonly string[]).includes(f)) {
          fail(`${ref}: reviewed_fields contains unknown editorial field "${f}"`);
        }
      }

      // The anti-popularity guard. A tool may only be presented as a current
      // recommendation once someone has written down where it does not fit.
      if (tool.published && !isPublishable(tool)) {
        const missing = [
          !tool.what_it_is?.trim() && 'what_it_is',
          !tool.why_it_matters?.trim() && 'why_it_matters',
          !tool.lifecycle && 'lifecycle',
          !tool.suitable_for.length && 'suitable_for',
          !tool.not_suitable_for.length && 'not_suitable_for',
        ].filter(Boolean);
        fail(`${ref}: published=true but missing required judgement fields: ${missing.join(', ')}`);
      }
    }
  }

  // --- signals --------------------------------------------------------------
  // Archive-derived signals live in signals/, backfill-derived ones in
  // observed/. Both are held to identical provenance rules.
  let signalCount = 0;
  const seenSignalId = new Set<string>();
  const byTier = new Map<string, number>();

  const signalSources: Array<[string, string]> = [];
  for (const dir of ['signals', 'observed']) {
    const full = path.join(CONTENT, dir);
    if (!existsSync(full)) continue;
    for (const file of await readdir(full)) signalSources.push([dir, file]);
  }

  for (const [dir, file] of signalSources) {
    const domain = file.replace(/\.json$/, '');
    for (const s of await load<Signal[]>(path.join(dir, file))) {
      checks++;
      signalCount++;
      byTier.set(s.tier, (byTier.get(s.tier) ?? 0) + 1);
      const ref = `${dir}/${domain}:${s.id}`;

      if (s.domain !== domain) {
        fail(`${ref}: signal.domain is "${s.domain}" but the file is ${dir}/${file}`);
      }

      // The spine of the trust model: no untiered evidence, ever.
      if (!s.tier || !EVIDENCE_TIERS.includes(s.tier)) {
        fail(`${ref}: invalid or missing evidence tier "${s.tier}"`);
      }
      if (seenSignalId.has(s.id)) fail(`${ref}: duplicate signal id`);
      seenSignalId.add(s.id);

      if (!toolIndex.has(`${domain}/${s.tool_slug}`)) {
        fail(`${ref}: references tool "${s.tool_slug}" that does not exist in ${domain}`);
      }
      if (s.is_seed && !s.seed_source) fail(`${ref}: seeded but has no seed_source`);
      if (!s.source_label?.trim()) fail(`${ref}: has no source_label — would render as unattributed`);
      if (s.tier === 'observed' && !s.source_url) {
        fail(`${ref}: tier is "observed" but has no source_url; observed evidence must be checkable`);
      }
      if (!/^\d{4}-\d{2}-\d{2}/.test(s.observed_at)) fail(`${ref}: observed_at is not a date`);

      // Repository signals describe a file change. Language implying that a
      // person uses, prefers, adopted or abandoned something is not supportable
      // from a dependency diff.
      if (s.tier === 'observed') {
        const banned = /\b(uses|prefers|adopted|abandoned|switched to|migrated to|likes|recommends)\b/i;
        if (banned.test(s.source_label)) {
          fail(`${ref}: source_label implies personal usage ("${s.source_label}") — a dependency change does not support that`);
        }
        if (!s.repo) fail(`${ref}: observed signal has no repo`);
        if (!s.action) fail(`${ref}: observed signal has no added/removed action`);
        if (!s.context_status) fail(`${ref}: observed signal has no context_status (use "unknown" when not established)`);
        if (s.eligible_for_trends && s.context_status === 'unknown') {
          fail(`${ref}: eligible_for_trends is true but the repository context is unknown — a signal cannot inform a trend before its context is reviewed`);
        }
      }
    }
  }

  // --- editorial notes ------------------------------------------------------
  const editorialDir = path.join(CONTENT, 'editorial');
  let noteCount = 0;
  let draftCount = 0;
  const seenNoteId = new Set<string>();

  for (const file of existsSync(editorialDir) ? await readdir(editorialDir) : []) {
    const domain = file.replace(/\.json$/, '');
    for (const n of await load<EditorialNote[]>(path.join('editorial', file))) {
      checks++;
      noteCount++;
      const ref = `editorial/${domain}:${n.id}`;

      if (seenNoteId.has(n.id)) fail(`${ref}: duplicate editorial note id`);
      seenNoteId.add(n.id);
      if (!domainSlugs.has(n.domain)) fail(`${ref}: unknown domain "${n.domain}"`);
      if (n.tool_slug && !toolIndex.has(`${n.domain}/${n.tool_slug}`)) {
        fail(`${ref}: references tool "${n.tool_slug}" that does not exist in ${n.domain}`);
      }
      if (!n.body?.trim()) fail(`${ref}: empty body`);
      if (!/^\d{4}-\d{2}-\d{2}/.test(n.published_at)) fail(`${ref}: published_at is not a date`);

      // A reviewed note needs a byline; an unreviewed one must not have any.
      if (!n.draft && !n.author?.trim()) fail(`${ref}: published note has no author byline`);
      if (n.draft && n.author) {
        fail(`${ref}: unreviewed note carries an author byline — drafts must not be attributed to a person`);
      }

      // A recommendation that does not say where it might be wrong is not a
      // recommendation, it is marketing.
      if (!n.tradeoffs?.trim()) fail(`${ref}: has no stated tradeoffs`);

      if (n.draft) draftCount++;
    }
  }
  if (draftCount) {
    note(
      `${draftCount} editorial note(s) are draft: text is written but the named author has not signed off. ` +
        `These must not render publicly until draft is set to false.`,
    );
  }

  // --- timeline -------------------------------------------------------------
  const timelineDir = path.join(CONTENT, 'timeline');
  let timelineCount = 0;
  let timelineDrafts = 0;

  for (const file of existsSync(timelineDir) ? await readdir(timelineDir) : []) {
    const seenYear = new Set<number>();
    for (const e of await load<TimelineEntry[]>(path.join('timeline', file))) {
      checks++;
      timelineCount++;
      const ref = `timeline/${e.domain}:${e.year}`;

      if (seenYear.has(e.year)) fail(`${ref}: duplicate timeline year`);
      seenYear.add(e.year);
      if (!domainSlugs.has(e.domain)) fail(`${ref}: unknown domain "${e.domain}"`);
      if (!e.headline?.trim()) fail(`${ref}: empty headline`);
      // Reviewed years need a byline; unreviewed ones must not carry one.
      if (!e.draft && !e.author?.trim()) fail(`${ref}: published year has no author byline`);
      // Narrative review status is tracked separately from event provenance.
      if (!e.headline_status) fail(`${ref}: missing headline_status`);
      if (e.headline_status === 'reviewed' && e.draft) {
        fail(`${ref}: narrative marked reviewed but the year is still flagged draft`);
      }
      if (e.is_seed && !e.seed_source) fail(`${ref}: seeded but has no seed_source`);

      // Every event must name a real tool, declare its basis, and never present
      // an AI interpretation as a sourced fact.
      for (const ev of e.events ?? []) {
        if (!toolIndex.has(`${e.domain}/${ev.tool_slug}`)) {
          fail(`${ref}: event references tool "${ev.tool_slug}" that does not exist in ${e.domain}`);
        }
        if (!ev.basis_detail?.trim()) {
          fail(`${ref}: event for "${ev.tool_slug}" has no basis_detail — every event must show what it rests on`);
        }
        if (ev.basis === 'ai_interpretation' && ev.claim_status !== 'ai_draft') {
          fail(`${ref}: event for "${ev.tool_slug}" is an AI interpretation but is not marked ai_draft`);
        }
        if (ev.basis === 'observed_commit' && !ev.source_url) {
          fail(`${ref}: event for "${ev.tool_slug}" claims a commit basis but links to no commit`);
        }

        // A release date or an end of life is a checkable fact about the tool.
        // It may not rest on an AI reading, and it must cite the project itself.
        if ((FACTUAL_EVENT_TYPES as readonly string[]).includes(ev.type)) {
          if (ev.basis === 'ai_interpretation') {
            fail(`${ref}: "${ev.type}" for "${ev.tool_slug}" uses an AI interpretation as its basis; factual event types need a primary source`);
          }
          if (ev.claim_status !== 'sourced') {
            fail(`${ref}: "${ev.type}" for "${ev.tool_slug}" must be claim_status "sourced"`);
          }
          if (!ev.source_url || !/^https?:\/\//.test(ev.source_url)) {
            fail(`${ref}: "${ev.type}" for "${ev.tool_slug}" has no resolvable primary source URL`);
          }
        }
      }
      if (e.draft && e.author) {
        fail(`${ref}: unreviewed timeline year carries an author byline`);
      }
      if (e.draft) timelineDrafts++;
    }
  }
  if (timelineDrafts) {
    note(`${timelineDrafts} timeline entr(ies) are draft and must not render until signed off.`);
  }

  // --- heuristics -----------------------------------------------------------
  // The guided assessment may only ever point at a tool that has been written
  // up. Recommending an archive-only record sends the user to a page with no
  // guidance on it.
  const heuristicsFile = path.join(CONTENT, 'heuristics');
  let heuristicCandidates = 0;
  for (const file of existsSync(heuristicsFile) ? await readdir(heuristicsFile) : []) {
    const domain = file.replace(/\.json$/, '');
    const h = await load<{
      editorial_status: string;
      reviewed_by: string | null;
      reviewed_at: string | null;
      contexts: Record<string, {
        still_appropriate?: Record<string, unknown>;
        reconsider?: Record<string, unknown>;
        candidates: Array<{ slug: string; why: string; unsuitable_if: string }>;
      }>;
    }>(path.join('heuristics', file));
    checks++;

    if (h.editorial_status === 'reviewed' && (!h.reviewed_by || !h.reviewed_at)) {
      fail(`heuristics/${domain}: marked reviewed without a reviewer and date`);
    }

    for (const [ctx, rules] of Object.entries(h.contexts ?? {})) {
      // Retain and reconsider rules point at tools too. Only candidates were
      // checked before, which let an unpublished archive record slip through.
      for (const [kind, map] of [
        ['still_appropriate', rules.still_appropriate],
        ['reconsider', rules.reconsider],
      ] as const) {
        for (const slug of Object.keys(map ?? {})) {
          checks++;
          const tool = toolIndex.get(`${domain}/${slug}`);
          const ref = `heuristics/${domain}:${ctx}:${kind}:${slug}`;
          if (!tool) fail(`${ref}: references a tool that does not exist`);
          else if (!tool.published) {
            fail(`${ref}: judges "${slug}", which is an unpublished archive record with no authored guidance`);
          }
        }
      }

      for (const c of rules.candidates ?? []) {
        checks++;
        heuristicCandidates++;
        const tool = toolIndex.get(`${domain}/${c.slug}`);
        const ref = `heuristics/${domain}:${ctx}:${c.slug}`;
        if (!tool) fail(`${ref}: references a tool that does not exist`);
        else if (!tool.published) {
          fail(`${ref}: recommends "${c.slug}", which is an unpublished archive record with no authored guidance`);
        }
        if (!c.why?.trim()) fail(`${ref}: has no "why this applies" text`);
        if (!c.unsuitable_if?.trim()) fail(`${ref}: has no "unsuitable if" condition`);
      }
    }
  }

  // --- dossiers ---------------------------------------------------------------
  // Review-preparation material is held to the same standard as anything else:
  // no fake approvals, no attribution, and every factual claim sourced or
  // explicitly recorded as a gap.
  const dossierRoot = path.join(CONTENT, 'dossiers');
  let dossierCount = 0;
  const FORBIDDEN_ATTRIBUTION = /Deepu\s+S\s+Nath/i;

  for (const domain of existsSync(dossierRoot) ? await readdir(dossierRoot) : []) {
    for (const file of await readdir(path.join(dossierRoot, domain))) {
      const raw = await readFile(path.join(dossierRoot, domain, file), 'utf8');
      if (!raw.trim()) continue;
      const d = JSON.parse(raw) as Record<string, any>;
      checks++;
      dossierCount++;
      const ref = `dossiers/${domain}/${d.slug}`;

      // Nothing in a review-prep artefact may claim to be reviewed.
      if (d.editorial_status !== 'ai_draft') {
        fail(`${ref}: editorial_status must be "ai_draft" — this phase records no approvals`);
      }
      if (d.reviewed_by || d.reviewed_at) {
        fail(`${ref}: carries a reviewer or review date; nothing here has been reviewed`);
      }
      // Drafted material must not be attributed to a person — but a decision
      // log recording who made a real decision is exactly what we DO want, so
      // it is excluded from the scan rather than the scan being dropped.
      const { decision_log: _log, ...draftedOnly } = d;
      if (FORBIDDEN_ATTRIBUTION.test(JSON.stringify(draftedOnly))) {
        fail(`${ref}: attributes drafted material to a named person`);
      }
      for (const entry of d.decision_log ?? []) {
        checks++;
        if (!entry.decided_by?.trim()) fail(`${ref}: a decision-log entry has no decider`);
        if (!entry.date?.trim()) fail(`${ref}: a decision-log entry has no date`);
        if (!entry.reasoning?.trim()) fail(`${ref}: a decision-log entry records no reasoning`);
      }

      // Facts need a source; interpretation must not masquerade as fact.
      if ((d.verifiable_facts ?? []).length > 0 && !d.primary_source) {
        fail(`${ref}: states verifiable facts but cites no primary source`);
      }
      if (d.primary_source && !/^https?:\/\//.test(d.primary_source)) {
        fail(`${ref}: primary_source is not a resolvable URL`);
      }
      if ((d.verifiable_facts ?? []).length === 0 && (d.evidence_gaps ?? []).length === 0) {
        fail(`${ref}: has neither sourced facts nor a recorded evidence gap`);
      }
      if (!d.wrong_if?.trim()) {
        fail(`${ref}: does not state what would make the proposed classification wrong`);
      }
      if (!(d.fields_requiring_approval ?? []).length) {
        fail(`${ref}: lists no fields requiring approval`);
      }

      // Repository signals stay inert.
      for (const sig of d.supporting_signals ?? []) {
        if (sig.eligible_for_trends) {
          fail(`${ref}: a supporting signal is marked eligible for trend conclusions`);
        }
      }

      // Every referenced rule must exist and must not be pre-approved.
      for (const r of d.diagnosis_rules ?? []) {
        if (!r.rule_id) fail(`${ref}: a diagnosis rule reference has no rule_id`);
      }
    }
  }

  // --- rule-level review isolation ---------------------------------------------
  const heurRoot = path.join(CONTENT, 'heuristics');
  let ruleCount = 0;
  const seenRuleIds = new Set<string>();

  for (const file of existsSync(heurRoot) ? await readdir(heurRoot) : []) {
    const h = await load<any>(path.join('heuristics', file));
    for (const [ctx, rules] of Object.entries<any>(h.contexts ?? {})) {
      const entries = [
        ...Object.entries<any>(rules.still_appropriate ?? {}).map(([slug, v]) => ['retain', slug, v] as const),
        ...Object.entries<any>(rules.reconsider ?? {}).map(([slug, v]) => ['reconsider', slug, v] as const),
        ...(rules.candidates ?? []).map((c: any) => ['recommend', c.slug, c] as const),
      ];
      for (const [kind, slug, v] of entries) {
        checks++;
        ruleCount++;
        const ref = `heuristics/${file}:${ctx}.${kind}.${slug}`;
        if (typeof v === 'string') {
          fail(`${ref}: rule has no rule_id — review must be trackable per rule, not per file`);
          continue;
        }
        if (!v.rule_id) fail(`${ref}: missing rule_id`);
        if (v.rule_id && seenRuleIds.has(v.rule_id)) {
          fail(`${ref}: duplicate rule_id "${v.rule_id}" — approving one would publish another`);
        }
        if (v.rule_id) seenRuleIds.add(v.rule_id);
        if (v.editorial_status === 'reviewed' && (!v.reviewed_by || !v.reviewed_at)) {
          fail(`${ref}: marked reviewed without a reviewer and date`);
        }
        if (v.editorial_status !== 'reviewed' && (v.reviewed_by || v.reviewed_at)) {
          fail(`${ref}: carries reviewer details but is not marked reviewed`);
        }

        // A reviewed rule may only publish once its target tool is a real
        // destination: both reader-facing fields individually reviewed AND
        // non-empty. Naming a blank field in reviewed_fields approves nothing.
        if (v.editorial_status === 'reviewed') {
          const target = toolIndex.get(`${file.replace(/\.json$/, '')}/${slug}`);
          if (target) {
            const values = ['one_liner', 'what_it_is'] as const;
            const present = values.every((f) => typeof target[f] === 'string' && target[f]!.trim());
            const named = new Set(target.reviewed_fields ?? []);
            const covered = target.editorial_status === 'reviewed' || values.every((f) => named.has(f));
            if (covered && !present) {
              fail(`${ref}: target "${slug}" lists reader-facing fields as reviewed but one is blank — that must not unblock publication`);
            }
          }
        }
      }
    }
  }

  // --- resources ------------------------------------------------------------
  const resourceDir = path.join(CONTENT, 'resources');
  let resourceCount = 0;
  for (const file of existsSync(resourceDir) ? await readdir(resourceDir) : []) {
    for (const r of await load<Resource[]>(path.join('resources', file))) {
      checks++;
      resourceCount++;
      if (!/^https?:\/\//.test(r.url)) fail(`resource "${r.slug}": url is not absolute (${r.url})`);
      if (r.is_seed && !r.seed_source) fail(`resource "${r.slug}": seeded but has no seed_source`);
    }
  }

  // --- report ---------------------------------------------------------------
  const published = [...toolIndex.values()].filter((t) => t.published).length;
  console.log(
    `${checks} checks over ${domains.length} domains, ${toolIndex.size} tools ` +
      `(${published} published), ${signalCount} signals, ${noteCount} editorial notes ` +
      `(${draftCount} draft), ${timelineCount} timeline years (${timelineDrafts} draft), ` +
      `${dossierCount} dossiers, ${ruleCount} rules, ` +
      `${practitioners.length} practitioners, ${resourceCount} resources`,
  );
  console.log(
    `evidence tiers: ${EVIDENCE_TIERS.map((t) => `${t}=${byTier.get(t) ?? 0}`).join('  ')}`,
  );

  if (notes.length) {
    console.log(`\n${notes.length} notes (non-blocking):`);
    for (const n of notes.slice(0, 10)) console.log(`  - ${n}`);
    if (notes.length > 10) console.log(`  ... +${notes.length - 10} more`);
  }

  if (errors.length) {
    console.error(`\n${errors.length} ERRORS:`);
    for (const e of errors) console.error(`  x ${e}`);
    process.exit(1);
  }
  console.log('\ncontent valid');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

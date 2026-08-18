#!/usr/bin/env node
/**
 * Build editorial review dossiers for the priority tool set.
 *
 * Most of a dossier is *derived* — the tool record, the rules that depend on it,
 * its relationships and its existing signals all already exist, and deriving
 * them means the dossier cannot drift from what the product actually uses.
 *
 * The authored part is deliberately small and lives in DOSSIER_EVIDENCE below:
 * a verified primary source, the facts that source establishes, and the
 * conditions under which the proposed classification would be wrong.
 *
 * Nothing here marks anything reviewed. Every dossier lands with
 * editorial_status "ai_draft", no reviewer and no date.
 *
 * Usage: node scripts/build-dossiers.ts
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CONTENT = path.join(ROOT, 'content');
const DOMAIN = 'frontend';

/**
 * Authored evidence, one entry per priority tool.
 *
 * `primary_source` was verified to resolve at build time. `facts` are claims
 * the source itself establishes. `interpretation` is editorial reading that the
 * source does NOT establish. `gaps` are things nobody has evidence for.
 * `wrong_if` states what would falsify the proposed lifecycle.
 */
const DOSSIER_EVIDENCE: Record<
  string,
  {
    primary_source: string;
    facts: string[];
    interpretation: string[];
    gaps: string[];
    wrong_if: string;
    confidence: 'high' | 'medium' | 'low';
  }
> = {
  typescript: {
    primary_source: 'https://www.typescriptlang.org/docs/',
    facts: ['Actively maintained by Microsoft; official documentation is current.', 'Compiles to JavaScript with types erased at build time.'],
    interpretation: ['That it is "effectively expected" on team-maintained applications.', 'That editor tooling, not bug-catching, is its main payoff.'],
    gaps: ['No measured adoption evidence in this product. The claim that it is a default rests on editorial judgement alone.'],
    wrong_if: 'A reviewer judges that its cost is understated for teams without type-system experience, or that "expected" overstates what the evidence supports.',
    confidence: 'high',
  },
  vite: {
    primary_source: 'https://vite.dev/guide/',
    facts: ['Serves source over native ES modules in development and bundles with Rollup for production, per its own guide.', 'Actively maintained; documentation is current.'],
    interpretation: ['That it is "the current default build tool".', 'That dev-server startup time is the dominant daily cost it removes.'],
    gaps: ['No measured evidence that it is the default. Repository signals exist but are ineligible for trend conclusions.'],
    wrong_if: 'A reviewer judges "default" to be an adoption claim requiring representative evidence this product does not have.',
    confidence: 'medium',
  },
  sass: {
    primary_source: 'https://sass-lang.com/documentation/',
    facts: ['Actively maintained. The documentation records that @import is deprecated in favour of @use.'],
    interpretation: ['That native CSS has absorbed most of what people reached for it to do.', 'Classification as established rather than declining.'],
    gaps: ['No evidence about how much Sass usage is legacy maintenance versus new authoring.'],
    wrong_if: 'A reviewer judges the deprecation of @import and the growth of native CSS nesting to make "declining" the more honest classification.',
    confidence: 'medium',
  },
  tailwind: {
    primary_source: 'https://tailwindcss.com/docs',
    facts: ['Actively maintained utility-first CSS framework; requires a build step that removes unused classes.'],
    interpretation: ['That the objection to it "lost on practical grounds".', 'That it is the tool most often missed by developers who have drifted.'],
    gaps: ['The "most often missed" framing has no supporting evidence of any kind and is pure assertion.'],
    wrong_if: 'A reviewer objects that "lost" presents a contested design argument as settled.',
    confidence: 'medium',
  },
  bootstrap: {
    primary_source: 'https://getbootstrap.com/docs/',
    facts: ['Actively maintained. Recent versions removed the jQuery dependency and use flexbox and CSS grid.'],
    interpretation: ['That un-customised Bootstrap products "look like one another".', 'Classification as established.'],
    gaps: ['No evidence on how much current Bootstrap use is new work versus maintenance.'],
    wrong_if: 'A reviewer judges the visual-sameness claim to be an unsupported aesthetic assertion that should be cut.',
    confidence: 'medium',
  },
  'claude-code': {
    primary_source: 'https://docs.claude.com/en/docs/claude-code/overview',
    facts: ['Official documentation describes a terminal-based agentic coding tool that reads and edits files and runs commands.'],
    interpretation: ['Classification as emerging.', 'That delegation rather than completion is the meaningful distinction.'],
    gaps: ['No adoption evidence. It appears in no dependency manifest by nature, so repository signals cannot cover it at all.'],
    wrong_if: 'A reviewer judges that this product should not carry entries for tools it cannot evidence, or objects to the disclosed conflict below.',
    confidence: 'low',
  },
  jquery: {
    primary_source: 'https://api.jquery.com/',
    facts: ['Still maintained and documented; the API reference is current.'],
    interpretation: ['That most of its uses are now covered by native DOM APIs.', 'Classification as legacy.'],
    gaps: ['No evidence for how much of the web still depends on it, which the "legacy" call implicitly leans on.'],
    wrong_if: 'A reviewer judges "legacy" too strong for a project still actively maintained, and prefers "declining".',
    confidence: 'medium',
  },
  react: {
    primary_source: 'https://react.dev/learn',
    facts: ['Actively maintained; official documentation covers hooks and server components.'],
    interpretation: ['That it is "close to mandatory" to understand.', 'That it has the largest hiring pool.'],
    gaps: ['The hiring-pool claim is an employment-market assertion with no source in this product.'],
    wrong_if: 'A reviewer requires the hiring claim to be sourced or removed.',
    confidence: 'medium',
  },
  webpack: {
    primary_source: 'https://webpack.js.org/concepts/',
    facts: ['Actively maintained and documented.'],
    interpretation: ['Classification as declining.', 'That cold-start time became the dominant cost.'],
    gaps: ['"Declining" is an adoption-trajectory word with no representative evidence behind it.'],
    wrong_if: 'A reviewer holds that trajectory words require measured, representative evidence — in which case this must revert to established or be withheld.',
    confidence: 'low',
  },
  angularjs: {
    primary_source: 'https://docs.angularjs.org/misc/version-support-status',
    facts: ['The project\'s own support-status page records that long-term support ended; it receives no further patches.'],
    interpretation: ['That its remaining value is diagnostic — recognising it dates a codebase.'],
    gaps: ['None material. This is the best-evidenced record in the set.'],
    wrong_if: 'The cited support-status page is superseded or its date is misread.',
    confidence: 'high',
  },
  bower: {
    primary_source: 'https://bower.io/',
    facts: ['The project\'s own homepage recommends users migrate to other solutions.'],
    interpretation: ['That the registry is "effectively frozen" and no security advisories will reach users.'],
    gaps: ['The security-advisory claim is not directly evidenced by the cited page.'],
    wrong_if: 'A reviewer requires the advisory claim to be separately sourced or softened.',
    confidence: 'high',
  },
  grunt: {
    primary_source: 'https://gruntjs.com/getting-started',
    facts: ['Documentation remains available; the project describes itself as a task runner.'],
    interpretation: ['Classification as legacy.', 'That bundlers absorbed the category.'],
    gaps: ['No evidence of current maintenance cadence was gathered.'],
    wrong_if: 'A reviewer finds the project is still actively released, making "legacy" inaccurate.',
    confidence: 'medium',
  },
  playwright: {
    primary_source: 'https://playwright.dev/docs/intro',
    facts: ['Official docs describe cross-browser automation across Chromium, Firefox and WebKit, with auto-waiting and trace viewing.'],
    interpretation: ['That it "has become the default for new E2E work".'],
    gaps: ['The default claim is an adoption assertion with no representative evidence.'],
    wrong_if: 'A reviewer requires adoption language to be dropped, leaving only the sourced capability description.',
    confidence: 'medium',
  },
  'styled-components': {
    primary_source: 'https://styled-components.com/docs',
    facts: ['Official docs describe runtime generation and injection of styles via tagged template literals.'],
    interpretation: ['Classification as declining.', 'That it "interacts badly" with server components.'],
    gaps: ['No sourced statement about its maintenance status or the server-component interaction.'],
    wrong_if: 'A reviewer judges the server-rendering claim needs a specific source, or that maintenance status contradicts "declining".',
    confidence: 'low',
  },
  astro: {
    primary_source: 'https://docs.astro.build/en/getting-started/',
    facts: ['Official docs state it ships zero JavaScript by default and hydrates components explicitly marked as interactive.'],
    interpretation: ['That it is "the right default for content".', 'Classification as established.'],
    gaps: ['No evidence about adoption maturity to support "established" over "emerging".'],
    wrong_if: 'A reviewer judges it too young for "established" given the alternatives it competes with.',
    confidence: 'medium',
  },
  'css-modules': {
    primary_source: 'https://github.com/css-modules/css-modules',
    facts: ['The official repository documents build-time local scoping of class names.'],
    interpretation: ['That it "has aged unusually well".', 'Classification as established.'],
    gaps: ['Repository activity was not assessed; the specification is relatively static.'],
    wrong_if: 'A reviewer finds the project effectively unmaintained, making "established" misleading.',
    confidence: 'medium',
  },
  cursor: {
    primary_source: 'https://cursor.com/docs',
    facts: ['Official docs describe a VS Code-derived editor with codebase-aware chat and multi-file edits.'],
    interpretation: ['Classification as established.', 'That editor-integrated assistance beats extension-based assistance.'],
    gaps: ['No adoption evidence; invisible to manifest-based signals by nature.'],
    wrong_if: 'A reviewer judges "established" unsupportable for a tool this recent with no adoption evidence.',
    confidence: 'low',
  },
  figma: {
    primary_source: 'https://help.figma.com/hc/en-us',
    facts: ['Official help centre documents collaborative browser-based design, components and developer inspection.'],
    interpretation: ['That it is "where most frontend work originates".'],
    gaps: ['The origination claim is unsupported and arguably overstated.'],
    wrong_if: 'A reviewer cuts the origination claim as unevidenced.',
    confidence: 'medium',
  },
  gulp: {
    primary_source: 'https://gulpjs.com/docs/en/getting-started/quick-start',
    facts: ['Official docs describe a streaming task runner configured in JavaScript.'],
    interpretation: ['Classification as legacy.'],
    gaps: ['Current maintenance cadence not assessed.'],
    wrong_if: 'A reviewer finds active releases making "legacy" inaccurate.',
    confidence: 'medium',
  },
  htmx: {
    primary_source: 'https://htmx.org/docs/',
    facts: ['Official docs describe issuing requests and swapping HTML fragments via element attributes.'],
    interpretation: ['Classification as emerging.', 'That many teams adopted SPA architecture without needing it.'],
    gaps: ['The "did not need it" claim is a strong architectural opinion with no evidence base.'],
    wrong_if: 'A reviewer judges the architectural claim too editorialised for a tool card.',
    confidence: 'medium',
  },
  jest: {
    primary_source: 'https://jestjs.io/docs/getting-started',
    facts: ['Official docs describe a test runner with its own transform pipeline, assertions, mocking and coverage.'],
    interpretation: ['Classification as declining.'],
    gaps: ['No representative evidence for declining use.'],
    wrong_if: 'A reviewer requires trajectory claims to be evidenced, reverting this to established.',
    confidence: 'low',
  },
  nextjs: {
    primary_source: 'https://nextjs.org/docs',
    facts: ['Official docs describe file-based routing, server rendering and the App Router built on React server components.'],
    interpretation: ['That its rendering model is "genuinely complicated".', 'That its deployment story favours one vendor.'],
    gaps: ['The vendor claim is contested and unsourced here.'],
    wrong_if: 'A reviewer judges the vendor observation inappropriate without a citation.',
    confidence: 'medium',
  },
  npm: {
    primary_source: 'https://docs.npmjs.com/',
    facts: ['Official docs describe the registry and CLI bundled with Node.js, including workspaces and lockfiles.'],
    interpretation: ['That install time and disk duplication are its notable weaknesses.'],
    gaps: ['No measurement of those weaknesses is provided.'],
    wrong_if: 'A reviewer wants the performance characterisation quantified or removed.',
    confidence: 'high',
  },
  pnpm: {
    primary_source: 'https://pnpm.io/motivation',
    facts: ['Official docs describe a content-addressed store, hard-linking, and a strict non-flat node_modules layout.'],
    interpretation: ['That strictness matters more than the disk saving.'],
    gaps: ['No evidence about how often the strictness actually catches a real bug.'],
    wrong_if: 'A reviewer judges the strictness emphasis to be personal preference rather than editorial guidance.',
    confidence: 'high',
  },
  storybook: {
    primary_source: 'https://storybook.js.org/docs',
    facts: ['Official docs describe isolated component rendering with controllable props, plus testing integrations.'],
    interpretation: ['That an abandoned Storybook is worse than none.'],
    gaps: ['No evidence on maintenance burden in practice.'],
    wrong_if: 'A reviewer judges the "worse than none" line too strong to state without evidence.',
    confidence: 'medium',
  },
  'tanstack-query': {
    primary_source: 'https://tanstack.com/query/latest/docs/framework/react/overview',
    facts: ['Official docs describe caching, deduplication, background refetching and stale-while-revalidate for server state.'],
    interpretation: ['That most "state management" was really a poorly implemented cache.'],
    gaps: ['The claim about what teams were doing is an assertion about industry practice with no evidence.'],
    wrong_if: 'A reviewer requires the industry-practice claim to be removed or attributed.',
    confidence: 'medium',
  },
  'testing-library': {
    primary_source: 'https://testing-library.com/docs/',
    facts: ['Official docs describe querying by accessible role, label and text rather than implementation details.'],
    interpretation: ['That implementation-coupled tests "get deleted".', 'That role queries surface accessibility problems.'],
    gaps: ['The deletion claim is anecdotal.'],
    wrong_if: 'A reviewer wants the anecdotal claim softened.',
    confidence: 'high',
  },
  vitest: {
    primary_source: 'https://vitest.dev/guide/',
    facts: ['Official docs state it reuses the project Vite configuration and offers a Jest-compatible API.'],
    interpretation: ['That there is "very little argument" for running Jest alongside Vite.'],
    gaps: ['Migration cost is asserted to be small without evidence.'],
    wrong_if: 'A reviewer judges the migration-cost claim unsupported.',
    confidence: 'high',
  },
};

/** Tools where the author has a disclosable interest. */
const CONFLICTS: Record<string, string> = {
  'claude-code':
    'This dossier, and the tool card it reviews, were drafted using Claude Code — the tool being assessed. A reviewer should treat every judgement about it as conflicted and verify independently.',
  cursor: 'Assessed by an AI assistant that competes with this product category.',
  'github-copilot': 'Assessed by an AI assistant that competes with this product category.',
};

async function main() {
  const { getPrioritySet, listRules } = await import('../lib/review.ts');
  const { getHeuristics, getSignalsFor, getTool } = await import('../lib/content.ts');

  const heuristics = getHeuristics(DOMAIN);
  if (!heuristics) throw new Error('no heuristics for domain');
  const rules = listRules(heuristics);
  const priority = getPrioritySet(DOMAIN);

  const outDir = path.join(CONTENT, 'dossiers', DOMAIN);
  await mkdir(outDir, { recursive: true });

  // Prune dossiers for tools no longer in the priority set.
  if (existsSync(outDir)) {
    const keep = new Set(priority.map((p) => `${p.slug}.json`));
    for (const f of await readdir(outDir)) {
      if (!keep.has(f)) await writeFile(path.join(outDir, f), '');
    }
  }

  let written = 0;
  const missingEvidence: string[] = [];

  for (const entry of priority) {
    const tool = getTool(DOMAIN, entry.slug);
    const evidence = DOSSIER_EVIDENCE[entry.slug];
    if (!evidence) missingEvidence.push(entry.slug);

    const myRules = rules.filter((r) => r.tool_slug === entry.slug);

    // Relationships are read from the rules, not restated by hand.
    const relationships: Array<{ type: string; detail: string }> = [];
    for (const [ctx, cr] of Object.entries(heuristics.contexts)) {
      for (const c of cr.candidates ?? []) {
        if (c.slug === entry.slug) {
          if (c.role) relationships.push({ type: 'role', detail: `provides role "${c.role}" in ${ctx}` });
          for (const p of c.provides ?? []) {
            relationships.push({ type: 'suppression', detail: `covers role "${p}" in ${ctx}, suppressing lower-priority rules needing it` });
          }
          for (const r of c.requires_any ?? []) {
            relationships.push({ type: 'prerequisite', detail: `only offered in ${ctx} when the user marked ${r}` });
          }
          for (const b of c.baselines ?? []) {
            relationships.push({ type: 'gating', detail: `only offered in ${ctx} at learner baseline "${b}"` });
          }
        }
        if ((c.requires_any ?? []).includes(entry.slug)) {
          relationships.push({ type: 'prerequisite-of', detail: `marking this unlocks the ${c.slug} recommendation in ${ctx}` });
        }
      }
    }

    const signals = getSignalsFor(DOMAIN, entry.slug);

    const dossier = {
      slug: entry.slug,
      domain: DOMAIN,
      name: entry.name,
      canonical_url: tool?.homepage ?? null,
      primary_source: evidence?.primary_source ?? null,

      // --- what is being proposed -------------------------------------------
      proposed_lifecycle: tool?.lifecycle ?? null,
      summary: tool?.one_liner ?? null,
      what_it_is: tool?.what_it_is ?? null,
      why_it_matters: tool?.why_it_matters ?? null,
      suitable_for: tool?.suitable_for ?? [],
      not_suitable_for: tool?.not_suitable_for ?? [],
      alternatives: tool?.alternatives ?? [],

      // --- evidence, kept strictly separated ---------------------------------
      verifiable_facts: evidence?.facts ?? [],
      editorial_interpretation: evidence?.interpretation ?? [],
      context_dependent_guidance: [
        ...(tool?.suitable_for ?? []).map((s) => `Suitable: ${s}`),
        ...(tool?.not_suitable_for ?? []).map((s) => `Unsuitable: ${s}`),
      ],
      evidence_gaps: evidence?.gaps ?? [
        'No authored evidence block exists for this tool yet. Every claim on its card is unsupported.',
      ],
      wrong_if: evidence?.wrong_if ?? 'Unassessed — no evidence block authored.',
      confidence: evidence?.confidence ?? 'low',
      conflict_of_interest: CONFLICTS[entry.slug] ?? null,

      // --- what depends on it ------------------------------------------------
      diagnosis_rules: myRules.map((r) => ({
        rule_id: r.rule_id, context: r.context, kind: r.kind, reviewed: r.reviewed,
      })),
      relationships,
      journeys_affected: entry.contexts,

      supporting_signals: signals.map((s) => ({
        tier: s.tier,
        label: s.source_label,
        source_url: s.source_url,
        observed_at: s.observed_at,
        context_status: s.context_status ?? 'unknown',
        eligible_for_trends: s.eligible_for_trends ?? false,
      })),
      signal_note:
        'Repository signals are recorded file changes. They are not evidence of popularity, personal usage or industry trends, and none is eligible to inform a trend conclusion.',

      // --- what a human must decide -----------------------------------------
      fields_requiring_approval: [
        'lifecycle', 'one_liner', 'what_it_is', 'why_it_matters',
        'suitable_for', 'not_suitable_for', 'alternatives',
        ...myRules.map((r) => `rule:${r.rule_id}`),
      ],
      proposed_decision:
        tool?.lifecycle
          ? `Approve lifecycle "${tool.lifecycle}" and the ${myRules.length} dependent rule(s), or amend.`
          : 'No lifecycle proposed; classification required before this tool can appear in a lifecycle view.',

      // --- review status: never set by this script ---------------------------
      editorial_status: 'ai_draft' as const,
      reviewed_by: null,
      reviewed_at: null,
      author: 'AI-assisted draft — unattributed pending review',
      generated_at: new Date().toISOString().slice(0, 10),
    };

    await writeFile(path.join(outDir, `${entry.slug}.json`), JSON.stringify(dossier, null, 2) + '\n');
    written++;
  }

  console.error(`wrote ${written} dossiers to content/dossiers/${DOMAIN}/`);
  if (missingEvidence.length) {
    console.error(`\n${missingEvidence.length} without an authored evidence block: ${missingEvidence.join(', ')}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

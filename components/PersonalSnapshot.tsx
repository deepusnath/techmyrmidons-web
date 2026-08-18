'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ToolView } from '../lib/views.ts';
import { PROGRESS_META, useHydrated, useLocalState, type ProgressState } from '../lib/state.ts';
import {
  diagnose,
  GOAL_OPTIONS,
  workLabel as workLabelFor,
  type AssessmentAnswers,
  type Heuristics,
} from '../lib/assessment.ts';
import { DRAFT_LABEL_SHORT, SHOW_DRAFTS } from '../lib/provenance.ts';
import { routes } from '../lib/routes.ts';
import { EmptyState, LifecycleBadge } from './Provenance.tsx';
import { ToolStateButtons } from './ToolStateButtons.tsx';
import { Assessment } from './Assessment.tsx';

export function PersonalSnapshot({
  tools,
  domain,
  heuristics,
  heuristicsWithheld,
}: {
  tools: ToolView[];
  domain: string;
  /** Null when the rules are unreviewed and this build withholds them. */
  heuristics: Heuristics | null;
  heuristicsWithheld: boolean;
}) {
  const { state, marked: markedRecords, assessment, reset, clearAssessment } = useLocalState(domain);
  const hydrated = useHydrated();
  const [editing, setEditing] = useState(false);

  const marked = hydrated
    ? (Object.fromEntries(Object.entries(markedRecords).map(([k, v]) => [k, v.state])) as Record<string, ProgressState>)
    : {};

  const toolNames = useMemo(() => Object.fromEntries(tools.map((t) => [t.slug, t.name])), [tools]);

  const answers: AssessmentAnswers = hydrated
    ? {
        work: (assessment.work as AssessmentAnswers['work']) ?? null,
        goal: (assessment.goal as AssessmentAnswers['goal']) ?? null,
        baseline: (assessment.baseline as AssessmentAnswers['baseline']) ?? null,
        completed_at: assessment.completed_at,
      }
    : { work: null, goal: null, baseline: null, completed_at: null };

  // No rules shipped means no diagnosis is computed at all — there is nothing
  // to run it against, which is the point.
  const diagnosis = useMemo(
    () => (heuristics ? diagnose({ answers, marked, heuristics, toolNames }) : null),
    [answers, marked, heuristics, toolNames],
  );

  const groups = useMemo(() => {
    const g: Record<ProgressState, ToolView[]> = { using: [], exploring: [], shipped: [] };
    for (const [slug, s] of Object.entries(marked)) {
      const tool = tools.find((t) => t.slug === slug);
      if (tool) g[s].push(tool);
    }
    for (const k of Object.keys(g) as ProgressState[]) g[k].sort((a, b) => a.name.localeCompare(b.name));
    return g;
  }, [marked, tools]);

  if (!hydrated) {
    return <p className="text-sm" style={{ color: 'var(--fg-faint)' }}>Loading your snapshot…</p>;
  }

  // The assessment stays open until the user explicitly leaves it, so that
  // answering question 2 does not snatch away question 3.
  const inAssessment =
    !heuristicsWithheld &&
    (editing || !assessment.completed_at || diagnosis?.status === 'needs_context');

  if (inAssessment) {
    return (
      <div className="space-y-6">
        {diagnosis?.status === 'needs_context' && !editing ? (
          <div
            className="rounded-sm border border-dashed p-4"
            data-testid="needs-context"
            style={{ borderColor: 'var(--color-ember)' }}
          >
            <p className="mb-1 text-sm font-semibold">A few questions first.</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
              Recommendations only mean something in context. Rather than offer a generic list, this
              needs to know what kind of work you do and what you are trying to achieve.
              {diagnosis.missing?.length ? (
                <>
                  {' '}Still needed:{' '}
                  <strong>{diagnosis.missing.map((m) => (m === 'work' ? 'your kind of work' : 'your goal')).join(' and ')}</strong>.
                </>
              ) : null}
            </p>
          </div>
        ) : null}

        <Assessment domain={domain} tools={tools} heuristics={heuristics} onDone={() => setEditing(false)} />

        {editing ? (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs underline"
            style={{ color: 'var(--fg-faint)' }}
          >
            Back to my snapshot
          </button>
        ) : null}
      </div>
    );
  }

  const sections: Array<{ key: ProgressState; title: string; blurb: string }> = [
    { key: 'using', title: 'Tools I use', blurb: 'Marked as part of your regular working stack.' },
    { key: 'exploring', title: 'Tools I am exploring', blurb: 'Reading about or trying out.' },
    { key: 'shipped', title: 'Tools I have shipped with', blurb: 'You have put something real into production with these.' },
  ];

  if (heuristicsWithheld) {
    const markedCount = Object.keys(marked).length;
    return (
      <div className="space-y-8">
        <div
          data-testid="diagnosis-withheld"
          role="note"
          className="max-w-[68ch] rounded-sm border border-dashed p-4 text-sm leading-relaxed"
          style={{ borderColor: '#c8913a', color: '#c8913a' }}
        >
          <strong>Contextual diagnosis is awaiting editorial review.</strong> What remains
          appropriate, what may deserve reconsideration, and what is worth exploring next all come
          from context-fit rules that no human editor has checked. Rather than present unreviewed
          judgements as guidance — or ask you questions whose answers nothing can act on — this
          build withholds them entirely. Your own marked tools are unaffected.
        </div>

        {markedCount === 0 ? (
          <EmptyState title="You have not marked any tools yet.">
            <p className="mb-3">
              You can still record what you use. Marking is your own data and is never withheld.
            </p>
            <Link
              href={routes.landscape(domain, 'current')}
              className="inline-block rounded-sm px-3 py-1.5 text-xs font-semibold"
              style={{ background: 'var(--color-ember)', color: '#fff' }}
            >
              Browse the landscape →
            </Link>
          </EmptyState>
        ) : (
          sections.map((sec) => (
            <section key={sec.key} data-testid={`snapshot-${sec.key}`}>
              <h2 className="mb-1 text-xl">{sec.title}</h2>
              <p className="mb-3 text-xs" style={{ color: 'var(--fg-faint)' }}>{sec.blurb}</p>
              {groups[sec.key].length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--fg-faint)' }}>
                  Nothing marked as {PROGRESS_META[sec.key].label.toLowerCase()} yet.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {groups[sec.key].map((t) => (
                    <li
                      key={t.slug}
                      data-testid={`snapshot-item-${t.slug}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-sm border px-3 py-2"
                      style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)' }}
                    >
                      <Link href={routes.tool(domain, t.slug)} className="text-sm font-medium hover:underline">
                        {t.name}
                      </Link>
                      <LifecycleBadge lifecycle={t.lifecycle} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))
        )}
      </div>
    );
  }

  const workLabel = workLabelFor(heuristics, answers.work);
  const goalLabel = GOAL_OPTIONS.find((g) => g.value === answers.goal)?.label;
  const total = Object.keys(marked).length;


  return (
    <div className="space-y-10">
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-sm border p-4"
        data-testid="context-summary"
        style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)' }}
      >
        <p className="text-sm" style={{ color: 'var(--fg-dim)' }}>
          Diagnosing for <strong style={{ color: 'var(--fg)' }}>{workLabel}</strong>, goal{' '}
          <strong style={{ color: 'var(--fg)' }}>{goalLabel}</strong> ·{' '}
          <span data-testid="marked-total">{total}</span> {total === 1 ? 'tool' : 'tools'} marked.
        </p>
        <button
          type="button"
          data-testid="edit-assessment"
          onClick={() => setEditing(true)}
          className="rounded-sm border px-2 py-1 text-[11px]"
          style={{ borderColor: 'var(--rule)', color: 'var(--fg-dim)' }}
        >
          Change answers
        </button>
        <button
          type="button"
          data-testid="reset-state"
          onClick={() => { reset(); clearAssessment(); }}
          className="rounded-sm border px-2 py-1 text-[11px]"
          style={{ borderColor: 'var(--rule)', color: 'var(--fg-faint)' }}
        >
          Clear everything
        </button>
      </div>

      {heuristicsWithheld || !diagnosis ? (
        /* Production: the rules behind all three judgement sections are
           unreviewed, so none of them runs. The user's own marked tools are
           still shown — those are their data, not our editorial. */
        <div
          data-testid="diagnosis-withheld"
          role="note"
          className="rounded-sm border border-dashed p-4 text-sm leading-relaxed"
          style={{ borderColor: '#c8913a', color: '#c8913a' }}
        >
          <strong>Contextual diagnosis is awaiting editorial review.</strong> What remains
          appropriate, what may deserve reconsideration, and what is worth exploring next are all
          derived from context-fit rules that no human editor has checked. Rather than present
          unreviewed judgements as guidance, this build withholds them. Your own marked tools are
          unaffected and shown below.
        </div>
      ) : (
        <>
      {/* One notice for the WHOLE diagnosis. All three sections below are
          produced by the same unreviewed rules — labelling only the
          recommendations would misrepresent the other two. */}
      {diagnosis.rulesAreDraft ? (
        <div
          data-testid="diagnosis-draft-notice"
          role="note"
          className="rounded-sm border border-dashed p-3 text-xs leading-relaxed"
          style={{ borderColor: '#c8913a', color: '#c8913a', background: '#c8913a11' }}
        >
          <strong>{DRAFT_LABEL_SHORT}.</strong> All three sections below — what remains appropriate,
          what may deserve reconsideration, and what is worth exploring next — are generated from
          AI-drafted context-fit rules that no human editor has reviewed. They carry no byline.
          {/* No link to the review tooling from here: this is a client component,
              so both branches of a conditional would be compiled into the
              production bundle and the URL would ship even though it never
              renders. The footer link is server-rendered and gated there. */}
        </div>
      ) : null}

      <section data-testid="still-appropriate">
        <h2 className="mb-1 text-xl">What remains appropriate for your context</h2>
        <p className="mb-3 text-xs" style={{ color: 'var(--fg-faint)' }}>
          Marked tools that still serve {workLabel?.toLowerCase()}. Being older is not a reason to change.
        </p>
        {diagnosis.appropriate.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--fg-faint)' }}>
            Nothing you have marked falls into this group yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {diagnosis.appropriate.map((j) => (
              <li key={j.slug} data-testid={`appropriate-${j.slug}`} className="rounded-sm border p-3" style={{ borderColor: 'var(--color-tier-community)' }}>
                <Link href={routes.tool(domain, j.slug)} className="text-sm font-semibold hover:underline">{j.name}</Link>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--fg-dim)' }}>{j.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section data-testid="reconsider">
        <h2 className="mb-1 text-xl">What may deserve reconsideration</h2>
        <p className="mb-3 text-xs" style={{ color: 'var(--fg-faint)' }}>
          Not instructions. Each states the specific reason it is raised for your kind of work.
        </p>
        {diagnosis.reconsider.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--fg-faint)' }}>
            Nothing you have marked is flagged for your context.
          </p>
        ) : (
          <ul className="space-y-2">
            {diagnosis.reconsider.map((j) => (
              <li key={j.slug} data-testid={`reconsider-${j.slug}`} className="rounded-sm border p-3" style={{ borderColor: '#c8913a' }}>
                <Link href={routes.tool(domain, j.slug)} className="text-sm font-semibold hover:underline">{j.name}</Link>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--fg-dim)' }}>{j.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section data-testid="suggestions">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h2 className="text-xl">Worth exploring next</h2>
        </div>
        <p className="mb-4 max-w-[68ch] text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
          At most three, chosen from your work context, your goal and what you have marked — never
          because a category was empty, and never from how many people use something. There is no
          score or completeness meter here by design.
        </p>

        {diagnosis.suggestions.length === 0 ? (
          <EmptyState title="No tool is worth recommending to you yet.">
            <p>
              {answers.work === 'learning' && answers.baseline === 'new_to_web'
                ? 'You said you are new to HTML, CSS and JavaScript. This is a catalogue of tools, and at that point no tool is the thing standing between you and progress — the language and the browser are. Come back once you are building pages and the recommendations will mean something.'
                : 'That is a real answer rather than an empty list. Changing your goal, or marking more of what you already use, will change it.'}
            </p>
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {diagnosis.suggestions.map((s) => (
              <li
                key={s.slug}
                data-testid={`suggestion-${s.slug}`}
                className="rounded-sm border p-4"
                style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)' }}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Link href={routes.tool(domain, s.slug)} className="text-base font-semibold hover:underline">
                    {s.name}
                  </Link>
                  <LifecycleBadge lifecycle={tools.find((t) => t.slug === s.slug)?.lifecycle ?? null} />
                </div>
                <p className="mb-2 text-xs leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
                  <span className="font-semibold">Why this applies to you: </span>{s.why}
                </p>
                <p className="mb-3 text-xs leading-relaxed" style={{ color: '#c8913a' }}>
                  <span className="font-semibold">Not for you if: </span>{s.unsuitable_if}
                </p>
                <ToolStateButtons domain={domain} slug={s.slug} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </section>

        </>
      )}

      {sections.map((s) => (
        <section key={s.key} data-testid={`snapshot-${s.key}`}>
          <h2 className="mb-1 text-xl">{s.title}</h2>
          <p className="mb-3 text-xs" style={{ color: 'var(--fg-faint)' }}>{s.blurb}</p>
          {groups[s.key].length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--fg-faint)' }}>
              Nothing marked as {PROGRESS_META[s.key].label.toLowerCase()} yet.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {groups[s.key].map((t) => (
                <li
                  key={t.slug}
                  data-testid={`snapshot-item-${t.slug}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-sm border px-3 py-2"
                  style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)' }}
                >
                  <Link href={routes.tool(domain, t.slug)} className="text-sm font-medium hover:underline">
                    {t.name}
                  </Link>
                  <LifecycleBadge lifecycle={t.lifecycle} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import type { ToolView } from '../lib/views.ts';
import { GOAL_OPTIONS, baselineOptions, needsBaseline, workOptions, type Heuristics } from '../lib/assessment.ts';
import { PROGRESS_META, PROGRESS_ORDER, useLocalState, type ProgressState } from '../lib/state.ts';

/**
 * Three-step local-first assessment. Nothing is uploaded; the answers exist so
 * the diagnosis can be about this person's work rather than about which
 * catalogue categories happen to be empty.
 */
export function Assessment({
  domain,
  tools,
  heuristics,
  onDone,
}: {
  domain: string;
  tools: ToolView[];
  /** Supplies this domain's work contexts and baseline options. */
  heuristics: Heuristics | null;
  onDone?: () => void;
}) {
  const WORK_OPTIONS = workOptions(heuristics);
  const BASELINE_OPTIONS = baselineOptions(heuristics);
  const { marked, assessment, setAssessment, completeAssessment, setToolState, toolState } = useLocalState(domain);
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, ToolView[]>();
    for (const t of tools) {
      if (q && !t.name.toLowerCase().includes(q) && !(t.category ?? '').toLowerCase().includes(q)) continue;
      const key = t.category ?? 'other';
      const list = map.get(key);
      if (list) list.push(t);
      else map.set(key, [t]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tools, query]);

  const markedCount = Object.keys(marked).length;

  return (
    <div className="space-y-8" data-testid="assessment">
      <section>
        <h2 className="mb-1 text-lg">1 · What kind of frontend work do you primarily do?</h2>
        <p className="mb-3 text-xs" style={{ color: 'var(--fg-faint)' }}>
          This decides which advice is relevant. A legacy maintainer and a design-system author need
          different answers, not the same list.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {WORK_OPTIONS.map((o) => {
            const active = assessment.work === o.value;
            return (
              <button
                key={o.value}
                type="button"
                data-testid={`work-${o.value}`}
                aria-pressed={active}
                onClick={() => setAssessment({ work: o.value })}
                className="rounded-sm border p-3 text-left"
                style={{
                  borderColor: active ? 'var(--color-ember)' : 'var(--rule)',
                  background: active ? 'var(--color-ember)11' : 'transparent',
                }}
              >
                <span className="block text-sm font-semibold" style={{ color: active ? 'var(--color-ember)' : 'var(--fg)' }}>
                  {o.label}
                </span>
                <span className="block text-xs" style={{ color: 'var(--fg-faint)' }}>{o.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg">2 · What are you trying to achieve?</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {GOAL_OPTIONS.map((o) => {
            const active = assessment.goal === o.value;
            return (
              <button
                key={o.value}
                type="button"
                data-testid={`goal-${o.value}`}
                aria-pressed={active}
                onClick={() => setAssessment({ goal: o.value })}
                className="rounded-sm border p-3 text-left"
                style={{
                  borderColor: active ? 'var(--color-ember)' : 'var(--rule)',
                  background: active ? 'var(--color-ember)11' : 'transparent',
                }}
              >
                <span className="block text-sm font-semibold" style={{ color: active ? 'var(--color-ember)' : 'var(--fg)' }}>
                  {o.label}
                </span>
                <span className="block text-xs" style={{ color: 'var(--fg-faint)' }}>{o.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      {needsBaseline(heuristics, assessment.work) ? (
        <section data-testid="baseline-question">
          <h2 className="mb-1 text-lg">2b · What best describes where you are now?</h2>
          <p className="mb-3 text-xs" style={{ color: 'var(--fg-faint)' }}>
            Asked only for learning, because “learn frontend” means something very different at each
            of these points. Without it we would rather recommend nothing than hand you a toolchain.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {BASELINE_OPTIONS.map((o) => {
              const active = assessment.baseline === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  data-testid={`baseline-${o.value}`}
                  aria-pressed={active}
                  onClick={() => setAssessment({ baseline: o.value })}
                  className="rounded-sm border p-3 text-left text-sm font-semibold"
                  style={{
                    borderColor: active ? 'var(--color-ember)' : 'var(--rule)',
                    background: active ? 'var(--color-ember)11' : 'transparent',
                    color: active ? 'var(--color-ember)' : 'var(--fg)',
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-1 text-lg">3 · Which of these do you already work with?</h2>
        <p className="mb-3 text-xs" style={{ color: 'var(--fg-faint)' }}>
          Optional, but it is what turns generic advice into something about your actual stack.
          {markedCount > 0 ? ` You have marked ${markedCount} so far.` : ''}
        </p>

        <label htmlFor="assess-search" className="sr-only">Search tools</label>
        <input
          id="assess-search"
          data-testid="assessment-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or category…"
          className="mb-4 w-full max-w-sm rounded-sm border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)', color: 'var(--fg)' }}
        />

        <div className="space-y-5">
          {grouped.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--fg-faint)' }}>Nothing matches that search.</p>
          ) : (
            grouped.map(([category, list]) => (
              <div key={category}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--fg-faint)' }}>
                  {category}
                </h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {list.map((t) => {
                    const cur = toolState(t.slug);
                    return (
                      <li
                        key={t.slug}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-sm border px-3 py-2"
                        style={{ borderColor: cur ? 'var(--color-ember)' : 'var(--rule)' }}
                      >
                        <span className="text-sm">{t.name}</span>
                        <span className="flex gap-1">
                          {PROGRESS_ORDER.map((s: ProgressState) => (
                            <button
                              key={s}
                              type="button"
                              data-testid={`pick-${t.slug}-${s}`}
                              aria-pressed={cur === s}
                              title={PROGRESS_META[s].blurb}
                              onClick={() => setToolState(t.slug, s)}
                              className="rounded-sm border px-1.5 py-0.5 text-[10px] font-medium"
                              style={{
                                borderColor: cur === s ? 'var(--color-ember)' : 'var(--rule)',
                                background: cur === s ? 'var(--color-ember)' : 'transparent',
                                color: cur === s ? '#fff' : 'var(--fg-faint)',
                              }}
                            >
                              {PROGRESS_META[s].label}
                            </button>
                          ))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </section>

      {onDone ? (
        <button
          type="button"
          data-testid="assessment-done"
          onClick={() => { completeAssessment(); onDone(); }}
          disabled={
            !assessment.work ||
            !assessment.goal ||
            (needsBaseline(heuristics, assessment.work) &&
              Object.keys(marked).length === 0 &&
              !assessment.baseline)
          }
          className="rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-40"
          style={{ background: 'var(--color-ember)', color: '#fff' }}
        >
          See my diagnosis
        </button>
      ) : null}
    </div>
  );
}

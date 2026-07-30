'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { ToolView } from '../lib/views.ts';
import { PROGRESS_META, useHydrated, useLocalState, type ProgressState } from '../lib/state.ts';
import { LIFECYCLE_META } from '../lib/provenance.ts';
import { EmptyState, LifecycleBadge } from './Provenance.tsx';
import { ToolStateButtons } from './ToolStateButtons.tsx';

interface Suggestion {
  tool: ToolView;
  reason: string;
}

/**
 * Suggestions are derived from the user's own marks and from editorial
 * relationships between tools — never from how many people use something.
 * Every suggestion carries the reason it appeared, because an unexplainable
 * recommendation is indistinguishable from a popularity ranking.
 *
 * Deterministic: no randomness, so the same state always yields the same list.
 */
function suggest(tools: ToolView[], marked: Record<string, ProgressState>): Suggestion[] {
  const byName = new Map<string, ToolView>();
  for (const t of tools) byName.set(t.name.toLowerCase(), t);
  const has = (slug: string) => slug in marked;
  const out: Suggestion[] = [];
  const seen = new Set<string>();

  const push = (tool: ToolView | undefined, reason: string) => {
    if (!tool || has(tool.slug) || seen.has(tool.slug)) return;
    seen.add(tool.slug);
    out.push({ tool, reason });
  };

  const markedSlugs = Object.keys(marked).sort();

  // 1. Anything marked that is declining or legacy — offer its stated alternatives.
  for (const slug of markedSlugs) {
    const tool = tools.find((t) => t.slug === slug);
    if (!tool || (tool.lifecycle !== 'declining' && tool.lifecycle !== 'legacy')) continue;
    for (const altName of tool.alternatives) {
      push(
        byName.get(altName.toLowerCase()),
        `You marked ${tool.name} as ${PROGRESS_META[marked[slug]].label.toLowerCase()}, and it is ${tool.lifecycle}. ${altName} is one of the alternatives listed on its card.`,
      );
      if (out.length >= 4) return out.slice(0, 4);
    }
  }

  // 2. Categories the user has nothing in at all.
  const markedCategories = new Set(
    markedSlugs.map((s) => tools.find((t) => t.slug === s)?.category).filter(Boolean),
  );
  const categories = [...new Set(tools.map((t) => t.category).filter(Boolean))].sort() as string[];
  for (const cat of categories) {
    if (markedCategories.has(cat)) continue;
    const candidate = tools
      .filter((t) => t.category === cat && t.lifecycle === 'established')
      .sort((a, b) => a.name.localeCompare(b.name))[0];
    push(candidate, `You have not marked anything under “${cat}”. ${candidate?.name ?? ''} is an established option there.`);
    if (out.length >= 4) return out.slice(0, 4);
  }

  return out.slice(0, 4);
}

export function PersonalSnapshot({ tools, domain }: { tools: ToolView[]; domain: string }) {
  const { state, reset } = useLocalState();
  const hydrated = useHydrated();

  const marked = hydrated
    ? (Object.fromEntries(Object.entries(state.tools).map(([k, v]) => [k, v.state])) as Record<string, ProgressState>)
    : {};

  const groups = useMemo(() => {
    const g: Record<ProgressState, ToolView[]> = { using: [], exploring: [], shipped: [] };
    for (const [slug, s] of Object.entries(marked)) {
      const tool = tools.find((t) => t.slug === slug);
      if (tool) g[s].push(tool);
    }
    for (const k of Object.keys(g) as ProgressState[]) g[k].sort((a, b) => a.name.localeCompare(b.name));
    return g;
  }, [marked, tools]);

  const suggestions = useMemo(() => suggest(tools, marked), [tools, marked]);
  const total = Object.keys(marked).length;

  if (!hydrated) {
    return <p className="text-sm" style={{ color: 'var(--fg-faint)' }}>Loading your snapshot…</p>;
  }

  if (total === 0) {
    return (
      <div className="space-y-6">
        <EmptyState title="You have not marked any tools yet.">
          <p className="mb-3">
            This page becomes useful once it knows what you already use. Nothing here is guessed —
            an empty snapshot is shown honestly rather than filled with defaults.
          </p>
          <Link
            href={`/${domain}/current/`}
            className="inline-block rounded-sm px-3 py-1.5 text-xs font-semibold"
            style={{ background: 'var(--color-ember)', color: '#fff' }}
          >
            Start with the Current landscape →
          </Link>
        </EmptyState>
      </div>
    );
  }

  const sections: Array<{ key: ProgressState; title: string; blurb: string }> = [
    { key: 'using', title: 'Tools I use', blurb: 'Marked as part of your regular working stack.' },
    { key: 'exploring', title: 'Tools I am exploring', blurb: 'Reading about or trying out.' },
    { key: 'shipped', title: 'Tools I have shipped with', blurb: 'You have put something real into production with these.' },
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm" style={{ color: 'var(--fg-dim)' }}>
          <span data-testid="marked-total" className="font-semibold" style={{ color: 'var(--fg)' }}>{total}</span>{' '}
          {total === 1 ? 'tool' : 'tools'} marked.
        </p>
        <button
          type="button"
          onClick={reset}
          data-testid="reset-state"
          className="rounded-sm border px-2 py-1 text-[11px]"
          style={{ borderColor: 'var(--rule)', color: 'var(--fg-faint)' }}
        >
          Clear everything
        </button>
      </div>

      {sections.map((s) => (
        <section key={s.key} data-testid={`snapshot-${s.key}`}>
          <h2 className="mb-1 text-xl">{s.title}</h2>
          <p className="mb-3 text-xs" style={{ color: 'var(--fg-faint)' }}>{s.blurb}</p>
          {groups[s.key].length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--fg-faint)' }}>Nothing marked as {PROGRESS_META[s.key].label.toLowerCase()} yet.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {groups[s.key].map((t) => (
                <li
                  key={t.slug}
                  data-testid={`snapshot-item-${t.slug}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-sm border px-3 py-2"
                  style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)' }}
                >
                  <Link href={`/${domain}/tools/${t.slug}/`} className="text-sm font-medium hover:underline">
                    {t.name}
                  </Link>
                  <LifecycleBadge lifecycle={t.lifecycle} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section data-testid="suggestions">
        <h2 className="mb-1 text-xl">Suggested next</h2>
        <p className="mb-4 max-w-3xl text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
          Derived from what you marked and from the alternatives and categories on the tool cards —
          never from how many people use something. Each suggestion says why it appeared, so you can
          disagree with the reasoning rather than just the result.
        </p>

        {suggestions.length === 0 ? (
          <EmptyState title="No suggestions right now.">
            <p>You have marked something in every category the catalogue covers.</p>
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {suggestions.map(({ tool, reason }) => (
              <li
                key={tool.slug}
                data-testid={`suggestion-${tool.slug}`}
                className="rounded-sm border p-4"
                style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)' }}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Link href={`/${domain}/tools/${tool.slug}/`} className="text-base font-semibold hover:underline">
                    {tool.name}
                  </Link>
                  <LifecycleBadge lifecycle={tool.lifecycle} />
                </div>
                <p className="mb-2 text-xs leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
                  <span className="font-semibold">Why this: </span>{reason}
                </p>
                {tool.not_suitable_for.length ? (
                  <p className="mb-3 text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
                    <span className="font-semibold">May not suit: </span>{tool.not_suitable_for[0]}
                  </p>
                ) : null}
                <ToolStateButtons slug={tool.slug} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

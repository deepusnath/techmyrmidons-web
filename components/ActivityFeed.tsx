'use client';

import Link from 'next/link';
import type { DemoActivity } from '../lib/content.ts';
import { PROGRESS_META, useHydrated, useLocalState } from '../lib/state.ts';
import { formatDate } from '../lib/provenance.ts';
import { EmptyState, ProvenanceChip, RepoSignalRow } from './Provenance.tsx';

export interface RepoSignalView {
  id: string;
  statement: string;
  tool_slug: string;
  tool_name: string;
  context_status: string;
  eligible_for_trends: boolean;
  source_url: string | null;
  at: string;
}

/**
 * Three clearly separated groups.
 *
 * The first is deliberately NOT called practitioner activity: a dependency
 * change in a public repository is a fact about a file, not about what a person
 * uses, prefers, adopted or abandoned. Naming it "activity" invited exactly the
 * inference the data cannot support.
 */
export function ActivityFeed({
  signals,
  demo,
  toolNames,
  domain,
}: {
  signals: RepoSignalView[];
  demo: DemoActivity[];
  toolNames: Record<string, string>;
  domain: string;
}) {
  const { marked } = useLocalState(domain);
  const hydrated = useHydrated();

  const mine = hydrated
    ? Object.entries(marked)
        .map(([slug, rec]) => ({ slug, ...rec }))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    : [];

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-xl">Repository signals</h2>
          <ProvenanceChip kind="observed" />
        </div>
        <p className="mb-4 max-w-[68ch] text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
          Recorded changes to dependency files in public repositories, each linked to the commit that
          made it. <strong>A dependency change is not a statement about a person.</strong> It does not
          show that anyone uses, prefers, adopted or abandoned a tool — the repository might be a
          demo, a dotfiles repo, a library, or long abandoned. Where that is not established, the
          context is shown as unknown, and these signals do not feed lifecycle classification or
          recommendations.
        </p>

        {signals.length === 0 ? (
          <EmptyState title="No repository signals recorded yet.">
            <p>
              These come from walking manifest history in tracked public repositories. Until that has
              run, this stays empty rather than being filled with guesses.
            </p>
          </EmptyState>
        ) : (
          <ul className="space-y-2" data-testid="repo-signals">
            {signals.slice(0, 40).map((s) => (
              <RepoSignalRow
                key={s.id}
                statement={s.statement}
                contextStatus={s.context_status}
                sourceUrl={s.source_url}
                eligible={s.eligible_for_trends}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-xl">Your activity</h2>
          <ProvenanceChip kind="declared" />
        </div>
        <p className="mb-4 max-w-[68ch] text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
          What you have marked, stored in this browser. Unlike a repository signal, this is a direct
          statement by a person about their own work — which is why it is a separate tier.
        </p>

        {mine.length === 0 ? (
          <EmptyState title="You have not marked anything yet.">
            <p>Mark a tool as Exploring, Using or Shipped anywhere in the landscape.</p>
          </EmptyState>
        ) : (
          <ul className="space-y-2" data-testid="my-activity">
            {mine.map((m) => (
              <li
                key={m.slug}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-2 text-sm"
                style={{ borderColor: 'var(--rule)' }}
              >
                <span className="font-medium">You</span>
                <span className="flex-1 min-w-[12rem]" style={{ color: 'var(--fg-dim)' }}>
                  marked{' '}
                  <Link href={`/${domain}/tools/${m.slug}/`} className="hover:underline" style={{ color: 'var(--color-ember)' }}>
                    {toolNames[m.slug] ?? m.slug}
                  </Link>{' '}
                  as {PROGRESS_META[m.state].label}
                </span>
                <span className="text-xs whitespace-nowrap" style={{ color: 'var(--fg-faint)' }}>
                  {formatDate(m.updated_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-xl">Demonstration members</h2>
          <ProvenanceChip kind="demo" />
        </div>
        <div
          className="mb-4 max-w-[68ch] rounded-sm border border-dashed p-3 text-xs leading-relaxed"
          style={{ borderColor: 'var(--color-tier-demo)', color: 'var(--color-tier-demo)' }}
        >
          <strong>These people do not exist.</strong> They are fictional fixtures so the interface can
          be tested before there are real members. No real practitioner has activity invented for
          them anywhere in this product.
        </div>

        <ul className="space-y-2" data-testid="demo-activity">
          {demo.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-2 text-sm"
              style={{ borderColor: 'var(--rule)' }}
            >
              <span className="font-medium" style={{ color: 'var(--color-tier-demo)' }}>{d.display_name}</span>
              <span className="flex-1 min-w-[12rem]" style={{ color: 'var(--fg-dim)' }}>
                marked{' '}
                <Link href={`/${domain}/tools/${d.tool_slug}/`} className="hover:underline" style={{ color: 'var(--color-ember)' }}>
                  {toolNames[d.tool_slug] ?? d.tool_slug}
                </Link>{' '}
                as {PROGRESS_META[d.state].label}
              </span>
              <span className="text-xs whitespace-nowrap" style={{ color: 'var(--fg-faint)' }}>
                {formatDate(d.at)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

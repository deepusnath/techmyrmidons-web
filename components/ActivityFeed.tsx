'use client';

import Link from 'next/link';
import type { DemoActivity } from '../lib/content.ts';
import { PROGRESS_META, useHydrated, useLocalState } from '../lib/state.ts';
import { formatDate } from '../lib/provenance.ts';
import { EmptyState, ProvenanceChip } from './Provenance.tsx';

export interface SourcedActivity {
  id: string;
  person: string;
  tool_slug: string;
  tool_name: string;
  label: string;
  source_url: string | null;
  at: string;
}

/**
 * Three clearly separated groups. Real practitioners appear ONLY where an actual
 * sourced artifact backs the claim — nothing is inferred or invented for them.
 * Demonstration rows exist so the interface can be tested and are labelled as
 * fictional every single time they render.
 */
export function ActivityFeed({
  sourced,
  demo,
  toolNames,
  domain,
}: {
  sourced: SourcedActivity[];
  demo: DemoActivity[];
  toolNames: Record<string, string>;
  domain: string;
}) {
  const { state } = useLocalState();
  const hydrated = useHydrated();

  const mine = hydrated
    ? Object.entries(state.tools)
        .map(([slug, rec]) => ({ slug, ...rec }))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    : [];

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-xl">Practitioner activity</h2>
          <ProvenanceChip kind="observed" />
        </div>
        <p className="mb-4 max-w-3xl text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
          Derived from public repository history — each row links to the commit it came from. This is
          the only place real, named practitioners appear, and only with a checkable source. Nothing
          about them is inferred.
        </p>

        {sourced.length === 0 ? (
          <EmptyState title="No sourced practitioner activity yet.">
            <p>
              Observed evidence requires running the repository backfill. Until it has run, this
              section stays empty rather than being filled with guesses.
            </p>
          </EmptyState>
        ) : (
          <ul className="space-y-2" data-testid="sourced-activity">
            {sourced.slice(0, 30).map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-2 text-sm"
                style={{ borderColor: 'var(--rule)' }}
              >
                <span className="font-medium">{a.person}</span>
                <span className="flex-1 min-w-[12rem]" style={{ color: 'var(--fg-dim)' }}>
                  {a.label}{' '}
                  <Link href={`/${domain}/tools/${a.tool_slug}/`} className="hover:underline" style={{ color: 'var(--color-ember)' }}>
                    {a.tool_name}
                  </Link>
                </span>
                {a.source_url ? (
                  <a
                    href={a.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs hover:underline"
                    style={{ color: 'var(--color-tier-observed)' }}
                  >
                    source ↗
                  </a>
                ) : null}
                <span className="text-xs whitespace-nowrap" style={{ color: 'var(--fg-faint)' }}>
                  {formatDate(a.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-xl">Your activity</h2>
          <ProvenanceChip kind="declared" />
        </div>
        <p className="mb-4 max-w-3xl text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
          What you have marked, stored in this browser. In a later version with accounts, this is
          what would become community evidence for other people — with your consent.
        </p>

        {mine.length === 0 ? (
          <EmptyState title="You have not marked anything yet.">
            <p>
              Mark a tool as Exploring, Using or Shipped anywhere in the landscape and it will appear
              here.
            </p>
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
          className="mb-4 rounded-sm border border-dashed p-3 text-xs leading-relaxed"
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

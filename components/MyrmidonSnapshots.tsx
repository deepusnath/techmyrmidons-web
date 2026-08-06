'use client';

import { useState } from 'react';
import type { Heuristics } from '../lib/assessment.ts';
import type { ToolView } from '../lib/views.ts';
import { PersonalSnapshot } from './PersonalSnapshot.tsx';

export interface SnapshotDomain {
  slug: string;
  name: string;
  tools: ToolView[];
  /** Null when the rules are unreviewed and this build withholds them. */
  heuristics: Heuristics | null;
  heuristicsWithheld: boolean;
}

/**
 * "Where I stand", per domain.
 *
 * The diagnosis asks what kind of work you do, and the answers only mean
 * something inside one field — a design-system context is a real answer in
 * frontend and no answer at all in AI. So each domain keeps its own assessment
 * and its own snapshot, and this only picks which one is on screen.
 *
 * With a single active domain there is nothing to pick, so no switcher is
 * rendered and the page reads exactly as it did before.
 */
export function MyrmidonSnapshots({ domains }: { domains: SnapshotDomain[] }) {
  const [active, setActive] = useState(domains[0]?.slug ?? '');
  const current = domains.find((d) => d.slug === active) ?? domains[0];
  if (!current) return null;

  return (
    <div>
      {domains.length > 1 ? (
        <div
          role="tablist"
          aria-label="Domain"
          data-testid="snapshot-domain-switcher"
          className="mb-6 flex flex-wrap gap-2"
        >
          {domains.map((d) => {
            const selected = d.slug === current.slug;
            return (
              <button
                key={d.slug}
                type="button"
                role="tab"
                aria-selected={selected}
                data-testid={`snapshot-domain-${d.slug}`}
                onClick={() => setActive(d.slug)}
                className="rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors"
                style={{
                  borderColor: selected ? 'var(--color-ember)' : 'var(--rule)',
                  background: selected ? 'var(--color-ember)' : 'transparent',
                  color: selected ? '#fff' : 'var(--fg-dim)',
                }}
              >
                {d.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Keyed on the domain so switching mounts a fresh snapshot rather than
          carrying the previous domain's editing state across. */}
      <PersonalSnapshot
        key={current.slug}
        tools={current.tools}
        domain={current.slug}
        heuristics={current.heuristics}
        heuristicsWithheld={current.heuristicsWithheld}
      />
    </div>
  );
}

'use client';

import { useState } from 'react';
import { computeCompletion } from '../lib/completion.ts';
import { encodeSnapshot, type ProfileSnapshot, type SharedDomain } from '../lib/profileShare.ts';
import { toolKey, useHydrated, useLocalState, type ToolStateRecord } from '../lib/state.ts';
import type { ProfileDomainData } from './ProfileCard.tsx';

/**
 * "Create share link" — the profile as a URL.
 *
 * The snapshot is built on click, from local state, and encoded into the
 * fragment: the part of a URL a browser never sends to a server. Sharing is
 * the user's own act — until they perform it, nothing has left the browser.
 */
export function ProfileShare({ domains }: { domains: ProfileDomainData[] }) {
  const { state } = useLocalState();
  const hydrated = useHydrated();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const hasActivity =
    hydrated && domains.some((d) => d.tools.some((t) => state.tools[toolKey(d.slug, t.slug)]));

  function buildSnapshot(): ProfileSnapshot | null {
    const shared: SharedDomain[] = [];
    for (const d of domains) {
      const marked: Record<string, ToolStateRecord> = {};
      for (const t of d.tools) {
        const rec = state.tools[toolKey(d.slug, t.slug)];
        if (rec) marked[t.slug] = rec;
      }
      const assessment = state.assessments[d.slug];
      const work = assessment?.work ?? null;
      const journeySlugs = work && d.journeyByContext[work]?.length ? d.journeyByContext[work] : null;
      const completion = computeCompletion({
        tools: d.tools,
        marked,
        assessmentCompleted: Boolean(assessment?.completed_at),
        journeySlugs,
      });
      if (!completion.tier) continue; // nothing to say about an untouched domain

      const nameOf = (slug: string) => d.tools.find((t) => t.slug === slug)?.name ?? slug;
      shared.push({
        name: d.name,
        tier: completion.tier,
        journeyLabel: work ? (d.contextLabels[work] ?? null) : null,
        journey: completion.journey
          ? { touched: completion.journey.touched, total: completion.journey.total, shipped: completion.journey.shipped }
          : null,
        recent: Object.entries(marked)
          .sort((a, b) => b[1].updated_at.localeCompare(a[1].updated_at))
          .slice(0, 3)
          .map(([slug, rec]) => ({ name: nameOf(slug), state: rec.state, date: rec.updated_at })),
      });
    }
    if (shared.length === 0) return null;
    return { v: 1, generated_at: new Date().toISOString(), domains: shared };
  }

  function createLink() {
    const snapshot = buildSnapshot();
    if (!snapshot) return;
    // location.pathname already carries the deployment base path.
    const viewPath = `${window.location.pathname.replace(/\/$/, '')}/view/`;
    setUrl(`${window.location.origin}${viewPath}#s=${encodeSnapshot(snapshot)}`);
    setCopied(false);
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /* clipboard unavailable — the input below stays selectable by hand */
    }
  }

  return (
    <section className="mb-8 rounded-sm border border-dashed p-5" style={{ borderColor: 'var(--rule)' }}>
      <h2 className="mb-2 text-lg font-semibold">Share your profile</h2>
      <p className="mb-3 max-w-[68ch] text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
        The link carries your snapshot in the part of the URL a browser never sends to any server —
        nothing leaves this browser until you share it yourself. Whoever opens it sees a read-only
        copy, labelled self-reported.
      </p>

      {!hasActivity ? (
        <p className="text-sm" style={{ color: 'var(--fg-dim)' }}>
          Mark at least one tool and your profile becomes shareable.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div>
            <button
              type="button"
              data-testid="share-create"
              onClick={createLink}
              className="rounded-sm border px-4 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--color-ember)', color: 'var(--color-ember)' }}
            >
              Create share link
            </button>
          </div>
          {url ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                readOnly
                data-testid="share-url"
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full max-w-xl rounded-sm border px-3 py-2 text-xs sm:flex-1"
                style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)', color: 'var(--fg-dim)' }}
              />
              <button
                type="button"
                data-testid="share-copy"
                onClick={copy}
                className="rounded-sm border px-3 py-2 text-xs font-medium"
                style={{ borderColor: 'var(--rule)', color: 'var(--fg-dim)' }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

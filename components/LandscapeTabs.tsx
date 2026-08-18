'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { ToolView } from '../lib/views.ts';
import { routes } from '../lib/routes.ts';
import { LandscapeBrowser } from './LandscapeBrowser.tsx';
import { EmptyState } from './Provenance.tsx';

export interface LandscapeTabView {
  slug: string;
  title: string;
  lede: string;
  tools: ToolView[];
}

/**
 * The landscape, switchable in place on the domain page.
 *
 * It was four cards that navigated away, so comparing Current against Declining
 * cost two page loads and a back button. The dedicated /[domain]/[view] pages
 * stay: they are deep-linkable, and Historical's year-by-year record only
 * exists there. Each panel links to its own.
 */
export function LandscapeTabs({
  views,
  domain,
  categories,
  timelineYears,
}: {
  views: LandscapeTabView[];
  domain: string;
  categories: string[];
  timelineYears: number;
}) {
  const [active, setActive] = useState(views[0]?.slug ?? '');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const current = views.find((v) => v.slug === active) ?? views[0];
  if (!current) return null;

  /** Arrow keys move between tabs, which is what a tablist is expected to do. */
  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    const i = views.findIndex((v) => v.slug === active);
    const next =
      e.key === 'ArrowRight' ? (i + 1) % views.length
      : e.key === 'ArrowLeft' ? (i - 1 + views.length) % views.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? views.length - 1
      : -1;
    if (next === -1) return;
    e.preventDefault();
    const slug = views[next].slug;
    setActive(slug);
    tabRefs.current[slug]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label="Landscape views" className="mb-4 flex flex-wrap gap-2">
        {views.map((v) => {
          const selected = v.slug === current.slug;
          return (
            <button
              key={v.slug}
              type="button"
              role="tab"
              id={`landscape-tab-${v.slug}`}
              aria-selected={selected}
              aria-controls={`landscape-panel-${v.slug}`}
              tabIndex={selected ? 0 : -1}
              data-testid={`landscape-tab-${v.slug}`}
              ref={(el) => { tabRefs.current[v.slug] = el; }}
              onClick={() => setActive(v.slug)}
              onKeyDown={onKeyDown}
              className="flex items-baseline gap-2 rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                borderColor: selected ? 'var(--color-ember)' : 'var(--rule)',
                background: selected ? 'var(--color-ember)' : 'transparent',
                color: selected ? '#fff' : 'var(--fg-dim)',
              }}
            >
              {v.title}
              <span className="text-xs" style={{ color: selected ? '#fff' : 'var(--fg-faint)' }}>
                {v.slug === 'historical' && v.tools.length === 0 ? timelineYears : v.tools.length}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`landscape-panel-${current.slug}`}
        aria-labelledby={`landscape-tab-${current.slug}`}
        data-testid={`landscape-panel-${current.slug}`}
      >
        <p className="mb-4 max-w-[68ch] text-xs leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
          {current.lede}
        </p>

        {current.tools.length ? (
          /* Keyed on the view so search and filters reset when tabs change,
             rather than a query from Current silently narrowing Emerging. */
          <LandscapeBrowser
            key={current.slug}
            tools={current.tools}
            domain={domain}
            categories={categories}
          />
        ) : (
          <EmptyState title={`Nothing can be shown as ${current.title.toLowerCase()} in this build.`}>
            <p>
              Lifecycle is an editorial classification. While it is unreviewed this build withholds
              it rather than presenting it as established.
            </p>
          </EmptyState>
        )}

        <p className="mt-5 text-xs">
          <Link
            href={routes.landscape(domain, current.slug)}
            data-testid={`landscape-full-${current.slug}`}
            className="hover:underline"
            style={{ color: 'var(--color-ember)' }}
          >
            {current.slug === 'historical'
              ? `Open the full ${current.title.toLowerCase()} view — ${timelineYears} years, tool by tool →`
              : `Open the full ${current.title.toLowerCase()} view →`}
          </Link>
        </p>
      </div>
    </div>
  );
}

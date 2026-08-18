'use client';

import { useMemo, useState } from 'react';
import type { ToolView } from '../lib/views.ts';
import { LIFECYCLE_CAVEAT, LIFECYCLE_META } from '../lib/provenance.ts';
import { ToolCard } from './ToolCard.tsx';
import { EmptyState } from './Provenance.tsx';

/**
 * How many cards are on screen before the reader asks for more.
 *
 * Twelve fills three rows at the widest grid and two on a laptop — enough to
 * show the shape of a category without the page becoming a scroll.
 */
const PAGE_SIZE = 12;

/**
 * Search and filtering over a landscape view.
 *
 * Sorting is alphabetical or by lifecycle grouping only. There is deliberately
 * no "most adopted" sort and no composite score — ranking tools by how many
 * people use them is exactly the popularity-as-quality equation this product
 * refuses to make.
 *
 * Paging is an explicit button rather than infinite scroll. The footer carries
 * the provenance statement and the link to what has and has not been reviewed,
 * and a list that grows as you approach it is a list whose footer you can never
 * reach. A button also keeps the back button, keyboard order and screen-reader
 * announcements intact, and these lists are tens of tools — bounded, scanned
 * deliberately, nothing like a feed.
 */
export function LandscapeBrowser({
  tools,
  domain,
  categories,
  showLifecycleFilter = false,
}: {
  tools: ToolView[];
  domain: string;
  categories: string[];
  showLifecycleFilter?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [lifecycle, setLifecycle] = useState<string>('all');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = tools.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      if (lifecycle !== 'all' && t.lifecycle !== lifecycle) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.one_liner ?? '').toLowerCase().includes(q) ||
        (t.what_it_is ?? '').toLowerCase().includes(q) ||
        (t.category ?? '').toLowerCase().includes(q) ||
        t.alternatives.some((a) => a.toLowerCase().includes(q))
      );
    });

    if (!q) return matches;

    // Search deliberately matches alternatives too, so you can find a tool by
    // what it replaces. That makes name-match relevance necessary: without it,
    // searching "tailwind" surfaces Bootstrap first purely because B < T.
    // This is relevance ordering, not popularity ranking — nothing here is
    // scored by how many people use it.
    const rank = (t: (typeof matches)[number]) => {
      const name = t.name.toLowerCase();
      if (name === q) return 0;
      if (name.startsWith(q)) return 1;
      if (name.includes(q)) return 2;
      return 3;
    };
    return [...matches].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [tools, query, category, lifecycle]);

  const lifecyclesPresent = useMemo(
    () => [...new Set(tools.map((t) => t.lifecycle).filter(Boolean))] as string[],
    [tools],
  );

  /**
   * Narrowing the results starts the count again. Without this, filtering after
   * expanding leaves the reader looking at a page size they never chose, and
   * "Show 12 more" would appear under a list of three.
   */
  const filterSignature = `${query}|${category}|${lifecycle}|${tools.length}`;
  const [prevSignature, setPrevSignature] = useState(filterSignature);
  if (filterSignature !== prevSignature) {
    setPrevSignature(filterSignature);
    setVisible(PAGE_SIZE);
  }

  const shown = filtered.slice(0, visible);
  const remaining = filtered.length - shown.length;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex-1 sm:min-w-[16rem] sm:max-w-[28rem]">
          <label htmlFor="tool-search" className="mb-1 block text-xs font-semibold" style={{ color: 'var(--fg-dim)' }}>
            Search
          </label>
          <input
            id="tool-search"
            data-testid="tool-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, description, category, alternative…"
            className="w-full rounded-sm border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)', color: 'var(--fg)' }}
          />
        </div>

        <div>
          <label htmlFor="cat-filter" className="mb-1 block text-xs font-semibold" style={{ color: 'var(--fg-dim)' }}>
            Category
          </label>
          <select
            id="cat-filter"
            data-testid="category-filter"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-sm border px-3 py-2 text-sm sm:w-auto"
            style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)', color: 'var(--fg)' }}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {showLifecycleFilter && lifecyclesPresent.length > 1 ? (
          <div>
            <label htmlFor="lc-filter" className="mb-1 block text-xs font-semibold" style={{ color: 'var(--fg-dim)' }}>
              Lifecycle
            </label>
            <select
              id="lc-filter"
              data-testid="lifecycle-filter"
              value={lifecycle}
              onChange={(e) => setLifecycle(e.target.value)}
              className="w-full rounded-sm border px-3 py-2 text-sm sm:w-auto"
              style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)', color: 'var(--fg)' }}
            >
              <option value="all">All</option>
              {lifecyclesPresent.map((l) => (
                <option key={l} value={l}>{LIFECYCLE_META[l]?.label ?? l}</option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <p className="mb-4 max-w-[68ch] text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
        <span data-testid="result-count">{filtered.length}</span> of {tools.length} match
        {remaining > 0 ? <>, <span data-testid="shown-count">{shown.length}</span> shown</> : null}.
        {query.trim()
          ? ' Closest name matches first, then alphabetical. Search also matches a tool’s listed alternatives, so you can find something by what it replaces.'
          : ' Listed alphabetically.'}{' '}
        There is no popularity ranking here and no overall score. {LIFECYCLE_CAVEAT}
      </p>

      {filtered.length === 0 ? (
        <EmptyState title="Nothing matches those filters.">
          <p>Try clearing the search box or switching the category back to “All categories”.</p>
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((t) => (
              <ToolCard key={t.slug} tool={t} domain={domain} />
            ))}
          </div>

          {/* Announced rather than only drawn, so the count reaches a reader
              who cannot see the grid grow. */}
          <p className="sr-only" role="status" aria-live="polite">
            Showing {shown.length} of {filtered.length} matching tools.
          </p>

          {remaining > 0 ? (
            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                type="button"
                data-testid="load-more"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="rounded-sm border px-4 py-2 text-sm font-medium transition-colors"
                style={{ borderColor: 'var(--color-ember)', color: 'var(--color-ember)' }}
              >
                Show {Math.min(PAGE_SIZE, remaining)} more
              </button>
              <span className="text-xs" style={{ color: 'var(--fg-faint)' }}>
                {remaining} still to show
              </span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import type { ToolView } from '../lib/views.ts';
import { formatYearMonth } from '../lib/provenance.ts';
import { DraftBanner, LifecycleBadge, ProvenanceChip } from './Provenance.tsx';
import { ToolStateButtons } from './ToolStateButtons.tsx';

export function ToolCard({ tool, domain }: { tool: ToolView; domain: string }) {
  return (
    <article
      data-testid="tool-card"
      data-slug={tool.slug}
      data-lifecycle={tool.lifecycle ?? ''}
      data-category={tool.category ?? ''}
      className="flex flex-col gap-3 rounded-sm border p-4"
      style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg leading-tight">
          <Link
            href={`/${domain}/tools/${tool.slug}/`}
            className="hover:underline"
            style={{ color: 'var(--fg)' }}
          >
            {tool.name}
          </Link>
        </h3>
        <LifecycleBadge lifecycle={tool.lifecycle} />
      </div>

      {tool.one_liner ? (
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
          {tool.one_liner}
        </p>
      ) : null}

      {tool.hasDraftNote && !tool.hasSignedNote ? <DraftBanner compact /> : null}

      {/* Where it may NOT fit is shown on the card itself, not buried in detail. */}
      {tool.not_suitable_for.length ? (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
          <span className="font-semibold" style={{ color: 'var(--fg-dim)' }}>
            May not suit:{' '}
          </span>
          {tool.not_suitable_for[0]}
          {tool.not_suitable_for.length > 1 ? ` (+${tool.not_suitable_for.length - 1} more)` : ''}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {tool.evidence.map((e) => (
          <ProvenanceChip key={e.tier} kind={e.tier} detail={`${e.count} · ${formatYearMonth(e.latest)}`} />
        ))}
        {tool.archive_years.length ? (
          <ProvenanceChip kind="archive" detail={tool.archive_years.join(', ')} />
        ) : null}
        {tool.evidence.length === 0 && tool.archive_years.length === 0 ? (
          <span className="text-[11px]" style={{ color: 'var(--fg-faint)' }}>
            No supporting signals recorded yet
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <ToolStateButtons slug={tool.slug} size="sm" />
        <Link
          href={`/${domain}/tools/${tool.slug}/`}
          className="text-xs font-semibold hover:underline"
          style={{ color: 'var(--color-ember)' }}
        >
          Details →
        </Link>
      </div>
    </article>
  );
}

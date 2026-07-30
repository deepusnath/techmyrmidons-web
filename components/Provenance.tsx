import type { EvidenceTier } from '../content/schema.ts';
import {
  ARCHIVE_META,
  DEMO_META,
  DRAFT_LABEL,
  LIFECYCLE_CAVEAT,
  LIFECYCLE_META,
  TIER_META,
  formatDate,
} from '../lib/provenance.ts';

type ChipKind = EvidenceTier | 'archive' | 'demo';

function metaFor(kind: ChipKind) {
  if (kind === 'archive') return ARCHIVE_META;
  if (kind === 'demo') return DEMO_META;
  return TIER_META[kind];
}

/**
 * The single visual vocabulary for "where did this claim come from".
 * Each tier gets its own hue and its own explanation on hover/focus so the
 * four kinds of evidence never read as interchangeable.
 */
export function ProvenanceChip({
  kind,
  detail,
  className = '',
}: {
  kind: ChipKind;
  detail?: string;
  className?: string;
}) {
  const meta = metaFor(kind);
  return (
    <span
      title={`${meta.label} — ${meta.description}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight whitespace-nowrap ${className}`}
      style={{ borderColor: meta.color, color: meta.color }}
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      <span>{meta.short}</span>
      {detail ? <span className="opacity-70">· {detail}</span> : null}
    </span>
  );
}

export function LifecycleBadge({ lifecycle }: { lifecycle: string | null }) {
  if (!lifecycle) return null;
  const meta = LIFECYCLE_META[lifecycle];
  if (!meta) return null;
  return (
    <span
      title={`${meta.label} — ${meta.blurb} ${LIFECYCLE_CAVEAT}`}
      className="inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ background: `${meta.color}22`, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

/**
 * Shown wherever AI-assisted draft text appears. Deliberately loud: this
 * material has not been reviewed and must never be mistaken for signed content.
 */
export function DraftBanner({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-sm border border-dashed px-2 py-0.5 text-[11px] font-semibold"
        style={{ borderColor: '#c8913a', color: '#c8913a' }}
      >
        ⚠ {DRAFT_LABEL}
      </span>
    );
  }
  return (
    <div
      role="note"
      className="mb-3 flex items-start gap-2 rounded-sm border border-dashed px-3 py-2 text-xs leading-relaxed"
      style={{ borderColor: '#c8913a', color: '#c8913a', background: '#c8913a11' }}
    >
      <span aria-hidden className="mt-px">⚠</span>
      <span>
        <strong className="font-semibold">{DRAFT_LABEL}.</strong>{' '}
        Written with AI assistance and not yet signed off by the domain editor, so it carries no
        byline. Treat it as a proposal, not as a published judgement.
      </span>
    </div>
  );
}

export function Byline({
  author,
  date,
  draft,
}: {
  author: string;
  date: string;
  draft: boolean;
}) {
  // Draft material must never appear under a person's name.
  if (draft) {
    return (
      <p className="text-xs" style={{ color: 'var(--fg-faint)' }}>
        Unattributed pending review · drafted {formatDate(date)}
      </p>
    );
  }
  return (
    <p className="text-xs" style={{ color: 'var(--fg-faint)' }}>
      By <span style={{ color: 'var(--fg-dim)' }}>{author}</span> · {formatDate(date)}
    </p>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-sm border border-dashed px-4 py-6 text-sm"
      style={{ borderColor: 'var(--rule)', color: 'var(--fg-dim)' }}
    >
      <p className="mb-1 font-medium" style={{ color: 'var(--fg)' }}>
        {title}
      </p>
      {children}
    </div>
  );
}

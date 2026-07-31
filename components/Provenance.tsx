import Link from 'next/link';
import type { EditorialReview, EvidenceTier } from '../content/schema.ts';
import {
  ARCHIVE_META,
  BASIS_META,
  DEMO_META,
  DRAFT_LABEL,
  DRAFT_LABEL_SHORT,
  EVENT_TYPE_META,
  LIFECYCLE_CAVEAT,
  LIFECYCLE_META,
  REPO_CONTEXT_META,
  TIER_META,
  formatDate,
  reviewAttribution,
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
  author: string | null;
  date: string;
  draft: boolean;
}) {
  // Draft material must never appear under a person's name. `author` is also
  // null in storage for unreviewed records, so this is belt and braces.
  if (draft || !author) {
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

/**
 * Compact review marker for AI-authored editorial claims. Used on every card
 * and every claim block so draft status is visible without a paragraph of
 * explanation each time.
 */
export function ReviewChip({
  review,
  className = '',
}: {
  review: Pick<EditorialReview, 'editorial_status' | 'reviewed_by' | 'reviewed_at'>;
  className?: string;
}) {
  const reviewed = review.editorial_status === 'reviewed';
  const attribution = reviewed
    ? reviewAttribution(review as EditorialReview)
    : 'Written with AI assistance and not reviewed by a human editor. No byline is attached because none has been earned.';

  return (
    <span
      data-testid={reviewed ? 'review-chip-reviewed' : 'review-chip-draft'}
      title={attribution ?? undefined}
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${className}`}
      style={
        reviewed
          ? { borderColor: 'var(--color-tier-community)', color: 'var(--color-tier-community)' }
          : { borderColor: '#c8913a', borderStyle: 'dashed', color: '#c8913a' }
      }
    >
      {reviewed ? '✓ Reviewed' : `⚠ ${DRAFT_LABEL_SHORT}`}
    </span>
  );
}

/** Explains what a timeline event means and what it rests on. */
export function TimelineEventRow({
  event,
  toolName,
  href,
}: {
  event: {
    type: string;
    tool_slug: string;
    basis: string;
    basis_detail: string;
    source_url: string | null;
    claim_status: 'sourced' | 'ai_draft';
  };
  toolName: string;
  href: string;
}) {
  const meta = EVENT_TYPE_META[event.type];
  const basis = BASIS_META[event.basis];
  return (
    <li
      data-testid={`event-${event.tool_slug}`}
      data-event-type={event.type}
      data-claim-status={event.claim_status}
      className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs"
    >
      <span className="font-semibold" style={{ color: 'var(--fg-dim)' }}>{meta?.label ?? event.type}:</span>
      {/* next/link, not a raw anchor — only Link applies the deployment basePath. */}
      <Link href={href} className="hover:underline" style={{ color: 'var(--color-ember)' }}>{toolName}</Link>
      <span
        className="rounded-sm border px-1.5 py-0.5 text-[10px]"
        style={{
          borderColor: basis?.color ?? 'var(--rule)',
          color: basis?.color ?? 'var(--fg-faint)',
          borderStyle: event.claim_status === 'ai_draft' ? 'dashed' : 'solid',
        }}
        title={`${meta?.meaning ?? ''} Basis: ${event.basis_detail}`}
      >
        {basis?.label ?? event.basis}
      </span>
      {event.source_url ? (
        <a
          href={event.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] hover:underline"
          style={{ color: 'var(--color-tier-observed)' }}
        >
          source ↗
        </a>
      ) : null}
    </li>
  );
}

/** Renders a repository signal as a literal file-change statement. */
export function RepoSignalRow({
  statement,
  contextStatus,
  sourceUrl,
  eligible,
}: {
  statement: string;
  contextStatus: string;
  sourceUrl: string | null;
  eligible: boolean;
}) {
  const ctx = REPO_CONTEXT_META[contextStatus as keyof typeof REPO_CONTEXT_META];
  return (
    <li
      data-testid="repo-signal"
      className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b pb-2 text-sm"
      style={{ borderColor: 'var(--rule)' }}
    >
      <span className="flex-1 min-w-[14rem]" style={{ color: 'var(--fg-dim)' }}>{statement}</span>
      <span
        className="rounded-sm border px-1.5 py-0.5 text-[10px]"
        style={{ borderColor: 'var(--rule)', color: 'var(--fg-faint)' }}
        title={ctx?.description}
      >
        {ctx?.label ?? contextStatus}
      </span>
      {!eligible ? (
        <span className="text-[10px]" style={{ color: 'var(--fg-faint)' }} title="Repository signals do not feed lifecycle classification or recommendations until a human has reviewed the repository's context.">
          not used for trends
        </span>
      ) : null}
      {sourceUrl ? (
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: 'var(--color-tier-observed)' }}>
          commit ↗
        </a>
      ) : null}
    </li>
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

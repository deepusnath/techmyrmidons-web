import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDomain, getDomains, getEditorialFor, getSignalsFor, getTools } from '../../../../lib/content.ts';
import { getToolView } from '../../../../lib/views.ts';
import {
  ARCHIVE_META,
  LIFECYCLE_CAVEAT,
  LIFECYCLE_META,
  TIER_META,
  formatDate,
  isVisible,
  describeRepoSignal,
} from '../../../../lib/provenance.ts';
import { Byline, DraftBanner, EmptyState, LifecycleBadge, ProvenanceChip, RepoSignalRow, ReviewChip } from '../../../../components/Provenance.tsx';
import { ToolStateButtons } from '../../../../components/ToolStateButtons.tsx';

export function generateStaticParams() {
  return getDomains()
    .filter((d) => d.status === 'active')
    .flatMap((d) => getTools(d.slug).map((t) => ({ domain: d.slug, slug: t.slug })));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--fg-faint)' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function ToolDetail({
  params,
}: {
  params: Promise<{ domain: string; slug: string }>;
}) {
  const { domain: domainSlug, slug } = await params;
  const domain = getDomain(domainSlug);
  const tool = getToolView(domainSlug, slug);
  if (!domain || domain.status !== 'active' || !tool) notFound();

  const notes = getEditorialFor(domainSlug, slug).filter(isVisible);
  const signals = getSignalsFor(domainSlug, slug);
  const lifecycleMeta = tool.lifecycle ? LIFECYCLE_META[tool.lifecycle] : null;

  return (
    <article className="max-w-3xl">
      <nav className="mb-6 text-sm">
        <Link href={`/${domainSlug}/`} className="hover:underline" style={{ color: 'var(--fg-faint)' }}>
          ← {domain.name} Myrmidon
        </Link>
      </nav>

      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">{tool.name}</h1>
          <LifecycleBadge lifecycle={tool.lifecycle} />
          <ReviewChip review={tool} />
          {!tool.published ? (
            <span
              className="rounded-sm border border-dashed px-2 py-0.5 text-[11px] font-semibold"
              style={{ borderColor: 'var(--color-tier-archive)', color: 'var(--color-tier-archive)' }}
            >
              Archive record only — not a current recommendation
            </span>
          ) : null}
        </div>

        {tool.one_liner ? (
          <p className="mb-3 text-base leading-relaxed" style={{ color: 'var(--fg-dim)' }}>{tool.one_liner}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {tool.homepage ? (
            <a
              href={tool.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold hover:underline"
              style={{ color: 'var(--color-ember)' }}
            >
              {new URL(tool.homepage).hostname} ↗
            </a>
          ) : (
            <span className="text-sm" style={{ color: 'var(--fg-faint)' }}>No homepage recorded</span>
          )}
          {tool.category ? (
            <span className="text-sm" style={{ color: 'var(--fg-faint)' }}>· {tool.category}</span>
          ) : null}
          {tool.first_seen_year ? (
            <span className="text-sm" style={{ color: 'var(--fg-faint)' }}>· since {tool.first_seen_year}</span>
          ) : null}
        </div>
      </header>

      <div
        className="mb-8 rounded-sm border p-4"
        style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)' }}
      >
        <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--fg-dim)' }}>Your progress with this tool</p>
        <ToolStateButtons slug={tool.slug} showProvenHint />
        <p className="mt-2 text-[11px]" style={{ color: 'var(--fg-faint)' }}>
          Saved in this browser only. Nothing is uploaded and no account is needed.
        </p>
      </div>

      {!tool.showEditorial ? (
        <div
          data-testid="editorial-withheld"
          className="mb-8 rounded-sm border border-dashed p-4 text-sm leading-relaxed"
          style={{ borderColor: '#c8913a', color: '#c8913a' }}
        >
          <strong>Editorial withheld pending review.</strong> The description, lifecycle
          classification and suitability guidance for this tool are AI-authored and have not been
          checked by a human editor, so this build does not display them as facts. The name, link and
          any sourced repository signals below are unaffected.
        </div>
      ) : null}

      {tool.what_it_is ? (
        <Section title="What it is">
          <p className="text-[15px] leading-relaxed">{tool.what_it_is}</p>
          {tool.is_seed ? (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--fg-faint)' }}>
              <ProvenanceChip kind="archive" />
              <span>{ARCHIVE_META.description}</span>
            </p>
          ) : null}
        </Section>
      ) : null}

      {tool.why_it_matters ? (
        <Section title="Why it matters">
          <p className="text-[15px] leading-relaxed">{tool.why_it_matters}</p>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <ProvenanceChip kind="editorial" />
            <ReviewChip review={tool} />
            <span className="text-xs" style={{ color: 'var(--fg-faint)' }}>
              A written argument, not a measurement. Repository signals did not produce it.
            </span>
          </p>
        </Section>
      ) : null}

      {lifecycleMeta ? (
        <Section title="Lifecycle status">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
            <strong style={{ color: lifecycleMeta.color }}>{lifecycleMeta.label}.</strong>{' '}
            {lifecycleMeta.blurb}
          </p>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
            {LIFECYCLE_CAVEAT}
          </p>
        </Section>
      ) : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-sm border p-4" style={{ borderColor: 'var(--color-tier-community)' }}>
          <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--color-tier-community)' }}>
            Who it suits
          </h2>
          {tool.suitable_for.length ? (
            <ul className="space-y-1.5 text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
              {tool.suitable_for.map((s) => <li key={s}>· {s}</li>)}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: 'var(--fg-faint)' }}>Not yet written up.</p>
          )}
        </div>

        <div className="rounded-sm border p-4" style={{ borderColor: '#c8913a' }}>
          <h2 className="mb-2 text-sm font-semibold" style={{ color: '#c8913a' }}>
            Where it may not fit
          </h2>
          {tool.not_suitable_for.length ? (
            <ul className="space-y-1.5 text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
              {tool.not_suitable_for.map((s) => <li key={s}>· {s}</li>)}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: 'var(--fg-faint)' }}>
              Not yet written up — which is why this tool is not published as a recommendation.
            </p>
          )}
        </div>
      </div>

      {tool.alternatives.length ? (
        <Section title="Alternatives to weigh">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
            {tool.alternatives.join(' · ')}
          </p>
        </Section>
      ) : null}

      {notes.length ? (
        <Section title="Editorial basis">
          <div className="space-y-4">
            {notes.map((n) => (
              <div key={n.id} className="rounded-sm border p-4" style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)' }}>
                {n.draft ? <DraftBanner /> : null}
                <p className="mb-3 text-sm leading-relaxed">{n.body}</p>
                <div className="rounded-sm border-l-2 pl-3" style={{ borderColor: '#c8913a' }}>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#c8913a' }}>
                    Where this might be wrong
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-dim)' }}>{n.tradeoffs}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ProvenanceChip kind="editorial" />
                  <Byline author={n.author} date={n.published_at} draft={n.draft} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Supporting signals">
        {signals.length === 0 ? (
          <EmptyState title="No signals recorded for this tool yet.">
            <p>
              Observed evidence comes from public repository history; editorial signals come from the
              original curated archive. Neither exists for this tool, and nothing is invented to fill
              the gap.
            </p>
          </EmptyState>
        ) : (
          <>
            <p className="mb-3 text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
              Each signal states what kind of evidence it is. {TIER_META.observed.description}
            </p>
            <ul className="space-y-2">
              {signals.slice(0, 24).map((s) =>
                s.tier === 'observed' ? (
                  <RepoSignalRow
                    key={s.id}
                    statement={describeRepoSignal({
                      tool_slug: tool.name,
                      repo: s.repo,
                      manifest_path: s.manifest_path,
                      action: s.action,
                      source_url: s.source_url,
                      observed_at: s.observed_at,
                    })}
                    contextStatus={s.context_status ?? 'unknown'}
                    sourceUrl={s.source_url}
                    eligible={s.eligible_for_trends ?? false}
                  />
                ) : (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-2 text-sm"
                    style={{ borderColor: 'var(--rule)' }}
                  >
                    <ProvenanceChip kind={s.is_seed ? 'archive' : s.tier} />
                    <span className="flex-1 min-w-[12rem]" style={{ color: 'var(--fg-dim)' }}>
                      {s.source_label}
                    </span>
                    <span className="text-xs whitespace-nowrap" style={{ color: 'var(--fg-faint)' }}>
                      {formatDate(s.observed_at)}
                    </span>
                  </li>
                ),
              )}
            </ul>
            {signals.length > 24 ? (
              <p className="mt-2 text-xs" style={{ color: 'var(--fg-faint)' }}>
                Showing 24 of {signals.length}.
              </p>
            ) : null}
          </>
        )}
      </Section>
    </article>
  );
}

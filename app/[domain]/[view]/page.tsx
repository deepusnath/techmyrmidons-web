import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CATEGORIES, getDomain, getDomains, getTimeline } from '../../../lib/content.ts';
import { getAllToolViews, getToolViews, LANDSCAPE_VIEWS, type LandscapeSlug } from '../../../lib/views.ts';
import { SHOW_DRAFTS } from '../../../lib/provenance.ts';
import { routes } from '../../../lib/routes.ts';
import { LandscapeBrowser } from '../../../components/LandscapeBrowser.tsx';
import { DraftBanner, EmptyState, ProvenanceChip, TimelineEventRow } from '../../../components/Provenance.tsx';

export function generateStaticParams() {
  const domains = getDomains().filter((d) => d.status === 'active');
  return domains.flatMap((d) =>
    Object.keys(LANDSCAPE_VIEWS).map((view) => ({ domain: d.slug, view })),
  );
}

export default async function LandscapeView({
  params,
}: {
  params: Promise<{ domain: string; view: string }>;
}) {
  const { domain: slug, view } = await params;
  const domain = getDomain(slug);
  const config = LANDSCAPE_VIEWS[view as LandscapeSlug];
  if (!domain || domain.status !== 'active' || !config) notFound();

  const isHistorical = view === 'historical';
  const tools = getToolViews(slug).filter((t) => config.lifecycles.includes(t.lifecycle as never));
  const allTools = getAllToolViews(slug);
  const toolName = (s: string) => allTools.find((t) => t.slug === s)?.name ?? s;

  /**
   * Year narrative and event provenance are gated separately.
   *
   * The archive events are verifiable — the tool really does appear in a dated
   * file. The paragraphs interpreting those files were written for the rebuild
   * and are not archive content, so a production build keeps the events and
   * withholds the prose.
   */
  const timeline = getTimeline(slug)
    .map((year) => {
      const events = year.events.filter((e) => SHOW_DRAFTS || e.claim_status === 'sourced');
      const showNarrative = SHOW_DRAFTS || year.headline_status === 'reviewed';
      return { ...year, events, showNarrative };
    })
    .filter((year) => year.showNarrative || year.events.length > 0);

  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-2 text-sm" aria-label="Landscape views">
        <Link href={routes.domain(slug)} className="hover:underline" style={{ color: 'var(--fg-faint)' }}>
          ← {domain.name} Myrmidon
        </Link>
      </nav>

      <div className="mb-6 flex flex-wrap gap-2">
        {Object.values(LANDSCAPE_VIEWS).map((v) => (
          <Link
            key={v.slug}
            href={routes.landscape(slug, v.slug)}
            data-testid={`tab-${v.slug}`}
            aria-current={v.slug === view ? 'page' : undefined}
            className="rounded-sm border px-3 py-1.5 text-sm font-medium"
            style={{
              borderColor: v.slug === view ? 'var(--color-ember)' : 'var(--rule)',
              background: v.slug === view ? 'var(--color-ember)' : 'transparent',
              color: v.slug === view ? '#fff' : 'var(--fg-dim)',
            }}
          >
            {v.title}
          </Link>
        ))}
      </div>

      <header className="mb-8 max-w-[68ch]">
        <h1 className="mb-2 text-3xl">{config.title}</h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>{config.lede}</p>
        {isHistorical ? (
          <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
            The archive records what TechMyrmidons listed in a given year. That is a verifiable fact
            about this site — it is not evidence of what frontend developers in general used, and
            claims about deprecation, support or significance carry their own sources where they
            exist.
          </p>
        ) : null}
      </header>

      {isHistorical ? (
        <section>
          {timeline.length === 0 ? (
            <EmptyState title="No timeline entries can be shown in this build.">
              <p>Every entry is either unreviewed narrative or has no sourced events.</p>
            </EmptyState>
          ) : (
            <ol className="space-y-8">
              {timeline.map((e) => (
                <li key={e.id} data-testid={`year-${e.year}`} className="border-l-2 pl-5" style={{ borderColor: 'var(--rule)' }}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="display text-2xl font-semibold" style={{ color: 'var(--color-ember)' }}>
                      {e.year}
                    </h2>
                    {e.is_seed ? <ProvenanceChip kind="archive" detail="original curation" /> : null}
                  </div>

                  {e.showNarrative ? (
                    <>
                      {e.headline_status !== 'reviewed' ? <DraftBanner /> : null}
                      <p className="mb-2 max-w-[68ch] text-base leading-snug font-medium">{e.headline}</p>
                      <p className="mb-3 max-w-[68ch] text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
                        {e.body}
                      </p>
                    </>
                  ) : (
                    /* Strictly factual heading. No interpretation survives here. */
                    <p
                      data-testid={`factual-heading-${e.year}`}
                      className="mb-3 text-base leading-snug font-medium"
                    >
                      Tools first included in TechMyrmidons in {e.year}
                      <span className="ml-2 text-xs font-normal" style={{ color: 'var(--fg-faint)' }}>
                        · narrative withheld pending editorial review
                      </span>
                    </p>
                  )}

                  {e.events.length ? (
                    <>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fg-faint)' }}>
                        Events — each shows what kind of claim it is
                      </p>
                      <ul className="space-y-1.5">
                        {e.events.map((ev) => (
                          <TimelineEventRow
                            key={`${ev.type}-${ev.tool_slug}`}
                            event={ev}
                            toolName={toolName(ev.tool_slug)}
                            href={routes.tool(slug, ev.tool_slug)}
                          />
                        ))}
                      </ul>
                    </>
                  ) : null}

                  <p className="mt-3 text-[11px]" style={{ color: 'var(--fg-faint)' }}>
                    {e.author ? `By ${e.author}` : 'Narrative unattributed pending review'}
                    {e.is_seed && e.seed_source ? ` · events sourced from ${e.seed_source}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-10">
            <h2 className="mb-3 text-xl">Legacy tools</h2>
            <p className="mb-4 max-w-[68ch] text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
              Superseded, kept because recognising them tells you when a codebase or tutorial was
              written.
            </p>
            {tools.length ? (
              <LandscapeBrowser tools={tools} domain={slug} categories={CATEGORIES(slug)} />
            ) : (
              <EmptyState title="No legacy tools can be shown in this build.">
                <p>Lifecycle is an unreviewed editorial classification and is withheld here.</p>
              </EmptyState>
            )}
          </div>
        </section>
      ) : tools.length === 0 ? (
        <EmptyState title={`Nothing can be shown as ${config.title.toLowerCase()} in this build.`}>
          <p>
            Lifecycle is an editorial classification. Every classification is currently unreviewed,
            so this build withholds it rather than presenting it as established.
          </p>
        </EmptyState>
      ) : (
        <LandscapeBrowser tools={tools} domain={slug} categories={CATEGORIES(slug)} />
      )}
    </div>
  );
}

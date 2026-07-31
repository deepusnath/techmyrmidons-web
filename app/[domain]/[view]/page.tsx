import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CATEGORIES, getDomain, getDomains, getTimeline } from '../../../lib/content.ts';
import { getAllToolViews, getToolViews, LANDSCAPE_VIEWS, type LandscapeSlug } from '../../../lib/views.ts';
import { isVisible } from '../../../lib/provenance.ts';
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
  const timeline = getTimeline(slug).filter(isVisible);
  const allTools = getAllToolViews(slug);
  const toolName = (s: string) => allTools.find((t) => t.slug === s)?.name ?? s;

  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-2 text-sm" aria-label="Landscape views">
        <Link href={`/${slug}/`} className="hover:underline" style={{ color: 'var(--fg-faint)' }}>
          ← {domain.name} Myrmidon
        </Link>
      </nav>

      <div className="mb-6 flex flex-wrap gap-2">
        {Object.values(LANDSCAPE_VIEWS).map((v) => (
          <Link
            key={v.slug}
            href={`/${slug}/${v.slug}/`}
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

      <header className="mb-8 max-w-3xl">
        <h1 className="mb-2 text-3xl">{config.title}</h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>{config.lede}</p>
      </header>

      {isHistorical ? (
        <section>
          {timeline.length === 0 ? (
            <EmptyState title="No timeline has been recorded for this domain.">
              <p>The Historical view needs at least one curated or authored year.</p>
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
                    {!e.is_seed && !e.draft ? <ProvenanceChip kind="editorial" /> : null}
                  </div>

                  {e.draft ? <DraftBanner /> : null}

                  <p className="mb-2 text-base leading-snug font-medium">{e.headline}</p>
                  <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>{e.body}</p>

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
                            href={`/${slug}/tools/${ev.tool_slug}/`}
                          />
                        ))}
                      </ul>
                    </>
                  ) : null}

                  {/* Draft years carry no byline — see lib/provenance.ts */}
                  <p className="mt-3 text-[11px]" style={{ color: 'var(--fg-faint)' }}>
                    {e.draft
                      ? 'Unattributed pending review'
                      : e.is_seed
                        ? `Source: ${e.seed_source}`
                        : `By ${e.author}`}
                  </p>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-10">
            <h2 className="mb-3 text-xl">Legacy tools</h2>
            <p className="mb-4 max-w-3xl text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
              Superseded, kept because recognising them tells you when a codebase or tutorial was
              written.
            </p>
            {tools.length ? (
              <LandscapeBrowser tools={tools} domain={slug} categories={CATEGORIES(slug)} />
            ) : (
              <EmptyState title="No legacy tools recorded." />
            )}
          </div>
        </section>
      ) : tools.length === 0 ? (
        <EmptyState title={`Nothing is currently marked as ${config.title.toLowerCase()}.`}>
          <p>
            This is an honest empty state rather than filler — no tool in the catalogue carries that
            lifecycle right now.
          </p>
        </EmptyState>
      ) : (
        <LandscapeBrowser tools={tools} domain={slug} categories={CATEGORIES(slug)} />
      )}
    </div>
  );
}

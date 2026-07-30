import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getDomain,
  getDomainNote,
  getDomains,
  getPractitioners,
  getResources,
  getTimeline,
} from '../../lib/content.ts';
import { getToolViews, LANDSCAPE_VIEWS } from '../../lib/views.ts';
import { formatDate, isVisible, LIFECYCLE_CAVEAT } from '../../lib/provenance.ts';
import { Byline, DraftBanner, EmptyState, ProvenanceChip } from '../../components/Provenance.tsx';
import { FollowButton } from '../../components/ToolStateButtons.tsx';

export function generateStaticParams() {
  return getDomains().filter((d) => d.status === 'active').map((d) => ({ domain: d.slug }));
}

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default async function DomainHome({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: slug } = await params;
  const domain = getDomain(slug);
  if (!domain || domain.status !== 'active') notFound();

  const tools = getToolViews(slug);
  const note = getDomainNote(slug);
  const showNote = note && isVisible(note);
  const timeline = getTimeline(slug).filter(isVisible);
  const practitioners = getPractitioners(slug);
  const resources = getResources(slug);

  const counts = {
    current: tools.filter((t) => t.lifecycle === 'established').length,
    emerging: tools.filter((t) => t.lifecycle === 'emerging').length,
    declining: tools.filter((t) => t.lifecycle === 'declining').length,
    historical: tools.filter((t) => t.lifecycle === 'legacy').length,
  };

  const recent = timeline.slice(0, 3);

  return (
    <div>
      {/* --- character header --- */}
      <section className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${base}/brand/myrmidon.gif`}
          alt=""
          className="h-24 w-24 shrink-0 rounded-sm border object-cover"
          style={{ borderColor: 'var(--rule)' }}
        />
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-ember)' }}>
            Domain Myrmidon
          </p>
          <h1 className="mb-3 text-3xl sm:text-4xl">{domain.name} Myrmidon</h1>
          <p className="mb-4 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
            A virtual technology icon that keeps itself current in {domain.name.toLowerCase()},
            changes its tools to match the trends, and follows the right experts. It consolidates
            what practitioners publish, what public repositories show, and what an editor judges
            worth your attention — and it always shows you which of those a claim came from.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <FollowButton domain={slug} label={`${domain.name} Myrmidon`} />
            <Link
              href="/me/"
              className="text-sm font-semibold hover:underline"
              style={{ color: 'var(--fg-dim)' }}
            >
              See where I stand →
            </Link>
          </div>
        </div>
      </section>

      {/* --- what matters now --- */}
      <section className="mb-12">
        <h2 className="mb-3 text-xl">What is changing, and why it matters</h2>
        {showNote ? (
          <div
            className="max-w-[68ch] rounded-sm border p-5"
            style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)' }}
          >
            {note.draft ? <DraftBanner /> : null}
            <p className="mb-4 text-[15px] leading-relaxed">{note.body}</p>
            <div className="rounded-sm border-l-2 pl-3" style={{ borderColor: 'var(--color-ember)' }}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-ember)' }}>
                Where this might be wrong
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-dim)' }}>{note.tradeoffs}</p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ProvenanceChip kind="editorial" />
              <Byline author={note.author} date={note.published_at} draft={note.draft} />
            </div>
          </div>
        ) : (
          <EmptyState title="No editorial note has been published for this domain yet.">
            <p>When the domain editor publishes one it will appear here, signed and dated.</p>
          </EmptyState>
        )}
      </section>

      {/* --- landscape views --- */}
      <section className="mb-12">
        <h2 className="mb-1 text-xl">The landscape</h2>
        <p className="mb-5 max-w-3xl text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
          {LIFECYCLE_CAVEAT}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.values(LANDSCAPE_VIEWS).map((v) => (
            <Link
              key={v.slug}
              href={`/${slug}/${v.slug}/`}
              data-testid={`view-${v.slug}`}
              className="group rounded-sm border p-4 transition-colors"
              style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)' }}
            >
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="display text-lg font-semibold">{v.title}</span>
                <span className="text-xs" style={{ color: 'var(--fg-faint)' }}>
                  {v.slug === 'historical'
                    ? `${timeline.length} years`
                    : `${counts[v.slug as keyof typeof counts]} tools`}
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-dim)' }}>{v.lede}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* --- recent years --- */}
      {recent.length ? (
        <section className="mb-12">
          <h2 className="mb-4 text-xl">Recently</h2>
          <ol className="space-y-4">
            {recent.map((e) => (
              <li key={e.id} className="border-l-2 pl-4" style={{ borderColor: 'var(--rule)' }}>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="display text-lg font-semibold" style={{ color: 'var(--color-ember)' }}>{e.year}</span>
                  {e.draft ? <DraftBanner compact /> : null}
                  {e.is_seed ? <ProvenanceChip kind="archive" /> : null}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>{e.headline}</p>
              </li>
            ))}
          </ol>
          <Link
            href={`/${slug}/historical/`}
            className="mt-4 inline-block text-sm font-semibold hover:underline"
            style={{ color: 'var(--color-ember)' }}
          >
            See the full timeline →
          </Link>
        </section>
      ) : null}

      {/* --- practitioners --- */}
      <section className="mb-12">
        <h2 className="mb-1 text-xl">Practitioners this Myrmidon follows</h2>
        <p className="mb-4 max-w-3xl text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
          Real people, carried over from the original site. Their public repositories are one of the
          evidence sources behind observed signals. This list was assembled a decade ago and is due a
          refresh — it skews toward the 2010s web.
        </p>
        <ul className="flex flex-wrap gap-3">
          {practitioners.map((p) => (
            <li key={p.slug} className="flex items-center gap-2 rounded-sm border px-3 py-2" style={{ borderColor: 'var(--rule)' }}>
              {p.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${base}${p.avatar}`} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="h-8 w-8 rounded-full" style={{ background: 'var(--bg-3)' }} />
              )}
              <span className="text-sm">
                {p.links.site || p.links.github || p.links.x ? (
                  <a
                    href={p.links.site ?? p.links.github ?? p.links.x}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    style={{ color: 'var(--fg-dim)' }}
                  >
                    {p.name}
                  </a>
                ) : (
                  p.name
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* --- resources --- */}
      {resources.length ? (
        <section>
          <h2 className="mb-1 text-xl">Publications worth following</h2>
          <p className="mb-4 text-xs" style={{ color: 'var(--fg-faint)' }}>
            From the original curation. Some of these have gone quiet since — links are preserved as
            a record rather than vouched for.
          </p>
          <ul className="flex flex-wrap gap-2">
            {resources.map((r) => (
              <li key={r.slug}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-sm border px-3 py-1.5 text-xs hover:underline"
                  style={{ borderColor: 'var(--rule)', color: 'var(--fg-dim)' }}
                >
                  {r.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

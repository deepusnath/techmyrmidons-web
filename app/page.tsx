import Link from 'next/link';
import { getDomains, getPublishedTools } from '../lib/content.ts';

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function Onboarding() {
  const domains = getDomains();
  const active = domains.filter((d) => d.status === 'active');
  const archived = domains
    .filter((d) => d.status !== 'active')
    .sort((a, b) => (b.last_curated_year ?? 0) - (a.last_curated_year ?? 0));

  return (
    <div>
      <section className="mb-12 max-w-3xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${base}/brand/logo.png`} alt="TechMyrmidons" className="mb-6 h-14 w-auto" />
        <h1 className="mb-4 text-3xl leading-tight sm:text-4xl">
          Pick a domain. Follow its Myrmidon.
        </h1>
        <p className="mb-4 text-base leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
          A Techmyrmidon is a virtual technology icon that keeps itself current, changes its tools to
          match the trends, and follows the right experts in one field. Follow the Myrmidon for your
          area and you get four things a search engine answers badly:{' '}
          <strong style={{ color: 'var(--fg)' }}>what changed</strong>,{' '}
          <strong style={{ color: 'var(--fg)' }}>who credibly says so</strong>,{' '}
          <strong style={{ color: 'var(--fg)' }}>where you stand</strong>, and{' '}
          <strong style={{ color: 'var(--fg)' }}>what to learn next</strong>.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
          No account needed. Nothing is uploaded — what you mark stays in this browser.
        </p>
      </section>

      <section className="mb-14">
        <h2 className="mb-1 text-xl">Active pilot domain</h2>
        <p className="mb-5 text-sm" style={{ color: 'var(--fg-faint)' }}>
          One domain is live while we test the experience properly rather than thinly across twelve.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {active.map((d) => {
            const count = getPublishedTools(d.slug).length;
            return (
              <Link
                key={d.slug}
                href={`/${d.slug}/`}
                data-testid={`domain-${d.slug}`}
                className="group rounded-sm border p-5 transition-colors"
                style={{ borderColor: 'var(--color-ember)', background: 'var(--bg-2)' }}
              >
                <p className="display mb-1 text-2xl font-semibold" style={{ color: 'var(--color-ember)' }}>
                  {d.name} Myrmidon
                </p>
                <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
                  {count} tools written up across current, emerging, declining and historical views,
                  each with where it fits and where it does not.
                </p>
                <span className="text-sm font-semibold group-hover:underline" style={{ color: 'var(--color-ember)' }}>
                  Enter →
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-xl">Archived domains</h2>
        <p className="mb-5 max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
          These were part of the original site and are preserved rather than deleted. Each one states
          honestly why it is archived and when it was last genuinely curated — including where the
          original data turned out to be duplicated or empty.
        </p>

        <ul className="grid gap-3 sm:grid-cols-2">
          {archived.map((d) => (
            <li
              key={d.slug}
              data-testid={`archived-${d.slug}`}
              className="rounded-sm border border-dashed p-4"
              style={{ borderColor: 'var(--rule)' }}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-semibold" style={{ color: 'var(--fg-dim)' }}>{d.name}</span>
                <span
                  className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ borderColor: 'var(--color-tier-archive)', color: 'var(--color-tier-archive)' }}
                >
                  Archived
                </span>
                {d.last_curated_year ? (
                  <span className="text-[11px]" style={{ color: 'var(--fg-faint)' }}>
                    last curated {d.last_curated_year}
                  </span>
                ) : null}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
                {d.archived_reason}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

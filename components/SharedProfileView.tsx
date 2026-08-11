'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { decodeSnapshot, type ProfileSnapshot } from '../lib/profileShare.ts';
import { formatDate } from '../lib/provenance.ts';
import { PROGRESS_META } from '../lib/state.ts';
import { routes } from '../lib/routes.ts';

/**
 * Read-only rendering of a shared snapshot.
 *
 * The fragment is hostile input: it either validates entirely (see
 * lib/profileShare.ts) or nothing renders. And even a valid snapshot proves
 * only that somebody encoded it — the banner says self-reported and unverified
 * because that is exactly what it is.
 */
export function SharedProfileView() {
  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null | undefined>(undefined);

  useEffect(() => {
    // Re-read on hashchange: pasting a second share link over the first changes
    // only the fragment, which is not a navigation the router sees.
    const read = () => {
      const m = window.location.hash.match(/^#s=(.+)$/);
      setSnapshot(m ? decodeSnapshot(m[1]) : null);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  if (snapshot === undefined) return null;

  if (snapshot === null) {
    return (
      <div data-testid="share-invalid" className="max-w-[68ch]">
        <h1 className="mb-2 text-3xl">Nothing to show</h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
          This link carries no readable profile snapshot — it may be truncated or malformed. Ask for
          a fresh link, or{' '}
          <Link href={routes.home()} className="hover:underline" style={{ color: 'var(--color-ember)' }}>
            start your own profile
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-8 max-w-[68ch]">
        <h1 className="mb-2 text-3xl">Shared profile</h1>
        <p
          data-testid="share-provenance"
          role="note"
          className="rounded-sm border border-dashed p-3 text-xs leading-relaxed"
          style={{ borderColor: '#c8913a', color: '#c8913a' }}
        >
          Self-reported by whoever created this link, generated {formatDate(snapshot.generated_at)}.
          Nothing here is verified by TechMyrmidons.
        </p>
      </header>

      {snapshot.domains.map((d) => (
        <section
          key={d.name}
          data-testid="shared-domain"
          className="mb-8 rounded-sm border p-5"
          style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)' }}
        >
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="display text-xl font-semibold">{d.name}</h2>
            <span
              className="rounded-sm border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide"
              style={{ borderColor: 'var(--color-ember)', color: 'var(--color-ember)' }}
            >
              {d.tier}
            </span>
          </div>

          {d.journey ? (
            <p className="mb-3 text-sm" style={{ color: 'var(--fg-dim)' }}>
              {d.journeyLabel ? `${d.journeyLabel} journey: ` : 'Journey: '}
              <strong style={{ color: 'var(--fg)' }}>{d.journey.touched} of {d.journey.total}</strong> in motion ·{' '}
              <strong style={{ color: 'var(--fg)' }}>{d.journey.shipped} of {d.journey.total}</strong> shipped
            </p>
          ) : null}

          {d.recent.length > 0 ? (
            <ul className="space-y-1.5">
              {d.recent.map((m) => (
                <li key={`${m.name}-${m.date}`} className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-xs" style={{ color: 'var(--color-ember)' }}>
                    {PROGRESS_META[m.state].label}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--fg-faint)' }}>{formatDate(m.date)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <p className="text-xs" style={{ color: 'var(--fg-faint)' }}>
        Want one of these?{' '}
        <Link href={routes.home()} className="hover:underline" style={{ color: 'var(--color-ember)' }}>
          Pick a domain and follow its Myrmidon →
        </Link>
      </p>
    </div>
  );
}

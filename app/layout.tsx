import type { Metadata } from 'next';
import { Maitree } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { FeedbackWidget } from '../components/FeedbackWidget.tsx';
import { SHOW_DRAFTS } from '../lib/provenance.ts';
import { routes } from '../lib/routes.ts';

const DOMAIN = 'frontend';

const maitree = Maitree({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-maitree',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TechMyrmidons — stay current in your field',
  description:
    'Follow a Domain Myrmidon: what changed in your field, what evidence supports it, where you stand, and what to learn next.',
};

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={maitree.variable}>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>

        {SHOW_DRAFTS ? (
          <div
            role="note"
            className="px-4 py-1.5 text-center text-[11px] leading-relaxed"
            style={{ background: '#c8913a22', color: '#c8913a' }}
          >
            Pilot preview · some editorial is <strong>AI-assisted draft awaiting domain-editor
            review</strong> and is labelled where it appears.
          </div>
        ) : null}

        <header className="border-b" style={{ borderColor: 'var(--rule)' }}>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href={routes.home()} className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${base}/brand/myrmidon.gif`} alt="" width={28} height={28} className="rounded-sm" />
              <span className="display text-lg font-semibold tracking-tight">TechMyrmidons</span>
            </Link>
            <nav aria-label="Main" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <Link href={routes.domain(DOMAIN)} className="hover:underline" style={{ color: 'var(--fg-dim)' }}>
                Frontend Myrmidon
              </Link>
              <Link href={routes.signals(DOMAIN)} className="hover:underline" style={{ color: 'var(--fg-dim)' }}>
                Signals
              </Link>
              <Link href={routes.me()} className="hover:underline" style={{ color: 'var(--fg-dim)' }} data-testid="nav-me">
                Where I stand
              </Link>
              <Link href={routes.submit()} className="hover:underline" style={{ color: 'var(--fg-dim)' }}>
                Submit
              </Link>
            </nav>
          </div>
        </header>

        <main id="main" className="mx-auto max-w-6xl px-4 py-8">{children}</main>

        <footer className="mt-16 border-t" style={{ borderColor: 'var(--rule)' }}>
          <div className="mx-auto max-w-6xl px-4 py-8 text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
            <p className="mb-2">
              TechMyrmidons is a trust layer for staying current: what changed, where you stand, and
              what to learn next. <strong>Sources and provenance are shown where available.</strong>{' '}
              Much of the current editorial is AI-drafted and unreviewed, and is labelled as such.
              {SHOW_DRAFTS ? (
                <>
                  {' '}See the{' '}
                  <Link href={routes.review()} className="underline" style={{ color: 'var(--color-ember)' }}>
                    editorial review inventory
                  </Link>{' '}
                  for exactly what has and has not been checked.
                </>
              ) : null}
            </p>
            <p>
              Frontend is the active pilot domain. Eleven other domains are archived with their
              reasons shown. Your progress is stored only in this browser — there is no account and
              nothing is uploaded.
            </p>
          </div>
        </footer>

        <FeedbackWidget />
      </body>
    </html>
  );
}

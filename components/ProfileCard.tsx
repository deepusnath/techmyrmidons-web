'use client';

import { computeCompletion } from '../lib/completion.ts';
import { formatDate } from '../lib/provenance.ts';
import { PROGRESS_META, useHydrated, useLocalState, type ProgressState } from '../lib/state.ts';

export interface ProfileDomainData {
  slug: string;
  name: string;
  tools: Array<{ slug: string; name: string; category: string | null }>;
  /** Journey slugs per work context. In production, derived from publishable rules only. */
  journeyByContext: Record<string, string[]>;
  contextLabels: Record<string, string>;
}

/**
 * One domain's slice of "My profile".
 *
 * Grades nothing but the user's own self-reported journey: tiers and honest
 * fractions, never a percentage and never a meter element — the diagnosis's
 * no-score rule protects editorial, and this page keeps to its spirit while
 * describing the user to themselves. See docs/PRODUCT_PLAN_PROFILES.md D2.
 */
export function ProfileCard({ domain }: { domain: ProfileDomainData }) {
  const { marked, assessment } = useLocalState(domain.slug);
  const hydrated = useHydrated();

  const work = hydrated ? assessment.work : null;
  const journeySlugs = work && domain.journeyByContext[work]?.length ? domain.journeyByContext[work] : null;

  const completion = computeCompletion({
    tools: domain.tools,
    marked: hydrated ? marked : {},
    assessmentCompleted: hydrated && Boolean(assessment.completed_at),
    journeySlugs,
  });

  const nameOf = (slug: string) => domain.tools.find((t) => t.slug === slug)?.name ?? slug;

  const recent = Object.entries(hydrated ? marked : {})
    .filter(([slug]) => domain.tools.some((t) => t.slug === slug))
    .sort((a, b) => b[1].updated_at.localeCompare(a[1].updated_at))
    .slice(0, 5);

  // Fallback coverage when no journey applies: categories the user has touched.
  const categories = [...new Set(domain.tools.map((t) => t.category).filter(Boolean))] as string[];
  const touchedCategories = new Set(
    recent.length || Object.keys(marked).length
      ? domain.tools.filter((t) => hydrated && marked[t.slug]).map((t) => t.category).filter(Boolean)
      : [],
  );

  const milestone = completion.nextMilestone;
  const milestoneCopy = (() => {
    if (!milestone) return 'You are the Myrmidon. Keep your marks current — they fade with age.';
    const steps: string[] = [];
    if (milestone.needsAssessment) steps.push('complete the context assessment');
    if (milestone.needsShipped) steps.push('ship with a tool you are using');
    if (milestone.needsShippedCategories > 0) {
      steps.push(`ship in ${milestone.needsShippedCategories} more ${milestone.needsShippedCategories === 1 ? 'category' : 'categories'}`);
    }
    if (steps.length === 0 && milestone.shipsToClose > 0) {
      steps.push(`about ${milestone.shipsToClose} ${milestone.shipsToClose === 1 ? 'ship' : 'ships'} of progress away`);
    }
    return `Next: ${milestone.tier} — ${steps.join(', ')}.`;
  })();

  return (
    <section
      data-testid={`profile-card-${domain.slug}`}
      className="mb-8 rounded-sm border p-5"
      style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)' }}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-xl font-semibold">{domain.name}</h2>
        <span
          data-testid="profile-tier"
          className="rounded-sm border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide"
          style={{
            borderColor: completion.tier ? 'var(--color-ember)' : 'var(--rule)',
            color: completion.tier ? 'var(--color-ember)' : 'var(--fg-faint)',
          }}
        >
          {completion.tier ?? 'Not started'}
        </span>
      </div>

      <p data-testid="profile-milestone" className="mb-4 max-w-[68ch] text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
        {completion.tier ? milestoneCopy : 'Mark a tool as exploring, using or shipped and your journey starts here.'}
      </p>

      {completion.journey ? (
        <p data-testid="profile-journey" className="mb-4 text-sm" style={{ color: 'var(--fg-dim)' }}>
          Your {work ? domain.contextLabels[work]?.toLowerCase() : ''} journey:{' '}
          <strong style={{ color: 'var(--fg)' }}>{completion.journey.touched} of {completion.journey.total}</strong> in motion ·{' '}
          <strong style={{ color: 'var(--fg)' }}>{completion.journey.shipped} of {completion.journey.total}</strong> shipped
        </p>
      ) : touchedCategories.size > 0 ? (
        <p data-testid="profile-coverage" className="mb-4 text-sm" style={{ color: 'var(--fg-dim)' }}>
          Categories explored: <strong style={{ color: 'var(--fg)' }}>{touchedCategories.size} of {categories.length}</strong>
        </p>
      ) : null}

      {recent.length > 0 ? (
        <ul data-testid="profile-recent" className="mb-3 space-y-1.5">
          {recent.map(([slug, rec]) => (
            <li key={slug} className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="font-medium">{nameOf(slug)}</span>
              <span className="text-xs" style={{ color: 'var(--color-ember)' }}>
                {PROGRESS_META[rec.state as ProgressState].label}
              </span>
              <span className="text-xs" style={{ color: 'var(--fg-faint)' }}>{formatDate(rec.updated_at)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-[11px]" style={{ color: 'var(--fg-faint)' }}>
        Self-reported, stored only in this browser. Marks fade after a year unless renewed.
      </p>
    </section>
  );
}

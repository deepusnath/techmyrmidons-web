import Link from 'next/link';
import { getDomains, getHeuristics, getPublishedTools, getTools } from '../../lib/content.ts';
import { SHOW_DRAFTS } from '../../lib/provenance.ts';
import { redactToReviewed } from '../../lib/review.ts';
import { routes } from '../../lib/routes.ts';
import { ProfileCard, type ProfileDomainData } from '../../components/ProfileCard.tsx';
import { ProfileShare } from '../../components/ProfileShare.tsx';

/**
 * "My profile" — the user's journey through each active domain.
 *
 * User data, not editorial: the page is identical in preview and production,
 * except that journey definitions derive from publishable rules only in a
 * drafts-hidden build. When a domain has no publishable rules, its card gets
 * no journey — never a leaked one — and falls back to category coverage.
 */
export default function ProfilePage() {
  const active = getDomains().filter((d) => d.status === 'active');

  const domains: ProfileDomainData[] = active.map((d) => {
    const heuristics = getHeuristics(d.slug);
    const source =
      heuristics && !SHOW_DRAFTS
        ? redactToReviewed(heuristics, new Map(getTools(d.slug).map((t) => [t.slug, t])))
        : heuristics;

    const journeyByContext: Record<string, string[]> = {};
    const contextLabels: Record<string, string> = {};
    if (source) {
      for (const [ctx, rules] of Object.entries(source.contexts)) {
        contextLabels[ctx] = rules.label;
        journeyByContext[ctx] = [
          ...new Set([
            ...Object.keys(rules.still_appropriate ?? {}),
            ...Object.keys(rules.reconsider ?? {}),
            ...(rules.candidates ?? []).map((c) => c.slug),
          ]),
        ];
      }
    }

    return {
      slug: d.slug,
      name: d.name,
      tools: getPublishedTools(d.slug).map((t) => ({ slug: t.slug, name: t.name, category: t.category })),
      journeyByContext,
      contextLabels,
    };
  });

  return (
    <div>
      <header className="mb-8 max-w-[68ch]">
        <h1 className="mb-2 text-3xl">My profile</h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
          Your journey through each Myrmidon&rsquo;s landscape — what you are exploring, what you
          use, and what you have shipped with. Everything here is self-reported and lives only in
          this browser. Progression celebrates shipping: no tier is reachable by collecting marks.
        </p>
      </header>

      {domains.map((d) => (
        <ProfileCard key={d.slug} domain={d} />
      ))}

      <ProfileShare domains={domains} />

      <p className="text-xs" style={{ color: 'var(--fg-faint)' }}>
        Marks are made on tool pages —{' '}
        {active.map((d, i) => (
          <span key={d.slug}>
            {i > 0 ? ' · ' : ''}
            <Link href={routes.domain(d.slug)} className="hover:underline" style={{ color: 'var(--color-ember)' }}>
              {d.name} Myrmidon
            </Link>
          </span>
        ))}
      </p>
    </div>
  );
}

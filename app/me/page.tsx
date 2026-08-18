import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDomains, getHeuristics, getTools } from '../../lib/content.ts';
import { getToolViews } from '../../lib/views.ts';
import { SHOW_DRAFTS } from '../../lib/provenance.ts';
import { redactToReviewed } from '../../lib/review.ts';
import { routes } from '../../lib/routes.ts';
import { MyrmidonSnapshots, type SnapshotDomain } from '../../components/MyrmidonSnapshots.tsx';

export default function MePage() {
  const active = getDomains().filter((d) => d.status === 'active');

  /**
   * One snapshot per active domain, each carrying its own rules.
   *
   * When the rules are unreviewed and this build hides drafts, the heuristics
   * are withheld at the server boundary — not merely hidden in the UI.
   *
   * This matters: the snapshot is a client component, so anything passed to it
   * is serialised into the page source. Rendering the notice while still
   * shipping the ruleset would put every unreviewed judgement one "view source"
   * away from being read as guidance.
   */
  const domains: SnapshotDomain[] = active.flatMap((d) => {
    const heuristics = getHeuristics(d.slug);
    if (!heuristics) return [];

    // Rule-level, not file-level: production ships exactly the rules a human
    // has reviewed. With none reviewed this is null and nothing is sent.
    const toolIndex = new Map(getTools(d.slug).map((t) => [t.slug, t]));
    const publishable = SHOW_DRAFTS ? heuristics : redactToReviewed(heuristics, toolIndex);
    return [{
      slug: d.slug,
      name: d.name,
      tools: getToolViews(d.slug),
      heuristics: publishable,
      heuristicsWithheld: publishable === null,
    }];
  });

  if (domains.length === 0) notFound();

  return (
    <div>
      <header className="mb-8 max-w-[68ch]">
        <h1 className="mb-2 text-3xl">Where I stand</h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
          A diagnosis for your context, not a checklist. It asks what kind of work you do and what
          you are trying to achieve, because the same advice does not serve a legacy maintainer and a
          design-system author.{' '}
          {domains.length > 1
            ? 'Each Myrmidon asks separately, because the contexts that matter differ by field. '
            : ''}
          Stored in this browser only — no account, nothing uploaded.{' '}
          <Link href={routes.profile()} data-testid="me-profile-link" className="font-semibold hover:underline" style={{ color: 'var(--color-ember)' }}>
            View my profile →
          </Link>
        </p>
      </header>

      <MyrmidonSnapshots domains={domains} />
    </div>
  );
}

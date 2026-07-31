import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDemoActivity, getDomain, getDomains, getSignals, getTools } from '../../../lib/content.ts';
import { describeRepoSignal } from '../../../lib/provenance.ts';
import { ActivityFeed, type RepoSignalView } from '../../../components/ActivityFeed.tsx';

export function generateStaticParams() {
  return getDomains().filter((d) => d.status === 'active').map((d) => ({ domain: d.slug }));
}

export default async function ActivityPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: slug } = await params;
  const domain = getDomain(slug);
  if (!domain || domain.status !== 'active') notFound();

  const tools = getTools(slug);
  const toolNames = Object.fromEntries(tools.map((t) => [t.slug, t.name]));

  // Only observed-tier signals with a resolvable source render here, and they
  // render as statements about files — never about people.
  const signals: RepoSignalView[] = getSignals(slug)
    .filter((s) => s.tier === 'observed' && s.source_url)
    .map((s) => ({
      id: s.id,
      statement: describeRepoSignal({
        tool_slug: toolNames[s.tool_slug] ?? s.tool_slug,
        repo: s.repo,
        manifest_path: s.manifest_path,
        action: s.action,
        source_url: s.source_url,
        observed_at: s.observed_at,
      }),
      tool_slug: s.tool_slug,
      tool_name: toolNames[s.tool_slug] ?? s.tool_slug,
      context_status: s.context_status ?? 'unknown',
      eligible_for_trends: s.eligible_for_trends ?? false,
      source_url: s.source_url,
      at: s.observed_at,
    }))
    .sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div>
      <nav className="mb-6 text-sm">
        <Link href={`/${slug}/`} className="hover:underline" style={{ color: 'var(--fg-faint)' }}>
          ← {domain.name} Myrmidon
        </Link>
      </nav>

      <header className="mb-8 max-w-[68ch]">
        <h1 className="mb-2 text-3xl">Signals and activity</h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
          Three separate things, kept separate: recorded changes to files in public repositories,
          your own declarations, and clearly labelled demonstration data. Each says what kind of
          evidence it is, because they support very different conclusions.
        </p>
      </header>

      <ActivityFeed signals={signals} demo={getDemoActivity(slug)} toolNames={toolNames} domain={slug} />
    </div>
  );
}

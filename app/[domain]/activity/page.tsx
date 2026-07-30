import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDemoActivity, getDomain, getDomains, getSignals, getTools } from '../../../lib/content.ts';
import { ActivityFeed, type SourcedActivity } from '../../../components/ActivityFeed.tsx';

export function generateStaticParams() {
  return getDomains().filter((d) => d.status === 'active').map((d) => ({ domain: d.slug }));
}

export default async function ActivityPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: slug } = await params;
  const domain = getDomain(slug);
  if (!domain || domain.status !== 'active') notFound();

  const tools = getTools(slug);
  const toolNames = Object.fromEntries(tools.map((t) => [t.slug, t.name]));

  // Only observed-tier signals with a real source may be attributed to a named
  // practitioner. Editorial/archive signals are not personal activity.
  const sourced: SourcedActivity[] = getSignals(slug)
    .filter((s) => s.tier === 'observed' && s.actor_type === 'practitioner' && s.source_url)
    .map((s) => {
      const person = s.source_label.split(' ')[0] + ' ' + (s.source_label.split(' ')[1] ?? '');
      return {
        id: s.id,
        person: person.trim(),
        tool_slug: s.tool_slug,
        tool_name: toolNames[s.tool_slug] ?? s.tool_slug,
        label: s.note ? 'removed' : 'added',
        source_url: s.source_url,
        at: s.observed_at,
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div>
      <nav className="mb-6 text-sm">
        <Link href={`/${slug}/`} className="hover:underline" style={{ color: 'var(--fg-faint)' }}>
          ← {domain.name} Myrmidon
        </Link>
      </nav>

      <header className="mb-8 max-w-3xl">
        <h1 className="mb-2 text-3xl">Activity</h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
          Who is exploring, using and shipping with what. Each group states plainly what kind of
          evidence it is — sourced practitioner activity, your own declarations, or clearly labelled
          demonstration data.
        </p>
      </header>

      <ActivityFeed sourced={sourced} demo={getDemoActivity(slug)} toolNames={toolNames} domain={slug} />
    </div>
  );
}

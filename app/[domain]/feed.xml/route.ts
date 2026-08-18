import { getDomains, getTools } from '../../../lib/content.ts';
import { isFieldReviewed } from '../../../lib/provenance.ts';

/**
 * Atom feed of a Myrmidon's reviewed catalogue changes — "follow the Myrmidon"
 * before accounts or push exist (docs/PRODUCT_PLAN_PROFILES.md, story A4).
 *
 * The content layer records no event log, so the only honest dates are the
 * ones it does record: reviewed_at. An entry therefore exists only for a
 * published tool a named reviewer has signed off, dated by that sign-off —
 * in preview and production alike. Withheld editorial cannot leak into the
 * feed because nothing unreviewed ever qualifies for it, and the summary uses
 * one_liner only when that specific field was reviewed.
 */
export const dynamic = 'force-static';

export function generateStaticParams() {
  return getDomains()
    .filter((d) => d.status === 'active')
    .map((d) => ({ domain: d.slug }));
}

/** Feed links must be absolute. Override when the site moves hosts. */
const ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://deepusnath.github.io';
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET(_req: Request, ctx: { params: Promise<{ domain: string }> }) {
  const { domain } = await ctx.params;
  const d = getDomains().find((x) => x.slug === domain && x.status === 'active');
  if (!d) return new Response('Not found', { status: 404 });

  const entries = getTools(domain)
    .filter(
      (t) =>
        t.published &&
        t.reviewed_at &&
        ((t.reviewed_fields ?? []).length > 0 || t.editorial_status === 'reviewed'),
    )
    .map((t) => ({
      name: t.name,
      url: `${ORIGIN}${BASE}/${domain}/tools/${t.slug}/`,
      updated: `${t.reviewed_at}T00:00:00Z`,
      summary: isFieldReviewed(t, 'one_liner') && t.one_liner ? t.one_liner : null,
    }))
    .sort((a, b) => b.updated.localeCompare(a.updated) || a.name.localeCompare(b.name));

  const feedUrl = `${ORIGIN}${BASE}/${domain}/feed.xml`;
  const pageUrl = `${ORIGIN}${BASE}/${domain}/`;
  const updated = entries[0]?.updated ?? new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${esc(d.name)} Myrmidon — TechMyrmidons</title>
  <subtitle>Reviewed catalogue changes. Entries appear when an editor signs content off, never before.</subtitle>
  <id>${esc(feedUrl)}</id>
  <link rel="self" type="application/atom+xml" href="${esc(feedUrl)}"/>
  <link rel="alternate" type="text/html" href="${esc(pageUrl)}"/>
  <updated>${esc(updated)}</updated>
${entries
  .map(
    (e) => `  <entry>
    <id>${esc(e.url)}</id>
    <title>${esc(e.name)} — published in the ${esc(d.name)} catalogue</title>
    <link rel="alternate" type="text/html" href="${esc(e.url)}"/>
    <updated>${esc(e.updated)}</updated>${e.summary ? `\n    <summary>${esc(e.summary)}</summary>` : ''}
  </entry>`,
  )
  .join('\n')}
</feed>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
  });
}

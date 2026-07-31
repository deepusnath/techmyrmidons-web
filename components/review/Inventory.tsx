import Link from 'next/link';
import { routes } from '../../lib/routes.ts';
import {
  getDomains,
  getEditorial,
  getHeuristics,
  getReviewCounts,
  getSignals,
  getTimeline,
  getTools,
} from '../../lib/content.ts';
import { EDITORIAL_TOOL_FIELDS } from '../../content/schema.ts';
import { SHOW_DRAFTS, formatDate } from '../../lib/provenance.ts';

const DOMAIN = 'frontend';

/**
 * A compact inventory of everything a human has not yet checked.
 *
 * The point is that the scale of unreviewed material is visible in one place
 * rather than inferred from labels scattered across the site. Nothing here is
 * attributed to a named editor, because none of it has been reviewed by one.
 */
export function ReviewInventory() {
  // Single source of truth — see getReviewCounts in lib/content.ts.
  const counts = getReviewCounts(DOMAIN);
  const tools = getTools(DOMAIN).filter((t) => t.published);
  const unreviewedTools = tools.filter((t) => t.editorial_status !== 'reviewed');
  const reviewedTools = tools.filter((t) => t.editorial_status === 'reviewed');

  const notes = getEditorial(DOMAIN);
  const draftNotes = notes.filter((n) => n.draft);

  const timeline = getTimeline(DOMAIN);
  const draftYears = timeline.filter((t) => t.draft);
  const allEvents = timeline.flatMap((t) => t.events.map((e) => ({ ...e, year: t.year })));
  const draftEvents = allEvents.filter((e) => e.claim_status === 'ai_draft');
  const sourcedEvents = allEvents.filter((e) => e.claim_status === 'sourced');

  const signals = getSignals(DOMAIN);
  const observed = signals.filter((s) => s.tier === 'observed');
  const eligible = observed.filter((s) => s.eligible_for_trends);
  const toolsWithObserved = new Set(observed.map((s) => s.tool_slug));

  const heuristics = getHeuristics(DOMAIN);
  const archivedDomains = getDomains().filter((d) => d.status !== 'active');

  const claimCount = unreviewedTools.length * EDITORIAL_TOOL_FIELDS.length;

  const Row = ({ label, value, note }: { label: string; value: string; note?: string }) => (
    <tr className="border-b" style={{ borderColor: 'var(--rule)' }}>
      <td className="py-2 pr-4 align-top text-sm">{label}</td>
      <td className="py-2 pr-4 align-top text-sm font-semibold whitespace-nowrap">{value}</td>
      <td className="py-2 align-top text-xs" style={{ color: 'var(--fg-faint)' }}>{note}</td>
    </tr>
  );

  return (
    <div className="max-w-[80ch]">
      <header className="mb-8">
        <h1 className="mb-2 text-3xl">Editorial review inventory</h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
          Everything in the frontend pilot that a human editor has not yet checked. This build is
          currently {SHOW_DRAFTS ? 'a preview: unreviewed claims render, labelled' : 'production: unreviewed claims are withheld'}.
        </p>
      </header>

      <div className="mb-8 rounded-sm border p-4" style={{ borderColor: 'var(--color-ember)' }}>
        <p className="mb-1 text-sm font-semibold">Start here</p>
        <p className="mb-3 text-xs leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
          Reviewing alphabetically is the slowest route. The priority queue orders tools by how many
          diagnosis rules depend on them, so the first few reviews unblock the most.
        </p>
        <Link
          href="/review/priority/"
          data-testid="priority-link"
          className="inline-block rounded-sm px-3 py-1.5 text-xs font-semibold"
          style={{ background: 'var(--color-ember)', color: '#fff' }}
        >
          Open the priority review queue →
        </Link>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-xl">Summary</h2>
        <div className="scroll-x">
          <table className="w-full border-collapse text-left">
            <tbody>
              <Row
                label="Published tools"
                value={`${counts.tools.reviewed} reviewed / ${counts.tools.total}`}
                note={`${counts.tools.unreviewed} unreviewed`}
              />
              <Row
                label="Unreviewed editorial claims on tools"
                value={String(counts.unreviewedToolClaims)}
                note={`${counts.tools.unreviewed} tools × ${counts.toolClaimFields} claim fields (${EDITORIAL_TOOL_FIELDS.join(', ')})`}
              />
              <Row
                label="Lifecycle classifications"
                value={`${counts.tools.unreviewed} unreviewed`}
                note="Each lifecycle value is an AI-authored editorial classification, not a measurement"
              />
              <Row
                label="Editorial notes"
                value={`${counts.editorialNotes.draft} draft / ${counts.editorialNotes.total}`}
                note="Draft notes carry no byline and are withheld in production"
              />
              <Row
                label="Timeline years"
                value={`${counts.timelineYears.narrativeUnreviewed} unreviewed narrative / ${counts.timelineYears.total}`}
                note="2017 and 2019 are archive records; 2020–2026 are AI interpretations"
              />
              <Row
                label="Timeline events"
                value={`${counts.timelineEvents.aiDraft} AI-drafted / ${counts.timelineEvents.total}`}
                note={`${counts.timelineEvents.sourced} sourced from archive files or an official primary source`}
              />
              <Row
                label="Context-fit rules (guided assessment)"
                value={counts.heuristicsReviewed ? 'reviewed' : 'unreviewed'}
                note="AI-authored judgements about which tools serve which kind of work"
              />
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-xl">Source coverage and evidence gaps</h2>
        <div className="scroll-x">
          <table className="w-full border-collapse text-left">
            <tbody>
              <Row
                label="Tools with any repository signal"
                value={`${counts.signals.toolsCovered} / ${counts.publishedTools}`}
                note={`${counts.publishedTools - counts.signals.toolsCovered} published tools have no repository signal at all`}
              />
              <Row
                label="Repository signals"
                value={String(counts.signals.observed)}
                note="Each links to a commit; none has had its repository context established"
              />
              <Row
                label="Signals eligible to inform trends"
                value={String(counts.signals.eligibleForTrends)}
                note="Requires a human to review the repository's context first. Currently none do."
              />
              <Row label="Self-declared evidence" value="0" note="Requires accounts, which are out of scope for this pilot" />
              <Row label="Community-verified evidence" value="0" note="Not implemented" />
              <Row
                label="Archived domains"
                value={String(archivedDomains.length)}
                note="Preserved with displayed reasons; none reviewed for accuracy"
              />
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-xl">Unreviewed tool claims</h2>
        <p className="mb-4 text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
          Every row below has AI-authored summary, description, why-it-matters, lifecycle,
          suitability guidance and alternatives awaiting review.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2" data-testid="unreviewed-tools">
          {unreviewedTools.map((t) => (
            <li
              key={t.slug}
              className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-dashed px-3 py-2"
              style={{ borderColor: '#c8913a' }}
            >
              <Link href={routes.tool(DOMAIN, t.slug)} className="text-sm hover:underline">{t.name}</Link>
              <span className="text-[10px]" style={{ color: '#c8913a' }}>
                {t.lifecycle ?? 'unclassified'} · unreviewed
              </span>
            </li>
          ))}
        </ul>

        {reviewedTools.length ? (
          <>
            <h3 className="mt-8 mb-2 text-lg">Reviewed</h3>
            <ul className="space-y-1 text-sm">
              {reviewedTools.map((t) => (
                <li key={t.slug} style={{ color: 'var(--fg-dim)' }}>
                  {t.name} — reviewed by {t.reviewed_by} on {t.reviewed_at ? formatDate(t.reviewed_at) : 'unknown date'}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-6 text-sm" style={{ color: 'var(--fg-faint)' }}>
            No tool has been reviewed yet.
          </p>
        )}
      </section>
    </div>
  );
}

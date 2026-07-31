import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { routes } from '../../lib/routes.ts';
import { getJourneyMaps, getPrioritySet, getReadiness } from '../../lib/review.ts';
import { PriorityReview, type DossierView } from '../PriorityReview.tsx';

const DOMAIN = 'frontend';

function loadDossiers(): DossierView[] {
  const dir = path.join(process.cwd(), 'content', 'dossiers', DOMAIN);
  if (!fs.existsSync(dir)) return [];
  const order = getPrioritySet(DOMAIN).map((p) => p.slug);
  const byslug = new Map<string, DossierView>();
  for (const f of fs.readdirSync(dir)) {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    if (!raw.trim()) continue;
    const d = JSON.parse(raw) as DossierView;
    byslug.set(d.slug, d);
  }
  // Highest rule-dependency first: the most leverage per review sits at the top.
  return order.map((s) => byslug.get(s)).filter(Boolean) as DossierView[];
}

export function PriorityReviewQueue() {
  const dossiers = loadDossiers();
  const priority = getPrioritySet(DOMAIN);
  const readiness = getReadiness(DOMAIN);
  const maps = getJourneyMaps(DOMAIN);

  return (
    <div className="max-w-[80ch]">
      <nav className="mb-6 text-sm">
        <Link href={routes.review()} className="hover:underline" style={{ color: 'var(--fg-faint)' }}>
          ← Review inventory
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="mb-2 text-3xl">Priority editorial review</h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
          The {priority.length} tools that the five validated diagnosis journeys actually depend on,
          ordered by how many rules rest on each. Reviewing the top of this list unblocks more of the
          product than reviewing the whole catalogue alphabetically.
        </p>
        <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
          See{' '}
          <a href="https://github.com/deepusnath/techmyrmidons-web/blob/rebuild/frontend-pilot/docs/EDITORIAL_GOVERNANCE.md"
             target="_blank" rel="noopener noreferrer" className="underline">
            editorial governance
          </a>{' '}
          for who may review what, the evidence standard, and why repository signals cannot support
          trend conclusions.
        </p>
      </header>

      {/* --- readiness: no score, no meter, just what blocks what --- */}
      <section className="mb-10">
        <h2 className="mb-3 text-xl">Production readiness</h2>
        <div className="scroll-x">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--rule)' }}>
                <th className="py-2 pr-4 font-semibold">Journey</th>
                <th className="py-2 pr-4 font-semibold">Status</th>
                <th className="py-2 font-semibold">Blocked by</th>
              </tr>
            </thead>
            <tbody>
              {readiness.journeys.map((j) => (
                <tr key={j.context} data-testid={`readiness-${j.context}`} className="border-b" style={{ borderColor: 'var(--rule)' }}>
                  <td className="py-2 pr-4 align-top">{j.label}</td>
                  <td className="py-2 pr-4 align-top whitespace-nowrap" style={{ color: j.fullyBlocked ? '#d24a2c' : 'var(--color-tier-community)' }}>
                    {j.fullyBlocked ? 'fully blocked' : 'partly available'}
                  </td>
                  <td className="py-2 align-top text-xs" style={{ color: 'var(--fg-faint)' }}>
                    {j.blockingRules} unreviewed rule{j.blockingRules === 1 ? '' : 's'}, {j.blockingTools} unreviewed tool record{j.blockingTools === 1 ? '' : 's'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="mt-4 space-y-1 text-sm" style={{ color: 'var(--fg-dim)' }}>
          <li>· Priority tool records reviewed: <strong>{readiness.priorityToolsReviewed} of {readiness.priorityToolsTotal}</strong></li>
          <li>· Diagnosis rules reviewed: <strong data-testid="rules-reviewed">{readiness.rulesReviewed}</strong> of {readiness.rulesTotal}</li>
          <li>· Reviewed but publication blocked: <strong data-testid="rules-blocked">{readiness.rulesReviewedButBlocked}</strong> — the decision stands; only its release waits on a reader-facing destination</li>
          <li>· Reviewed and publishable: <strong data-testid="rules-publishable">{readiness.rulesPublishable}</strong></li>
          <li>· Lifecycle views blocked: <strong>{readiness.lifecycleViewsBlocked.join(', ') || 'none'}</strong></li>
        </ul>

        {readiness.highestLeverage ? (
          <div className="mt-4 rounded-sm border p-3 text-sm" data-testid="highest-leverage" style={{ borderColor: 'var(--color-ember)' }}>
            <strong style={{ color: 'var(--color-ember)' }}>Highest leverage next action.</strong>{' '}
            {readiness.highestLeverage.action}. {readiness.highestLeverage.unlocks}
          </div>
        ) : null}
      </section>

      {/* --- per-journey dependency map --- */}
      <section className="mb-10">
        <h2 className="mb-3 text-xl">Journey dependency map</h2>
        <p className="mb-4 text-xs leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
          Which rules produce each conclusion, and which claims must be reviewed before that
          conclusion may appear in production. Review is tracked per rule, so approving one does not
          release the others.
        </p>
        <div className="space-y-5">
          {maps.map((m) => (
            <details key={m.context} data-testid={`journey-${m.context}`} className="rounded-sm border p-3" style={{ borderColor: 'var(--rule)' }}>
              <summary className="cursor-pointer text-sm font-semibold">
                {m.label}
                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--fg-faint)' }}>
                  {m.retain.length} retain · {m.reconsider.length} reconsider · {m.recommend.length} recommend
                </span>
              </summary>
              <div className="mt-3 space-y-2 text-xs" style={{ color: 'var(--fg-dim)' }}>
                {(['retain', 'reconsider', 'recommend'] as const).map((kind) => (
                  <div key={kind}>
                    <span className="font-semibold uppercase tracking-wide" style={{ color: 'var(--fg-faint)' }}>{kind}</span>
                    <ul className="mt-1 space-y-0.5">
                      {m[kind].map((r) => (
                        <li key={r.rule_id}>
                          <code>{r.rule_id}</code> → {r.tool_slug}{' '}
                          <span
                            data-rule-state={r.publishable ? 'publishable' : r.reviewed ? 'reviewed-blocked' : 'unreviewed'}
                            title={r.blockedBy ?? 'reviewed and publishable'}
                            style={{ color: r.publishable ? 'var(--color-tier-community)' : r.reviewed ? '#4a9db5' : '#c8913a' }}
                          >
                            [{r.publishable ? 'reviewed · publishable' : r.reviewed ? 'reviewed · publication blocked' : 'unreviewed'}]
                          </span>
                        </li>
                      ))}
                      {m[kind].length === 0 ? <li>(none)</li> : null}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl">Review queue</h2>
        <PriorityReview dossiers={dossiers} />
      </section>
    </div>
  );
}

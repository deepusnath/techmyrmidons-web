'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { routes } from '../lib/routes.ts';
import { useHydrated } from '../lib/state.ts';
import { EmptyState } from './Provenance.tsx';

/**
 * Reviewer workstation: one tool at a time.
 *
 * Deliberately records nothing into content. Decisions live in this browser
 * only and export as JSON for a human to inspect and commit — approving a claim
 * is a deliberate act with a name attached, not a click that silently mutates
 * published guidance.
 */

export type Action = 'approve' | 'approve_with_edits' | 'reject' | 'defer';

const ACTIONS: Array<{ key: Action; label: string; hint: string; color: string }> = [
  { key: 'approve', label: 'Approve as written', hint: 'The claim and its dependent rules are correct as drafted.', color: 'var(--color-tier-community)' },
  { key: 'approve_with_edits', label: 'Approve with edits', hint: 'Correct as amended — record what you changed.', color: '#4a9db5' },
  { key: 'reject', label: 'Reject', hint: 'The claim is wrong or unsupportable. It stays withheld.', color: '#d24a2c' },
  { key: 'defer', label: 'Defer pending evidence', hint: 'Cannot decide without evidence that does not exist yet.', color: '#c8913a' },
];

export interface DossierView {
  slug: string;
  name: string;
  canonical_url: string | null;
  primary_source: string | null;
  proposed_lifecycle: string | null;
  summary: string | null;
  why_it_matters: string | null;
  suitable_for: string[];
  not_suitable_for: string[];
  alternatives: string[];
  verifiable_facts: string[];
  editorial_interpretation: string[];
  evidence_gaps: string[];
  wrong_if: string;
  confidence: string;
  conflict_of_interest: string | null;
  diagnosis_rules: Array<{ rule_id: string; context: string; kind: string; reviewed: boolean }>;
  relationships: Array<{ type: string; detail: string }>;
  journeys_affected: string[];
  supporting_signals: Array<{ tier: string; label: string; source_url: string | null; eligible_for_trends: boolean }>;
  fields_requiring_approval: string[];
  proposed_decision: string;
}

interface Decision {
  slug: string;
  action: Action;
  note: string;
  reviewer: string;
  decided_at: string;
}

const KEY = 'techmyrmidons.review.v1';

function loadDecisions(): Record<string, Decision> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fg-faint)' }}>
        {label}
      </h3>
      {children}
    </div>
  );
}

export function PriorityReview({ domain, dossiers }: { domain: string; dossiers: DossierView[] }) {
  const hydrated = useHydrated();
  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [note, setNote] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [loaded, setLoaded] = useState(false);

  if (hydrated && !loaded) {
    setDecisions(loadDecisions());
    setLoaded(true);
  }

  const d = dossiers[index];
  const decided = decisions[d?.slug ?? ''];

  const exportUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const payload = {
      note: 'Local reviewer decisions. Nothing here is applied to content until a human commits it deliberately.',
      exported_at: new Date().toISOString(),
      decisions: Object.values(decisions),
    };
    return URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  }, [decisions]);

  function record(action: Action) {
    if (!d) return;
    const entry: Decision = {
      slug: d.slug,
      action,
      note: note.trim(),
      reviewer: reviewer.trim(),
      decided_at: new Date().toISOString(),
    };
    const next = { ...decisions, [d.slug]: entry };
    setDecisions(next);
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage disabled */ }
    setNote('');
  }

  if (!hydrated) return <p className="text-sm" style={{ color: 'var(--fg-faint)' }}>Loading review queue…</p>;
  if (!d) return <EmptyState title="No dossiers in the priority set." />;

  const decidedCount = Object.keys(decisions).length;

  return (
    <div>
      <div
        className="mb-6 rounded-sm border border-dashed p-3 text-xs leading-relaxed"
        style={{ borderColor: '#c8913a', color: '#c8913a' }}
      >
        <strong>Nothing here is applied.</strong> Decisions are stored in this browser only and
        change no published claim. Export them and commit deliberately — an approval must carry a
        real name and a real date, which a click in a preview cannot supply.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button" data-testid="review-prev"
          onClick={() => { setIndex((i) => Math.max(0, i - 1)); setNote(''); }}
          disabled={index === 0}
          className="rounded-sm border px-3 py-1.5 text-xs disabled:opacity-40"
          style={{ borderColor: 'var(--rule)', color: 'var(--fg-dim)' }}
        >← Previous</button>
        <span className="text-xs" style={{ color: 'var(--fg-faint)' }}>
          <span data-testid="review-position">{index + 1}</span> of {dossiers.length} ·{' '}
          <span data-testid="review-decided">{decidedCount}</span> decided locally
        </span>
        <button
          type="button" data-testid="review-next"
          onClick={() => { setIndex((i) => Math.min(dossiers.length - 1, i + 1)); setNote(''); }}
          disabled={index === dossiers.length - 1}
          className="rounded-sm border px-3 py-1.5 text-xs disabled:opacity-40"
          style={{ borderColor: 'var(--rule)', color: 'var(--fg-dim)' }}
        >Next →</button>

        {decidedCount > 0 ? (
          <a
            href={exportUrl}
            download="techmyrmidons-review-decisions.json"
            data-testid="review-export"
            className="rounded-sm px-3 py-1.5 text-xs font-semibold"
            style={{ background: 'var(--color-ember)', color: '#fff' }}
          >Export {decidedCount} decision{decidedCount === 1 ? '' : 's'} as JSON</a>
        ) : null}
      </div>

      <article
        data-testid="dossier"
        data-slug={d.slug}
        className="rounded-sm border p-5"
        style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)' }}
      >
        <header className="mb-4 flex flex-wrap items-baseline gap-3">
          <h2 className="text-2xl">{d.name}</h2>
          <span className="rounded-sm border border-dashed px-2 py-0.5 text-[10px] font-semibold" style={{ borderColor: '#c8913a', color: '#c8913a' }}>
            unreviewed
          </span>
          <span className="text-xs" style={{ color: 'var(--fg-faint)' }}>confidence: {d.confidence}</span>
          {d.primary_source ? (
            <a href={d.primary_source} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: 'var(--color-tier-observed)' }}>
              primary source ↗
            </a>
          ) : null}
          <Link href={routes.tool(domain, d.slug)} className="text-xs hover:underline" style={{ color: 'var(--color-ember)' }}>
            tool page →
          </Link>
        </header>

        {d.conflict_of_interest ? (
          <div className="mb-4 rounded-sm border p-3 text-xs leading-relaxed" style={{ borderColor: '#d24a2c', color: '#d24a2c' }}>
            <strong>Conflict of interest.</strong> {d.conflict_of_interest}
          </div>
        ) : null}

        <Field label={`Proposed claim — lifecycle "${d.proposed_lifecycle ?? 'none'}"`}>
          <p className="text-sm leading-relaxed">{d.summary ?? '(no summary)'}</p>
          {d.why_it_matters ? (
            <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>{d.why_it_matters}</p>
          ) : null}
        </Field>

        <Field label="Verifiable facts — checkable against the primary source">
          <ul className="space-y-1 text-sm" style={{ color: 'var(--color-tier-community)' }}>
            {d.verifiable_facts.length ? d.verifiable_facts.map((f) => <li key={f}>· {f}</li>) : <li>(none recorded)</li>}
          </ul>
        </Field>

        <Field label="Editorial interpretation — NOT established by the source">
          <ul className="space-y-1 text-sm" style={{ color: '#c8913a' }}>
            {d.editorial_interpretation.length ? d.editorial_interpretation.map((f) => <li key={f}>· {f}</li>) : <li>(none recorded)</li>}
          </ul>
        </Field>

        <Field label="Evidence gaps">
          <ul className="space-y-1 text-sm" style={{ color: '#d24a2c' }}>
            {d.evidence_gaps.map((f) => <li key={f}>· {f}</li>)}
          </ul>
        </Field>

        <Field label="This classification would be wrong if">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>{d.wrong_if}</p>
        </Field>

        <Field label={`Diagnosis rules depending on this (${d.diagnosis_rules.length})`}>
          <ul className="space-y-1 text-xs" style={{ color: 'var(--fg-dim)' }}>
            {d.diagnosis_rules.map((r) => (
              <li key={r.rule_id} data-testid={`rule-${r.rule_id}`}>
                <code>{r.rule_id}</code> — {r.kind} in {r.context} · {r.reviewed ? 'reviewed' : 'unreviewed'}
              </li>
            ))}
          </ul>
          {d.relationships.length ? (
            <ul className="mt-2 space-y-1 text-xs" style={{ color: 'var(--fg-faint)' }}>
              {d.relationships.map((r, i) => <li key={i}>· {r.type}: {r.detail}</li>)}
            </ul>
          ) : null}
        </Field>

        <Field label={`Journeys affected (${d.journeys_affected.length})`}>
          <p className="text-xs" style={{ color: 'var(--fg-dim)' }}>{d.journeys_affected.join(', ')}</p>
        </Field>

        <Field label={`Supporting signals (${d.supporting_signals.length})`}>
          {d.supporting_signals.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--fg-faint)' }}>None. No repository signal covers this tool.</p>
          ) : (
            <p className="text-xs" style={{ color: 'var(--fg-faint)' }}>
              {d.supporting_signals.length} recorded file changes.{' '}
              <strong>None is eligible to support a trend conclusion.</strong>
            </p>
          )}
        </Field>

        <Field label={`Fields requiring approval (${d.fields_requiring_approval.length})`}>
          <p className="text-xs" style={{ color: 'var(--fg-dim)' }}>{d.fields_requiring_approval.join(' · ')}</p>
        </Field>

        <Field label="Proposed decision">
          <p className="text-sm" style={{ color: 'var(--fg-dim)' }}>{d.proposed_decision}</p>
        </Field>

        <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--rule)' }}>
          <div className="mb-3 flex flex-wrap gap-3">
            <div>
              <label htmlFor="rv-name" className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--fg-dim)' }}>
                Your name (recorded with the decision)
              </label>
              <input
                id="rv-name" data-testid="reviewer-name" value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
                className="rounded-sm border px-2 py-1 text-sm"
                style={{ borderColor: 'var(--rule)', background: 'var(--bg)', color: 'var(--fg)' }}
              />
            </div>
          </div>

          <label htmlFor="rv-note" className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--fg-dim)' }}>
            Reasoning, edits, or what evidence you are waiting for
          </label>
          <textarea
            id="rv-note" data-testid="review-note" rows={3} value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mb-3 w-full rounded-sm border p-2 text-sm"
            style={{ borderColor: 'var(--rule)', background: 'var(--bg)', color: 'var(--fg)' }}
          />

          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((a) => (
              <button
                key={a.key}
                type="button"
                data-testid={`action-${a.key}`}
                title={a.hint}
                disabled={!reviewer.trim()}
                onClick={() => record(a.key)}
                className="rounded-sm border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                style={{ borderColor: a.color, color: a.color }}
              >
                {a.label}
              </button>
            ))}
          </div>
          {!reviewer.trim() ? (
            <p className="mt-2 text-[11px]" style={{ color: 'var(--fg-faint)' }}>
              Enter your name first — an unattributed approval is exactly what this product refuses to publish.
            </p>
          ) : null}

          {decided ? (
            <p data-testid="decision-recorded" className="mt-3 rounded-sm border p-2 text-xs" style={{ borderColor: 'var(--rule)', color: 'var(--fg-dim)' }}>
              Recorded locally: <strong>{decided.action}</strong> by {decided.reviewer}. This has{' '}
              <strong>not</strong> changed any published claim.
            </p>
          ) : null}
        </div>
      </article>
    </div>
  );
}

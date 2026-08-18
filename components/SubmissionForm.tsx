'use client';

import { useState } from 'react';
import { useHydrated, useLocalState } from '../lib/state.ts';
import { FEEDBACK_EMAIL, formatDate } from '../lib/provenance.ts';
import { EmptyState } from './Provenance.tsx';

export function SubmissionForm() {
  const { state, addSubmission } = useLocalState();
  const hydrated = useHydrated();
  const [type, setType] = useState<'tool' | 'resource'>('tool');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [why, setWhy] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Give it a name.');
    if (!/^https?:\/\/.+/.test(url.trim())) return setError('Enter a full URL starting with http:// or https://');
    if (!why.trim()) return setError('Say why it is worth tracking — that is the part an editor needs.');

    addSubmission({ type, name: name.trim(), url: url.trim(), why: why.trim() });
    setName(''); setUrl(''); setWhy(''); setDone(true);
  }

  const submissions = hydrated ? state.submissions : [];

  return (
    <div className="space-y-10">
      <form onSubmit={onSubmit} data-testid="submission-form" noValidate>
        <fieldset className="mb-4">
          <legend className="mb-2 text-xs font-semibold" style={{ color: 'var(--fg-dim)' }}>What is it?</legend>
          <div className="flex gap-2">
            {(['tool', 'resource'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={type === t}
                className="rounded-sm border px-3 py-1.5 text-sm capitalize"
                style={{
                  borderColor: type === t ? 'var(--color-ember)' : 'var(--rule)',
                  color: type === t ? 'var(--color-ember)' : 'var(--fg-dim)',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mb-4">
          <label htmlFor="sub-name" className="mb-1 block text-xs font-semibold" style={{ color: 'var(--fg-dim)' }}>
            Name
          </label>
          <input
            id="sub-name" data-testid="sub-name" value={name} onChange={(e) => { setName(e.target.value); setDone(false); }}
            className="w-full rounded-sm border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)', color: 'var(--fg)' }}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="sub-url" className="mb-1 block text-xs font-semibold" style={{ color: 'var(--fg-dim)' }}>
            URL
          </label>
          <input
            id="sub-url" data-testid="sub-url" type="url" placeholder="https://…" value={url}
            onChange={(e) => { setUrl(e.target.value); setDone(false); }}
            className="w-full rounded-sm border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)', color: 'var(--fg)' }}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="sub-why" className="mb-1 block text-xs font-semibold" style={{ color: 'var(--fg-dim)' }}>
            Why is it worth tracking? Include where it would <em>not</em> fit if you can.
          </label>
          <textarea
            id="sub-why" data-testid="sub-why" rows={4} value={why}
            onChange={(e) => { setWhy(e.target.value); setDone(false); }}
            className="w-full rounded-sm border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)', color: 'var(--fg)' }}
          />
        </div>

        {error ? (
          <p data-testid="sub-error" role="alert" className="mb-3 text-xs" style={{ color: '#d24a2c' }}>{error}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            data-testid="sub-submit"
            className="rounded-sm px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--color-ember)', color: '#fff' }}
          >
            Queue submission
          </button>
          {FEEDBACK_EMAIL ? (
            <a
              href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('TechMyrmidons submission')}&body=${encodeURIComponent(`Type: ${type}\nName: ${name}\nURL: ${url}\n\nWhy: ${why}`)}`}
              className="text-xs font-semibold hover:underline"
              style={{ color: 'var(--fg-dim)' }}
            >
              or email it directly
            </a>
          ) : null}
        </div>

        {done ? (
          <p data-testid="sub-success" className="mt-3 rounded-sm border p-3 text-xs leading-relaxed"
             style={{ borderColor: 'var(--color-tier-community)', color: 'var(--color-tier-community)' }}>
            Queued in this browser. There is no backend in this pilot, so it has not been sent
            anywhere yet.
          </p>
        ) : null}
      </form>

      <section>
        <h2 className="mb-3 text-xl">Your queued submissions</h2>
        {submissions.length === 0 ? (
          <EmptyState title="Nothing queued yet." />
        ) : (
          <ul className="space-y-3" data-testid="submission-list">
            {submissions.map((s) => (
              <li key={s.id} className="rounded-sm border p-3" style={{ borderColor: 'var(--rule)' }}>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{s.name}</span>
                  <span className="rounded-sm border px-1.5 py-0.5 text-[10px] uppercase"
                        style={{ borderColor: 'var(--rule)', color: 'var(--fg-faint)' }}>
                    {s.type}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--fg-faint)' }}>{formatDate(s.created_at)}</span>
                </div>
                <a href={s.url} target="_blank" rel="noopener noreferrer"
                   className="block truncate text-xs hover:underline" style={{ color: 'var(--color-ember)' }}>
                  {s.url}
                </a>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--fg-dim)' }}>{s.why}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

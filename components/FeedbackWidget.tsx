'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLocalState } from '../lib/state.ts';

const SENTIMENTS = [
  { key: 'works', label: 'This worked' },
  { key: 'confusing', label: 'Confusing' },
  { key: 'broken', label: 'Something broke' },
  { key: 'idea', label: 'Idea' },
] as const;

const FEEDBACK_EMAIL = 'deepu@fayausa.com';

/**
 * There is no backend in this pilot, so feedback is saved locally and the user
 * is given an explicit way to send it — a prefilled mail draft or a copy to
 * clipboard. That limitation is stated in the UI rather than implied by a
 * submit button that quietly does nothing.
 */
export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [sentiment, setSentiment] = useState<(typeof SENTIMENTS)[number]['key']>('works');
  const [body, setBody] = useState('');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const pathname = usePathname();
  const { addFeedback } = useLocalState();

  const compose = () =>
    `TechMyrmidons pilot feedback\nPage: ${pathname}\nType: ${sentiment}\n\n${body}`;

  function save() {
    if (!body.trim()) return;
    addFeedback({ route: pathname, sentiment, body: body.trim() });
    setSaved(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(compose());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid="feedback-open"
        onClick={() => { setOpen((v) => !v); setSaved(false); }}
        className="fixed bottom-4 right-4 z-40 rounded-full border px-4 py-2 text-xs font-semibold shadow-lg"
        style={{ borderColor: 'var(--rule)', background: 'var(--bg-3)', color: 'var(--fg)' }}
        aria-expanded={open}
      >
        Feedback
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Send pilot feedback"
          data-testid="feedback-panel"
          className="fixed bottom-16 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-sm border p-4 shadow-xl"
          style={{ borderColor: 'var(--rule)', background: 'var(--bg-2)' }}
        >
          <p className="mb-2 text-sm font-semibold">Pilot feedback</p>
          <p className="mb-3 text-[11px] leading-relaxed" style={{ color: 'var(--fg-faint)' }}>
            No backend is configured for this pilot. Feedback is saved in your browser only — use
            “Email” or “Copy” below to actually send it.
          </p>

          <div className="mb-2 flex flex-wrap gap-1.5">
            {SENTIMENTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSentiment(s.key)}
                aria-pressed={sentiment === s.key}
                className="rounded-sm border px-2 py-1 text-[11px]"
                style={{
                  borderColor: sentiment === s.key ? 'var(--color-ember)' : 'var(--rule)',
                  color: sentiment === s.key ? 'var(--color-ember)' : 'var(--fg-dim)',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <label htmlFor="feedback-body" className="sr-only">Your feedback</label>
          <textarea
            id="feedback-body"
            data-testid="feedback-body"
            value={body}
            onChange={(e) => { setBody(e.target.value); setSaved(false); }}
            rows={4}
            placeholder="What worked, what didn't, what you expected instead…"
            className="mb-2 w-full rounded-sm border p-2 text-xs"
            style={{ borderColor: 'var(--rule)', background: 'var(--bg)', color: 'var(--fg)' }}
          />

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              data-testid="feedback-save"
              onClick={save}
              disabled={!body.trim()}
              className="rounded-sm px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              style={{ background: 'var(--color-ember)', color: '#fff' }}
            >
              Save locally
            </button>
            <a
              href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('TechMyrmidons pilot feedback')}&body=${encodeURIComponent(compose())}`}
              className="rounded-sm border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: 'var(--rule)', color: 'var(--fg-dim)' }}
            >
              Email
            </a>
            <button
              type="button"
              onClick={copy}
              className="rounded-sm border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: 'var(--rule)', color: 'var(--fg-dim)' }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {saved ? (
            <p data-testid="feedback-saved" className="mt-2 text-[11px]" style={{ color: 'var(--color-tier-community)' }}>
              Saved in this browser. It has not been sent anywhere — use Email or Copy to send it.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

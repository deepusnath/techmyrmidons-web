'use client';

import { PROGRESS_META, PROGRESS_ORDER, useHydrated, useLocalState, type ProgressState } from '../lib/state.ts';

/**
 * Exploring / Using / Shipped. Clicking the active state clears it, so a
 * mis-tap is one click to undo.
 *
 * "Proven" is intentionally absent: it requires evidence review, which is out of
 * scope for this pilot. It is shown as a locked hint rather than hidden, so the
 * progression is legible.
 */
export function ToolStateButtons({
  domain,
  slug,
  size = 'md',
  showProvenHint = false,
}: {
  domain: string;
  slug: string;
  size?: 'sm' | 'md';
  showProvenHint?: boolean;
}) {
  const { toolState, setToolState } = useLocalState(domain);
  const hydrated = useHydrated();
  const current = hydrated ? toolState(slug) : null;

  const pad = size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div
        role="group"
        aria-label={`Your progress with this tool`}
        className="flex flex-wrap gap-1.5"
      >
        {PROGRESS_ORDER.map((s: ProgressState) => {
          const active = current === s;
          return (
            <button
              key={s}
              type="button"
              data-testid={`state-${s}`}
              data-active={active ? 'true' : 'false'}
              aria-pressed={active}
              title={PROGRESS_META[s].blurb}
              onClick={() => setToolState(slug, s)}
              className={`${pad} rounded-sm border font-medium transition-colors`}
              style={{
                borderColor: active ? 'var(--color-ember)' : 'var(--rule)',
                background: active ? 'var(--color-ember)' : 'transparent',
                color: active ? '#fff' : 'var(--fg-dim)',
              }}
            >
              {PROGRESS_META[s].label}
            </button>
          );
        })}
      </div>
      {showProvenHint ? (
        <span
          className={`${pad} rounded-sm border border-dashed`}
          style={{ borderColor: 'var(--rule)', color: 'var(--fg-faint)' }}
          title="Proven requires submitting evidence for review. Not available in this pilot."
        >
          Proven · locked
        </span>
      ) : null}
    </div>
  );
}

export function FollowButton({ domain, label }: { domain: string; label: string }) {
  const { isFollowing, toggleFollow } = useLocalState();
  const hydrated = useHydrated();
  const following = hydrated && isFollowing(domain);

  return (
    <button
      type="button"
      data-testid="follow-button"
      data-following={following ? 'true' : 'false'}
      aria-pressed={following}
      onClick={() => toggleFollow(domain)}
      className="rounded-sm border px-4 py-2 text-sm font-semibold transition-colors"
      style={{
        borderColor: 'var(--color-ember)',
        background: following ? 'transparent' : 'var(--color-ember)',
        color: following ? 'var(--color-ember)' : '#fff',
      }}
    >
      {following ? `Following ${label}` : `Follow ${label}`}
    </button>
  );
}

import { getToolViews } from '../../lib/views.ts';
import { PersonalSnapshot } from '../../components/PersonalSnapshot.tsx';

const DOMAIN = 'frontend';

export default function MePage() {
  const tools = getToolViews(DOMAIN);

  return (
    <div>
      <header className="mb-8 max-w-3xl">
        <h1 className="mb-2 text-3xl">Where I stand</h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
          Your own picture of the {DOMAIN} landscape: what you use, what you are exploring, what you
          have shipped with, and a few explainable things to look at next. Stored in this browser
          only — no account, nothing uploaded.
        </p>
      </header>

      <PersonalSnapshot tools={tools} domain={DOMAIN} />
    </div>
  );
}

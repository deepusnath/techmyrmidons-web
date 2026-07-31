import { notFound } from 'next/navigation';
import { getHeuristics } from '../../lib/content.ts';
import { getToolViews } from '../../lib/views.ts';
import { PersonalSnapshot } from '../../components/PersonalSnapshot.tsx';

const DOMAIN = 'frontend';

export default function MePage() {
  const tools = getToolViews(DOMAIN);
  const heuristics = getHeuristics(DOMAIN);
  if (!heuristics) notFound();

  return (
    <div>
      <header className="mb-8 max-w-3xl">
        <h1 className="mb-2 text-3xl">Where I stand</h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
          A diagnosis for your context, not a checklist. It asks what kind of work you do and what
          you are trying to achieve, because the same advice does not serve a legacy maintainer and a
          design-system author. Stored in this browser only — no account, nothing uploaded.
        </p>
      </header>

      <PersonalSnapshot tools={tools} domain={DOMAIN} heuristics={heuristics} />
    </div>
  );
}

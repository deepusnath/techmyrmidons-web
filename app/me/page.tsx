import { notFound } from 'next/navigation';
import { getHeuristics } from '../../lib/content.ts';
import { getToolViews } from '../../lib/views.ts';
import { SHOW_DRAFTS } from '../../lib/provenance.ts';
import { redactToReviewed } from '../../lib/review.ts';
import { PersonalSnapshot } from '../../components/PersonalSnapshot.tsx';

const DOMAIN = 'frontend';

export default function MePage() {
  const tools = getToolViews(DOMAIN);
  const heuristics = getHeuristics(DOMAIN);
  if (!heuristics) notFound();

  /**
   * When the rules are unreviewed and this build hides drafts, the heuristics
   * are withheld at the server boundary — not merely hidden in the UI.
   *
   * This matters: PersonalSnapshot is a client component, so anything passed to
   * it is serialised into the page source. Rendering the notice while still
   * shipping the ruleset would put every unreviewed judgement one "view source"
   * away from being read as guidance.
   */
  // Rule-level, not file-level: production ships exactly the rules a human has
  // reviewed. With none reviewed this is null and nothing is sent to the client.
  const publishable = SHOW_DRAFTS ? heuristics : redactToReviewed(heuristics);
  const withheld = publishable === null;

  return (
    <div>
      <header className="mb-8 max-w-[68ch]">
        <h1 className="mb-2 text-3xl">Where I stand</h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-dim)' }}>
          A diagnosis for your context, not a checklist. It asks what kind of work you do and what
          you are trying to achieve, because the same advice does not serve a legacy maintainer and a
          design-system author. Stored in this browser only — no account, nothing uploaded.
        </p>
      </header>

      <PersonalSnapshot
        tools={tools}
        domain={DOMAIN}
        heuristics={publishable}
        heuristicsWithheld={withheld}
      />
    </div>
  );
}

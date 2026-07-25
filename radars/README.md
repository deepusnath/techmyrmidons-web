# The Radar System: how curation works in the AI era

The original Techmyrmidons (2018–2021) had humans read everything and write lists by hand. It froze. The rebuilt system splits the work the modern way:

> **AI proposes. Practitioners dispose.**

## The update loop

1. **Quarterly AI sweep.** An AI agent (any capable assistant, loaded with the domain's current radar as context) drafts a revision PR: new tools that emerged, ring promotions and demotions, retirements. The draft cites public evidence (releases, adoption signals) for every proposed move.
2. **Session truth.** The owning Evolve chapter's monthly sessions surface what practitioners actually use. A standing 10-minute "what moved this month" segment feeds the log.
3. **Practitioner review.** The chapter reviews the AI draft against the session truth, edits, and merges. A human merge is what makes an entry real. AI-proposed entries that no practitioner validates within two revisions get dropped, not accumulated.
4. **Everyone contributes.** Anyone can PR a radar change; the same review applies. Disagreement between practitioners is recorded in the radar, not resolved by decree.

## Entry provenance labels

Every entry carries one of:

- `[validated]` — a practitioner in the owning chapter confirmed it, ideally with a session-log link
- `[ai-seeded]` — drafted by AI from public knowledge, awaiting validation
- `[contested]` — practitioners disagree; see the Open disagreements section

The July 2026 baseline radars are `[ai-seeded]` throughout (drafted with knowledge through January 2026). They are the starting map, not the settled truth. Validation is the chapters' first job.

## Radars as AI context packs

Each radar is written to be **loaded directly into an AI assistant** as context. A learner can hand their assistant `radars/artificial-intelligence.md` and say "given this radar, and my level on the Ladder, plan my next month." That is the modern form of the original promise: not a page you read once, but a context your tools carry. The repo root's `llms.txt` indexes the packs.

## The domain taxonomy (2026)

Rebuilt from the 2018 list for the world that actually exists now:

| Radar | Owning chapter | Status |
|---|---|---|
| [artificial-intelligence](./artificial-intelligence.md) | AI Evolve (proposed) | AI-seeded baseline |
| [web-and-frontend](./web-and-frontend.md) | seeking maintainer | AI-seeded baseline |
| [platform-and-cloud](./platform-and-cloud.md) | seeking maintainer | AI-seeded baseline |
| [cybersecurity](./cybersecurity.md) | seeking maintainer | AI-seeded baseline |
| [spacetech](./spacetech.md) | Space Evolve (proposed, launches Sep 2026) | AI-seeded baseline |
| [game-development](./game-development.md) | Game Evolve (proposed, launches Oct 2026) | AI-seeded baseline |
| [hr-tech](./hr-tech.md) | HR Evolve (proposed) | AI-seeded baseline |
| [mobile](./stubs/mobile.md) | unclaimed | stub |
| [data-engineering](./stubs/data-engineering.md) | unclaimed | stub |
| [robotics-and-iot](./stubs/robotics-and-iot.md) | unclaimed | stub |
| [quantum-computing](./stubs/quantum-computing.md) | unclaimed | stub |
| [spatial-computing](./stubs/spatial-computing.md) | unclaimed | stub |
| [biotech](./stubs/biotech.md) | unclaimed | stub |
| [web3](./stubs/web3.md) | unclaimed | stub |

Retired from 2018: `actions-on-google` (platform sunset; archived with honor). Renamed: `android` + `ios` → mobile; `arvr` → spatial-computing; `devops` → platform-and-cloud; `blockchain` → web3; `qa` folded into the engineering radars where testing now lives.

A stub stays a stub until a chapter or a committed maintainer claims it. Honesty over coverage: an unclaimed radar pretending to be current is worse than none.

## Rules (inherited from the movement's constitution)

- No vendor can buy a ring; sponsors get zero radar influence
- Freshness is visible: every radar shows last-updated, revision, and owner
- History is preserved: every revision is a commit; the "Moves this revision" section is the product

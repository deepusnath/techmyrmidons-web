# Profiles, Completion & Social — Product Plan

**Status:** proposal · living document
**Owner:** Deepu S Nath (product) · drafted with AI assistance, 2026-08-08
**One-line pitch:** the Spotify of technology taste — your stack is your profile, your
Myrmidon is the artist you follow, and shipping is the thing the product celebrates.

---

## 1. Vision

TechMyrmidons currently answers *"what should I pay attention to?"* This plan adds the
second half: *"where am I on that journey, and who else is on it?"*

- Your **profile** is your relationship with a domain: what you are exploring, what you
  use, what you have actually shipped with.
- **Completion** is a personal progression — from first mark to shipping across a
  domain's landscape — designed to make *shipping*, not collecting, the celebrated act.
- **Public profiles** (opt-in) let technology enthusiasts follow each other the way
  listeners follow artists. Following a person means being told when they ship with
  something new. Following a Myrmidon means being told when the catalogue itself moves.

## 2. What exists today, and what this plan must not break

| Fact | Consequence for this plan |
|---|---|
| Static export, no server, no accounts. "Nothing is uploaded" is a stated promise. | Public profiles, following and push need a backend. That is a **phase boundary**, not a detail — everything before it ships on today's architecture. |
| `lib/state.ts` already stores records "shaped the way a server would store them". | Sync (Phase B) is an upload, not a migration. This was designed for. |
| The diagnosis "produces no score, percentage, level or completeness meter anywhere" (`lib/assessment.ts`), and `tests/trust.spec.ts` enforces it on `/me/`. | See **D2** below. Completion must not turn the *editorial* product into a grader. |
| Governance §8 bars adoption vocabulary without evidence; the catalogue refuses popularity-as-quality. | User adoption data must never leak into editorial surfaces. See **D3**. |
| Tool marks and assessments are per-domain (state v2). | Completion is computed per domain. There is no single global score. |

## 3. Design principles

1. **Motivation without popularity pressure.** Progression and identity (tiers,
   milestones, journey completion) — never leaderboards, never "N people use X".
   Ranking people by tool count recreates, for humans, the popularity-as-quality
   equation the catalogue refuses for tools.
2. **Shipping is the summit.** The weights make one shipped tool worth more than a
   shelf of explored ones. The product celebrates building, not bookmarking.
3. **Consent-first, reversible.** Private by default. Public is an explicit act, scoped
   (you choose what is visible), revocable, and hard-deletable.
4. **The firewall.** User activity data never renders on an editorial surface and
   never feeds a lifecycle, rule, or trend claim. Both directions stay clean:
   editorial judges tools, users report themselves.
5. **Identity without exposure.** Handles, not real names. (The practitioner-photo
   episode is the precedent: never publish likeness or identity without provenance.)

## 4. Completion algorithm (v1)

### 4.1 Inputs (per domain)

- `marked` — the user's tool marks `{slug → {state, updated_at}}` (self-reported)
- `assessmentCompleted` — whether the context assessment is done
- `tools` — the domain's published catalogue (slug, category)
- `contextSlugs` — tools referenced by the rules of the user's assessed work context
  (their "journey"); `null` when unknown or withheld

### 4.2 Scoring

```
state weight      exploring = 1     using = 3     shipped = 6
context bonus     ×1.5 when the tool is in the user's journey
recency           ×1.0 ≤ 12 months  ·  ×0.7 ≤ 24 months  ·  ×0.4 older
tool_score        = weight × context × recency
raw               = Σ tool_scores + 6 (assessment completed)
potential         = 18 × category_count + 6
f                 = raw / potential          (internal only — never displayed as %)
```

Recency decay is deliberate and on-brand: this is a *staying current* product, so a
mark from 2023 fades unless renewed. Weights are v1 constants in `lib/completion.ts`,
expected to be recalibrated against real usage.

### 4.3 Tiers (the displayed thing)

| Tier | Requires |
|---|---|
| Scout | any activity |
| Explorer | f ≥ 0.08 |
| Practitioner | f ≥ 0.18 |
| Shipwright | f ≥ 0.32 **and** ≥ 1 shipped |
| **Myrmidon** | f ≥ 0.55 **and** shipped in ≥ 3 categories **and** assessment done |

The top tier is named after the product on purpose: the end state is *becoming* the
Myrmidon. The UI shows the tier and the **next milestone as a concrete action**
("Ship with one journey tool to reach Shipwright") — never a percentage bar.

### 4.4 Journey completion (the honest denominator)

For the assessed context, the journey is the set of tools its rules reference.
Displayed as fractions: **"2 of 5 in progress · 1 of 5 shipped."** This is true
completion — a bounded, context-relevant set — unlike "percent of the whole catalogue",
which is a number nobody should chase.

In production, journey slugs derive from **publishable rules only** (the
`redactToReviewed` path), so withheld editorial cannot leak through a profile. When no
rules are publishable (AI today), the profile falls back to category coverage.

### 4.5 Worked example (AI domain, 10 categories → potential 186)

Assessment done (+6) · ships LiteLLM, in-journey, fresh (6×1.5=9) · uses PyTorch,
off-journey (3) · explores Ollama, in-journey (1.5) → **raw 19.5, f ≈ 0.10 → Explorer.**
Next milestone: Practitioner at f 0.18 → "ship with one more journey tool and put one
current mark to use."

### 4.6 Non-goals (guardrails, tested)

- No global leaderboard, no follower counts as ranking, no cross-user comparison UI.
- No aggregate adoption counts on tool pages ("N people ship with X") — that is §8
  territory and stays out until governance decides otherwise (see F2).
- Completion never influences the diagnosis, lifecycles, or rule publication.

## 5. Decisions recorded

- **D1 — Architecture pivot is phased, not smuggled.** Phase A ships on the static
  site. Phases B–D require a backend; the frontend stays a static export and talks to
  a separate API. ADR-001 (issue B1) selects the backend; recommendation is Supabase
  (auth + Postgres + row-level security + realtime) for MVP speed. **Provisioning an
  account there is the owner's act, not the assistant's.**
- **D2 — Tiers are levels; the product said "no levels anywhere".** Resolution: that
  rule protects the *diagnosis* — editorial judgement must never grade a person's
  stack. A profile grades nothing but the user's own self-reported journey, lives on
  its own route (`/profile`, not `/me/`), displays tiers and fractions but never a
  percentage or meter element, and is fenced off from every editorial surface. The
  existing trust tests keep enforcing the diagnosis side unchanged.
- **D3 — The firewall is governance, not convention.** F1/F2 add it to
  EDITORIAL_GOVERNANCE.md and to the §8 vocabulary: user-adoption aggregates are
  ineligible evidence for trend claims (self-selected sample, unverifiable
  self-reports).

## 6. Epics

- **A — Completion & private profile** *(no backend — ships now)*:
  A1 completion engine + tests · A2 `/profile` route · A3 shareable profile card
  (export/URL-fragment, serverless) · A4 static Atom feed of catalogue changes
  ("follow the Myrmidon" before accounts exist)
- **B — Identity & public profiles** *(backend)*: B1 ADR backend selection ·
  B2 auth + handles · B3 opt-in public profile at `/u/<handle>` with scoped sharing ·
  B4 privacy controls, export, hard delete
- **C — Social graph**: C1 follow users · C2 activity events with per-item visibility ·
  C3 discovery without leaderboards
- **D — Notifications**: D1 web-push infrastructure · D2 followed-user ship events ·
  D3 Myrmidon catalogue events · D4 digests + rate caps (no spam, per-source
  unsubscribe)
- **E — Sync**: E1 localStorage → account upload (the shape is ready) · E2 multi-device
  merge
- **F — Governance**: F1 the firewall written into governance · F2 §8 extension for
  adoption aggregates

Phase order: **A → B → C → D**, E parallel to B, F before B ships.
Backlog policy: epics carry stories as checklists; stories are filed as issues
just-in-time when their phase starts. Phase A stories are filed now.

## 7. Success metrics

Activation: % of visitors completing an assessment. Progression: % of active users
with ≥1 shipped mark; E→U→S conversion. Social (post-B): % profiles made public,
follows per public profile. Retention: 28-day return. Health: notification opt-out
rate (a rising rate means D4 failed).

## 8. Risks

| Risk | Mitigation |
|---|---|
| Score corrupts marks (marking for points) | Marks stay self-attested and say so on profiles; no rewards beyond identity; no leaderboards to win |
| Backend cost/ops on a hobby project | Phase A has none; B ships only after ADR + owner decision |
| Privacy regret | Scoped opt-in, revocation, hard delete, export — built in B4, not retrofitted |
| Notification fatigue | D4 caps and digests from day one |
| Aggregates leak into editorial | F1/F2 governance + validator-style enforcement |

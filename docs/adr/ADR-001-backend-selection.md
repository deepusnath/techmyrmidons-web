# ADR-001 — Backend for identity, public profiles and social

**Status:** Accepted by Deepu S Nath, 2026-08-12 — provisioning outstanding
**Decider:** Deepu S Nath · drafted with AI assistance, 2026-08-12
**Story:** B1 in [PRODUCT_PLAN_PROFILES.md](../PRODUCT_PLAN_PROFILES.md) · epic #8

---

## Context

Phase A shipped everything social that a static host can carry. What remains —
accounts, handles, public profiles, following, push — needs state on a server.
The constraints that bound this choice:

1. **The frontend stays a static export.** The backend is a separate service the
   static app calls (plan decision D1). Logged-out readers keep exactly today's
   site; GitHub Pages remains the host.
2. **The privacy model must be enforceable, not aspirational.** B4 promises
   scoped sharing, revocation, export and hard delete. F1/F2 promise user data
   never feeds editorial. The nearer those promises sit to the data itself, the
   less they depend on every future API endpoint being written correctly.
3. **Phase D needs web push** (VAPID) and Phase C needs a follows graph with
   per-item visibility — relational questions ("events visible to followers of
   X, except items X hid") that a document store answers awkwardly.
4. **Pilot scale and pilot budget**: tens to hundreds of users; ideally $0 while
   building, tolerable tens of dollars monthly once profiles are public.
5. **Provisioning is the owner's act.** The assistant does not create accounts
   on external services; nothing below happens until Deepu signs up somewhere.
6. **Sync is an upload, not a migration** — `lib/state.ts` already stores
   records "shaped the way a server would store them" (E1).

## Options considered

### 1. Supabase — hosted open-source Postgres stack ★ recommended

Postgres + auth (magic links, OAuth) + **row-level security** + realtime
subscriptions + edge functions, all on an open-source stack.

- **RLS is the decisive feature.** "A private mark is invisible to everyone but
  its owner" becomes a database policy, checked on every query path, rather
  than a convention each endpoint must re-implement. The B4/F1 promises become
  ~20 lines of reviewable policy code living in this repo.
- SQL fits the follows graph, per-item visibility, and honest aggregate
  refusal (F2 becomes "no such view exists").
- Realtime covers Phase C activity; edge functions can send VAPID web push for
  Phase D without adopting a proprietary push service.
- **Exit path is real**: the stack is open source; `pg_dump` restores onto a
  self-hosted deployment. Lock-in is operational, not structural.
- **Cost, from supabase.com/pricing as of 2026-08-12**: free tier includes
  1 GB file storage and community support, **but "Free projects are paused
  after 1 week of inactivity"** — acceptable while building, unacceptable the
  day a share link points at a public profile. Pro is **$25/month** (100K MAU,
  8 GB disk). So the true cost of Phase B going live is $25/mo or a move to
  self-hosting.

### 2. Firebase — Auth + Firestore + FCM

Mature, generous free tier, and FCM makes push easy. Rejected on fit:
security rules are a proprietary language rather than SQL policy; Firestore's
document model makes the follows/visibility queries and honest bulk
export/delete harder than they should be; and the exit path is bespoke
tooling, which sits badly with a product whose entire stance is provenance
and reversibility.

### 3. PocketBase — single-binary OSS on a small VPS ★ runner-up

SQLite-backed, auth and realtime built in; its own FAQ cites 10,000+
persistent realtime connections on a **$4 Hetzner CAX11 VPS**
(pocketbase.io/faq, 2026-08-12). Fully portable — the exit path is copying a
file. The cost is ops: updates, backups, TLS and uptime become Deepu's
personally. Choose this if $25/mo is the objection and self-ops is not.

### 4. Custom API — Cloudflare Workers + D1

Maximum control, near-zero cost at pilot scale, and the most code to write
before the first user sees value: auth, security enforcement (D1 has no row
security), realtime and push all hand-built. Rejected as premature for a
pilot; revisit only if the product outgrows managed tiers.

## Decision (recommended)

**Supabase.** RLS turns the privacy promises into database-enforced policy;
SQL fits the graph; push works without proprietary services; the exit path is
`pg_dump`. Accept the pausing caveat deliberately:

- **Build phase** — free tier, pausing tolerated.
- **Before any profile goes public** — Pro ($25/mo) or self-hosted; a public
  profile that sleeps breaks the product's basic promise. This line item is
  the real decision Deepu is accepting.

## Consequences

- New top-level `supabase/` directory: migrations and RLS policies as code,
  reviewed like content — the privacy model becomes a diffable artifact.
- The static app gains an API client behind a feature flag; nothing changes
  for logged-out readers.
- Only the anon key ships to the client (public by design; RLS is the
  boundary). Service keys never enter the repo or CI.
- The home page's "nothing is uploaded" promise is amended only when E1 ships
  its explicit-confirmation upload, not before.
- A restore drill (dump → self-hosted → smoke test) becomes part of B4's
  acceptance criteria, so the exit path is tested before it is needed.

## Verify at provisioning time

Prices and quotas above were read from the vendors' pages on 2026-08-12 and
will drift; region choice (data residency) and an SMTP provider for magic-link
email (built-in sender rate limits) are provisioning-day decisions.

## Acceptance

Accepted 2026-08-12. Phase B stories are filed. Implementation of B2–B4 and
E1–E2 remains blocked on the one act that is the owner's alone: provisioning
the Supabase project (region and SMTP decisions land then). F1–F2 need no
backend and may proceed immediately.

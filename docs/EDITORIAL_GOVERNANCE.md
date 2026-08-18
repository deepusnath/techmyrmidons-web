# Editorial governance

How a claim in TechMyrmidons moves from AI-drafted to reviewed, who may move it,
and what must remain withheld until it does.

This document governs the frontend pilot. Nothing in the product is currently
reviewed; this describes the process that would change that.

---

## 1. Two different acts

These are separated everywhere in the codebase, and reviewers must not conflate
them.

**Factual verification** asks: *does the cited primary source actually say
this?* It is checkable, has a right answer, and does not require domain
seniority — only care and access to the source. Example: "AngularJS long-term
support has ended" is verified against the project's own support-status page.

**Editorial judgement** asks: *is this the right thing to tell this reader?* It
is contestable, has no single right answer, and does require domain experience.
Example: "webpack is declining" is not a fact about webpack; it is a claim about
trajectory and defaults.

A dossier separates these explicitly into `verifiable_facts` and
`editorial_interpretation`. A reviewer who verifies the facts has **not**
thereby approved the interpretation.

---

## 2. Approval model (confirmed)

Approval is **rule-level and field-level**. Approving a tool dossier does not
approve the rules that use that tool, and approving one rule does not approve
another rule naming the same tool. Enforced in code by `redactToReviewed()` and
proved by `scripts/tests/rule-isolation.test.ts`.

**One named reviewer is sufficient** for the pilot when all three hold:

1. the reviewer is qualified for that claim type under §3,
2. the evidence they relied on is recorded, and
3. the decision is made rule by rule rather than in bulk.

**A second reviewer is required** for:

- dossiers covering AI coding tools,
- any decision where two reviewers disagree, and
- `declining` classifications and comparable ecosystem-wide claims.

### Withheld pending independent review

Claude Code, Cursor and GitHub Copilot are **withheld** until reviewed by an
independent frontend practitioner with no interest in promoting tools in that
category. This is not a scheduling note — those dossiers were drafted using a
tool from the category they assess, and self-assessment is not review.

---

## 3. Who may review what

### Lifecycle classification (`emerging` / `established` / `declining` / `legacy`)

A lifecycle value is an **evidence-constrained editorial judgement**. It is not
a factual conclusion, and official documentation is not evidence of ecosystem-
wide adoption — documentation shows a project exists and is maintained, nothing
more.

Where the available evidence does not meet the representativeness standard in
§8, the reviewer must either:

- replace the classification with a **narrower, context-specific description**
  that the evidence does support ("still the default in framework CLIs of that
  era" rather than "declining"), or
- **withhold the classification** entirely.

Requires a reviewer who:

- has shipped production frontend work within the last two years, and
- can name specific projects or contexts where the classification would be
  wrong, and
- is willing to be recorded by name against the decision.

Lifecycle is the highest-risk field in the product: it drives which landscape
view a tool appears in, and readers will read it as a recommendation however
carefully it is captioned. A reviewer who cannot state the counter-case should
defer rather than approve.

### Contextual recommendation rules (retain / reconsider / recommend)

Requires a reviewer who:

- has worked in the specific context the rule serves — a design-system rule
  needs someone who has maintained a component library consumed by other teams,
  not a generalist, and
- can articulate the condition under which the recommendation would harm the
  reader.

Rules are reviewed **individually**. Approving `legacy.recommend.vite` does not
approve `content.recommend.vite`; they serve different readers and may deserve
different answers.

### Factual fields (summary, description)

Any careful reviewer with access to the primary source. Domain seniority is not
required, because the question is only whether the source supports the sentence.

---

## 4. Evidence standards

Acceptable primary sources:

- official project documentation
- official release notes and changelogs
- the project's own repository
- official support, deprecation or end-of-life announcements
- documentation authored by the project's maintainers

**Not** acceptable as evidence of anything:

- search-result snippets
- marketing pages of competing or adjacent products
- "top N tools" listicles, popularity indexes or download-count aggregators
- repository dependency changes (see §8)
- another entry in this product

Every factual claim must carry a source or be explicitly recorded as an evidence
gap. A claim with neither is a defect, and the validator fails the build.

---

## 5. When a claim must remain withheld

A claim is withheld from the production build when **any** of the following
holds:

- its `editorial_status` is not `reviewed`
- it is a lifecycle classification and no reviewer is recorded
- it is a rule whose `rule_id` has not been individually approved
- it names a tool whose own editorial claims are unreviewed
- its evidence gaps have not been resolved or explicitly accepted

Withholding is the default. There is no "publish with a warning" path: a caveat
under an unreviewed classification still leaves the classification on screen,
and readers act on the classification, not the caveat.

---

## 6. Review expiry and revalidation

| Claim type | Revalidate after | Immediate trigger |
| --- | --- | --- |
| Lifecycle classification | 12 months | A major release, deprecation, or change of maintainer |
| Contextual rules | 12 months | Any change to a tool the rule names |
| Factual fields | 24 months | The cited source changing or 404ing |
| End-of-life / release facts | No expiry | The cited announcement being superseded |

An expired review reverts the claim to `ai_draft`. It does not silently remain
published.

---

## 7. Conflicts of interest

A reviewer must disclose, and generally must not be the sole approver, where
they:

- maintain, are employed by, or are sponsored by the project under review
- maintain or are employed by a directly competing project
- have a financial position that a classification change could affect

Disclosures are recorded on the dossier in `conflict_of_interest` and shown to
subsequent reviewers.

**Standing disclosure:** every dossier and tool card in this pilot was drafted
with AI assistance. The entries for AI coding tools — Claude Code, Cursor,
GitHub Copilot — were drafted using a tool in that category, assessing its own
category. Those three carry an explicit conflict note and should be reviewed by
someone with no stake in the outcome, or withheld.

---

## 8. Repository signals: eligibility for trend conclusions

Repository signals record that a dependency was added to or removed from a file
in a public repository, on a date, in a specific commit. That is all they
record.

They are **ineligible** to support any statement about popularity, personal
usage, adoption or industry trend, and every signal currently carries
`eligible_for_trends: false`.

Knowing a repository's *type* is **not** sufficient to change that. Both of the
following must be established:

**(a) Context** — a reviewer has determined what the repository is for:
production application, published library, demo or teaching material, personal
configuration, or archived. A dotfiles commit and a production deployment are
not the same evidence, and neither is a conference demo.

**(b) Representativeness** — the set of repositories, taken together, plausibly
represents the population the conclusion would describe. This requires a stated
population, a stated sampling method, and an acknowledged bias direction.

The current cohort satisfies neither. It is ten individuals selected a decade
ago, whose public repositories skew heavily toward libraries, specifications and
demonstrations rather than production applications. Any trend derived from it
would describe *what ten specific people published*, not what the field does.

### Minimum bar before using trend vocabulary (confirmed)

The words **popular, widely used, adopted, emerging, declining, standard,
default, most teams** may not appear in a published claim unless:

1. a population is stated ("frontend developers at companies of 50+ engineers"),
2. a sampling method is stated and its bias acknowledged,
3. the sample is large enough that removing any single repository does not
   change the conclusion, and
4. the claim is dated, because it expires.

Until then these words may appear only inside clearly-labelled editorial
interpretation, never as a sourced fact — and a reviewer may legitimately reject
a lifecycle classification on the grounds that the word itself overstates the
evidence. Several dossiers flag exactly this in their `wrong_if`.

### User-adoption aggregates (added 2026-08-12, story F2)

Profiles let users mark tools as exploring, using or shipped. Aggregating those
marks — "N people ship with X", "most users here prefer Y" — is **ineligible
evidence for trend vocabulary**, for the same reasons repository signals are,
compounded:

- **Self-selected sample.** People who mark tools on this site are not a
  population anyone can state, and the bias direction is unknowable.
- **Self-reported and unverifiable.** A mark records a claim about oneself; no
  reviewer can check it against a primary source, which fails §4 outright.
- **Reflexive.** The site recommending X causes marks on X; feeding marks back
  into editorial would launder the site's own influence into "evidence".

The minimum bar above applies unchanged, and no current or planned surface
meets it. Aggregate adoption counts therefore do not appear on tool pages,
landscape views, or any editorial surface — not as numbers, not as ranks, not
as "trending" flags.

---

## 9. Recording disagreement

Disagreement is expected and is recorded, not resolved by seniority.

- A reviewer who rejects a claim records the reason on the dossier.
- A reviewer who approves with edits records what changed and why.
- Where two qualified reviewers disagree, the claim stays **withheld** and both
  positions are recorded. A split is a reason to say nothing, not a reason to
  average.
- `wrong_if` on every dossier exists so a future reviewer can see the condition
  the original decision depended on, and reopen it when that condition changes.

---

## 10. What this phase deliberately does not do

- It records **no** approvals. Every claim remains `ai_draft` with no reviewer.
- It does not attribute any drafted judgement to a named person.
- It does not make repository signals eligible for anything.
- It does not add a backend. Reviewer decisions export as JSON for a human to
  inspect and commit deliberately.

---

## 11. The user-data firewall (added 2026-08-12, story F1)

Profiles and completion (docs/PRODUCT_PLAN_PROFILES.md, ADR-001) introduce a
second kind of data: what users say about themselves. The firewall keeps the
two kinds from contaminating each other, in both directions.

**Editorial never grades people.** The diagnosis produces no score, percentage,
level or completeness meter — unchanged. Completion tiers grade only a user's
own self-reported journey, on profile surfaces, never inside the diagnosis.

**User data never feeds editorial.** No mark, tier, aggregate or share ever
contributes to a lifecycle classification, a rule, a trend claim, or any
ranking of tools or people. Editorial claims trace to §4 sources; "our users"
is not one.

**User activity never renders on editorial surfaces.** Tool pages, landscape
views, timelines, the diagnosis and the review workstation display editorial
content and its provenance only. Profile, share-view and feed surfaces display
user data and review metadata only.

### Enforcement points

Held by checks, not memory:

- `scripts/validate-content.ts` — the §8 vocabulary bar on published content
  prose (TREND_VOCABULARY), which any aggregate-derived wording would trip.
- `scripts/check-production-artifacts.ts` — every production export scanned;
  withheld editorial cannot reach user-facing surfaces, feeds included.
- `lib/completion.ts` — a pure function over one user's marks; its signature
  admits no second user, so cross-user aggregation has no code path. Its test
  suite fails if any output surface formats a percentage.
- **Phase B gate:** the B3 review must show the backend schema exposes no
  cross-user aggregate view or query. Per ADR-001, F2 there means "no such
  view exists" — refusal is structural, not policy.

What remains convention rather than check: future app code could in principle
render an aggregate it computed itself. It would have nothing to compute from
— no cross-user data exists client-side, and the Phase B schema refuses it
server-side — but reviewers of any PR touching editorial components should
treat a new import of user-state into them as this firewall being breached.

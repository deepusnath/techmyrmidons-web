# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Next dev server
npm run build            # Preview static export to out/ (drafts and review routes included)
npm run build:production # Drafts-hidden export — the only build that may be published
npm run validate         # Validate content/ against schema.ts — run after editing content
npm run test:rules       # Rule-isolation and publication-gate assertions
npm run test:completion  # Completion-model assertions (profiles plan)
npm run deploy           # Drafts-hidden build + guard + publish to GitHub Pages
```

### Verification

There are exactly two supported verification commands. Each builds the export it
tests, so neither can pass against a stale `out/`.

```bash
npm run test:preview     # next build, then the full Playwright suite
npm run test:production  # build:production, artifact guard, then Playwright with DRAFTS_HIDDEN=1
```

`npm test` alone runs Playwright against whatever `out/` happens to contain and
does not build — use it only for a quick re-run of a suite you just built for.

The two runs assert different things. Preview mode exercises the editorial
review workstation at `/review`. Production mode asserts the opposite: that the
review routes, every child artifact of them, every `/review` URL and all
withheld editorial are absent from `out/`. The production assertions in
`tests/review-routes.spec.ts`, `tests/pilot.spec.ts` and `tests/trust.spec.ts`
are gated on `DRAFTS_HIDDEN=1`, which `test:production` sets — without it they
silently skip.

`npm run check:production` runs the artifact guard
(`scripts/check-production-artifacts.ts`) on its own against an existing `out/`.
`npm run deploy` runs it too, and will not push an export that fails it.

Run a single test file or case:

```bash
npx playwright test tests/pilot.spec.ts
npx playwright test tests/pilot.spec.ts -g "name of the test"
```

`npm run test:deployed` runs the same specs against the live GitHub Pages site rather than a local server.

**Never publish a plain `next build`.** Route discovery is what excludes the
review tooling: with `NEXT_PUBLIC_SHOW_DRAFTS` unset, `next.config.ts` treats
`page.preview.tsx` as a route and the review pages are emitted as real, publicly
readable HTML and RSC payloads. Deploy only through `npm run deploy`.

## Architecture

A **statically exported** Next.js 16 App Router site (`output: 'export'` in `next.config.ts`). There is no server and no database: all user state lives in the browser, so any static host works. Two consequences shape everything:

- No server components that fetch at request time, no route handlers, no middleware. Content must be readable at build time.
- `NEXT_PUBLIC_BASE_PATH` must be set when deploying under a subpath (GitHub Pages project sites serve from `/techmyrmidons-web`). Never hardcode absolute paths; go through `lib/routes.ts`.

**Content is the data layer.** `content/` holds the domain model as JSON and markdown — `domains.json`, `practitioners.json`, `editorial/`, `observed/`, `heuristics/`, `resources/` — validated by `content/schema.ts`. Content edits are the common change in this repo, not component edits. Run `npm run validate` after touching it.

**`lib/` is where the logic lives**, and reading these together is the fastest way to understand the app:

- `content.ts` — loads and joins the content layer
- `schema.ts` (in `content/`) — the shape everything else assumes
- `provenance.ts` — tracks where a claim came from; the trust model of the site
- `assessment.ts` — the self-assessment scoring
- `routes.ts` — URL construction, base-path aware
- `state.ts` — browser-local user state
- `views.ts` — view-model assembly for pages

**Directory layout is unusual — read this before searching:**

- `app/` at the repo root is the live App Router tree. `@/*` maps to the repo root, not to `src/`.
- `src/` contains **only** `src/data/`, legacy per-domain JSON and images from the previous site. It is not a source root.
- `legacy/` is the retired Foundation/Grunt static site. Dead code, kept for reference.
- `phase0/` and `.tmp/` are migration scratch space.

**`readme.md` is stale.** It documents the old Foundation CLI / Grunt template that now lives in `legacy/`, including install steps that no longer apply. Trust `package.json` and `next.config.ts` over it.

## Conventions

Commit messages follow the Angular convention documented in [CONVENTIONS.md](./CONVENTIONS.md): `<type>(<scope>): <subject>`, with lines under 100 characters. Only `feat` and `fix` reach the changelog.

TypeScript 7 dropped the compiler API Next's inline type checker used, so type checking goes through the CLI (`experimental.useTypeScriptCli`). If type errors appear during `next build`, that flag is why.

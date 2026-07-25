# Web & Frontend Radar

> **Owning chapter:** seeking maintainer · **Last updated:** 2026-07-25 · **Revision:** 1 (AI-seeded baseline, knowledge through Jan 2026)

## How we got here: 2022 → 2026

- **2022:** The post-jQuery consolidation completes; React dominance peaks; Vite replaces Webpack as the default build story
- **2023:** Server-first returns: React Server Components, Astro's islands, htmx's counter-revolution; TypeScript stops being optional in serious teams
- **2024:** Runtime diversification (Bun, edge functions); Tailwind becomes the default styling answer; design-to-code AI tools get real
- **2025:** AI pair programmers write most boilerplate; the frontend job shifts toward product judgment, accessibility, and performance
- **2026:** "AI-generated UI, human-owned architecture" is the working division of labor

## Adopt

| Tool / practice | Why | Provenance |
|---|---|---|
| TypeScript | The industry's type system; untyped new codebases now need a justification | [ai-seeded] |
| React 19 + a meta-framework (Next.js class) | Still the employment and ecosystem center of gravity | [ai-seeded] |
| Vite | Build tooling that stopped being a hobby; the default for anything not on a meta-framework | [ai-seeded] |
| Tailwind CSS | Won the styling argument by being boring and fast; v4 removed the old objections | [ai-seeded] |
| AI-assisted frontend workflow | Component scaffolding, test generation, refactors; the baseline, not the edge | [ai-seeded] |
| Web performance and accessibility budgets | The differentiator now that everyone can generate a UI; Lighthouse and axe in CI | [ai-seeded] |

## Trial

| Tool / practice | Why | Provenance |
|---|---|---|
| Astro | The content-site answer: islands architecture, ship less JavaScript | [ai-seeded] |
| Bun | Node-compatible, dramatically faster toolchain; this movement's own Beyond Syllabus runs on it | [ai-seeded] |
| htmx / hypermedia-first | The right-sized answer for server-rendered apps that never needed a SPA | [ai-seeded] |
| Edge rendering and regional compute | Latency wins for global audiences; pricing and lock-in still need judgment | [ai-seeded] |
| Svelte 5 / SolidJS | The fine-grained reactivity camp; genuinely better ergonomics, smaller job market | [ai-seeded] |

## Assess

| Tool / practice | Why | Provenance |
|---|---|---|
| WebGPU | Opens ML inference and serious graphics in the browser; toolchain still young | [ai-seeded] |
| AI-generated full interfaces (v0 class) | Prototyping magic today; production ownership questions unresolved | [ai-seeded] |
| Local-first architecture (CRDTs) | The most interesting rethink of state since Redux; watch the sync engines | [ai-seeded] |

## Hold

| Tool / practice | Why | Provenance |
|---|---|---|
| Create React App | Officially dead; migrate | [ai-seeded] |
| jQuery for new work | Respect the veteran, stop enlisting it | [ai-seeded] |
| Bower + Grunt/Gulp pipelines | This very repository's old stack; the museum piece that motivated the rebuild | [ai-seeded] |
| SPA-by-default for content sites | Shipping a megabyte of JavaScript to render an article lost the argument | [ai-seeded] |

## Moves this revision

Baseline revision. 2018–2021 archive preserved in [`archive/`](../archive/).

## Open disagreements

- **React Server Components:** the future of React or complexity smuggled into the framework? Production camps exist on both sides.

## The Ladder: where do you stand in web?

| Step | You can honestly say | Your next move |
|---|---|---|
| **Explorer** | "I built and deployed a static site; I know what HTML, CSS, and the DOM are." | μLearn web interest group; ship a personal site |
| **Practitioner** | "I built a real app with TypeScript and a framework: routing, state, forms, deployed." | Contribute a UI fix to Beyond Syllabus (open source, this movement) |
| **Builder** | "I have shipped for real users; I own performance, accessibility, and errors in production." | Take a Beyond Borders problem statement; review others' PRs |
| **Myrmidon** | "I make architecture calls (SSR vs islands vs SPA) from scars, and can defend them to a room." | Claim this radar as maintainer; speak at an Evolve |

# Phase 0 — does the cohort-tracking thesis hold?

One question, answered in a weekend, for roughly $0:

> If we track what 10 real frontend developers actually import, does a
> believable history of frontend development fall out of it?

If yes, the rest of the rebuild is execution. If no, the cohort-tracking model
is wrong and we have spent a weekend instead of six months.

## Run it

Needs a GitHub token (classic with `public_repo`, or fine-grained with public
read). No `npm install` — Node 23.6+ runs the TypeScript directly.

```bash
GITHUB_TOKEN=ghp_xxx node phase0/backfill.ts
```

First run takes roughly 30–60 minutes and is dominated by GitHub API calls. It
caches every response under `phase0/.cache/`, including 404s, so **re-runs are
nearly instant**. Tune the alias map, re-run, look again — that loop is free.

If it hits the rate limit it sleeps until the window resets and continues. Safe
to interrupt and restart; it picks up from the cache.

Useful flags:

```bash
GITHUB_TOKEN=ghp_xxx node phase0/backfill.ts --max-repos 10 --max-commits 40
```

| flag | default | what it does |
| --- | --- | --- |
| `--cohort` | `phase0/cohort.json` | which cohort to scan |
| `--max-repos` | `25` | repos per person, most-starred first |
| `--max-commits` | `120` | history depth per manifest |
| `--min-stars` | `5` | filters out scratch repos |
| `--concurrency` | `4` | parallel repos; raise carefully |

Start small (`--max-repos 5 --max-commits 20`) to sanity-check the output shape
in ~2 minutes, then run it wide.

## What it does

For each cohort member → their non-fork repos above the star threshold → every
commit that touched `package.json` → the parsed dependency set at that commit.
Consecutive sets are diffed into `added` / `removed` events.

Those events are the `observation` table from the schema. Everything else is a
rollup: events → per-repo-per-tool intervals → per-year distinct-adopter counts.

Two artifacts land in `phase0/out/`:

- **`observations.csv`** — the raw event log. person, repo, tool, added/removed,
  timestamp, commit SHA. This is the asset. It is what an LLM cannot produce,
  because it is measured rather than remembered.
- **`timeline.csv`** — `year, tool, adopters, adopter_pct, people`. The rollup.

And it prints the verdict to your terminal so you do not have to open a
spreadsheet to know whether this worked.

## How to read the verdict

**The adoption-by-year block** should tell the real story: jQuery and Grunt
early, Gulp and Bower peaking mid-2010s, React climbing, webpack taking over
from Browserify, TypeScript arriving, Tailwind showing up around 2021, Vite
displacing webpack.

**The movers block is the one that matters.** It shows tools *losing* adopters.
That is precisely what the old JSON model could not express — [frontend/2021.json](../src/data/frontend/2021.json)
still lists AngularJS and Bower as current picks because nothing could ever
leave the list. If `fading` lines look right, the structural bug is fixed.

## What would falsify the thesis

Be honest about these when you look at the output:

- **Demo-repo skew.** These are public repos, not the codebases these people are
  paid to work on. If the timeline mostly reflects conference demos, adoption
  counts are noise.
- **Thin manifests.** Several of these developers write libraries and specs, not
  apps. A cohort whose repos carry almost no dependencies produces no signal.
- **Timing lag.** A dependency lands in a side project long after the person
  actually adopted it — or years before it went mainstream. Check whether the
  dates feel early, late, or right.
- **The invisible layer.** Cursor, Claude Code, Figma, and every editor and AI
  assistant appear in *no* manifest. This pipeline is structurally blind to what
  may be the most consequential tooling shift of the last three years. That gap
  is the argument for the second, human-reviewed signal pipeline — not something
  to paper over here.

## Known limits (deliberate, for Phase 0)

- npm only. Podfile / build.gradle / requirements.txt parsers come later.
- The alias map in `backfill.ts` is intentionally small — it exists to stop
  plugin sprawl (14 `gulp-*` packages are one fact about gulp, not fourteen).
  It is the first thing to tune after the first run.
- File renames are not followed; a repo that moved its manifest reads as a
  delete plus an add.
- Monorepo workspace manifests are not walked, only the root one.

## Fixing the cohort

`cohort.json` maps names from the original [frontend/follow.json](../src/data/frontend/follow.json)
to GitHub logins. Those logins are best guesses. The script verifies each one
against the API before scanning and prints a clear warning for any that 404 —
fix the line and re-run.

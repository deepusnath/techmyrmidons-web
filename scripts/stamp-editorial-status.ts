#!/usr/bin/env node
/**
 * Stamp review metadata onto content that predates the review model.
 *
 * Idempotent and conservative: it only ever ADDS missing fields with the
 * safe default (`ai_draft`, unreviewed). It never downgrades a record a human
 * has already reviewed, and it never invents a reviewer.
 *
 * Also migrates timeline entries from the old ambiguous arrived/faded arrays to
 * typed events carrying an explicit basis.
 *
 * Usage: node scripts/stamp-editorial-status.ts
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Signal, TimelineEntry, TimelineEvent, Tool } from '../content/schema.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CONTENT = path.join(ROOT, 'content');

let toolsStamped = 0;
let signalsStamped = 0;
let timelineMigrated = 0;

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T;
}
async function writeJson(file: string, data: unknown) {
  await writeFile(file, JSON.stringify(data, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// tools: every AI-authored editorial field starts unreviewed
// ---------------------------------------------------------------------------

async function stampTools() {
  const base = path.join(CONTENT, 'tools');
  if (!existsSync(base)) return;

  for (const domain of await readdir(base)) {
    const dir = path.join(base, domain);
    for (const file of await readdir(dir)) {
      const full = path.join(dir, file);
      const tool = await readJson<Tool & Record<string, unknown>>(full);
      if (tool.editorial_status) continue; // already stamped; do not touch

      tool.editorial_status = 'ai_draft';
      tool.reviewed_by = null;
      tool.reviewed_at = null;
      tool.reviewed_fields = [];
      await writeJson(full, tool);
      toolsStamped++;
    }
  }
}

// ---------------------------------------------------------------------------
// signals: repository specifics, defaulting context to "unknown"
// ---------------------------------------------------------------------------

async function stampSignals() {
  for (const dirName of ['signals', 'observed']) {
    const dir = path.join(CONTENT, dirName);
    if (!existsSync(dir)) continue;

    for (const file of await readdir(dir)) {
      const full = path.join(dir, file);
      const signals = await readJson<Array<Signal & Record<string, unknown>>>(full);
      let changed = false;

      for (const s of signals) {
        if (s.context_status !== undefined) continue;
        s.repo = s.repo ?? null;
        s.manifest_path = s.manifest_path ?? null;
        s.action = s.action ?? null;
        // Never guessed. A repository's role cannot be read off the API.
        s.context_status = 'unknown';
        // Repository signals do not feed trends until a human reviews context.
        s.eligible_for_trends = false;
        changed = true;
        signalsStamped++;
      }
      if (changed) await writeJson(full, signals);
    }
  }
}

// ---------------------------------------------------------------------------
// timeline: arrived/faded -> typed events with a stated basis
// ---------------------------------------------------------------------------

type LegacyEntry = TimelineEntry & { arrived?: string[]; faded?: string[] };

async function migrateTimeline() {
  const dir = path.join(CONTENT, 'timeline');
  if (!existsSync(dir)) return;

  for (const file of await readdir(dir)) {
    const full = path.join(dir, file);
    const entries = await readJson<LegacyEntry[]>(full);
    let changed = false;

    for (const entry of entries) {
      if (entry.events) continue; // already migrated

      const events: TimelineEvent[] = [];

      for (const slug of entry.arrived ?? []) {
        if (entry.is_seed) {
          // Verifiable: the tool literally appears in that year's archive file.
          events.push({
            type: 'first_included_in_techmyrmidons',
            tool_slug: slug,
            basis: 'archive_record',
            basis_detail: `Listed in the original TechMyrmidons curation for ${entry.year} (${entry.seed_source}).`,
            source_url: null,
            claim_status: 'sourced',
          });
        } else {
          // An AI reading of what mattered that year. Not a release date.
          events.push({
            type: 'editorial_turning_point',
            tool_slug: slug,
            basis: 'ai_interpretation',
            basis_detail:
              'AI-authored reading of when this became significant for frontend work. Not a release date and not an adoption measurement.',
            source_url: null,
            claim_status: 'ai_draft',
          });
        }
      }

      for (const slug of entry.faded ?? []) {
        events.push({
          type: slug === 'angularjs' ? 'reached_end_of_life' : 'editorial_turning_point',
          tool_slug: slug,
          basis: 'ai_interpretation',
          basis_detail:
            'AI-authored reading of when this lost default status. Not measured adoption and not a support-end announcement.',
          source_url: null,
          claim_status: 'ai_draft',
        });
      }

      entry.events = events;
      delete entry.arrived;
      delete entry.faded;
      changed = true;
      timelineMigrated++;
    }

    if (changed) await writeJson(full, entries);
  }
}

/**
 * An unreviewed claim must not be attributed to a real person anywhere — not in
 * the UI and not in the stored data, where it would be one careless render away
 * from appearing as a signed judgement.
 */
let bylinesStripped = 0;

async function stripUnreviewedBylines() {
  for (const [dirName, isDraft] of [
    ['editorial', (r: { draft: boolean }) => r.draft],
    ['timeline', (r: { draft: boolean }) => r.draft],
  ] as const) {
    const dir = path.join(CONTENT, dirName);
    if (!existsSync(dir)) continue;

    for (const file of await readdir(dir)) {
      const full = path.join(dir, file);
      const records = await readJson<Array<{ draft: boolean; author: string | null }>>(full);
      let changed = false;
      for (const r of records) {
        if (isDraft(r) && r.author !== null) {
          r.author = null;
          bylinesStripped++;
          changed = true;
        }
      }
      if (changed) await writeJson(full, records);
    }
  }
}

async function main() {
  await stampTools();
  await stampSignals();
  await migrateTimeline();
  await stripUnreviewedBylines();
  if (bylinesStripped) console.error(`stripped ${bylinesStripped} byline(s) from unreviewed records`);
  console.error(
    `stamped ${toolsStamped} tools, ${signalsStamped} signals; migrated ${timelineMigrated} timeline entries`,
  );
  if (!toolsStamped && !signalsStamped && !timelineMigrated) {
    console.error('(nothing to do — content already carries review metadata)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

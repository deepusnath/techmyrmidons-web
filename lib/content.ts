/**
 * Build-time content loading. Everything is read from content/ during the
 * static export, so the shipped site is plain HTML with no server behind it.
 */
import fs from 'node:fs';
import path from 'node:path';
import type {
  Domain,
  EditorialNote,
  Practitioner,
  Resource,
  Signal,
  TimelineEntry,
  Tool,
} from '../content/schema.ts';

export type { Domain, EditorialNote, Practitioner, Resource, Signal, TimelineEntry, Tool };

const CONTENT = path.join(process.cwd(), 'content');

function readJson<T>(...segments: string[]): T | null {
  const file = path.join(CONTENT, ...segments);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function getDomains(): Domain[] {
  return readJson<Domain[]>('domains.json') ?? [];
}

export function getDomain(slug: string): Domain | undefined {
  return getDomains().find((d) => d.slug === slug);
}

export function getTools(domain: string): Tool[] {
  const dir = path.join(CONTENT, 'tools', domain);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Tool)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Tools an editor has actually written up. Only these may be recommended. */
export function getPublishedTools(domain: string): Tool[] {
  return getTools(domain).filter((t) => t.published);
}

export function getTool(domain: string, slug: string): Tool | undefined {
  return getTools(domain).find((t) => t.slug === slug);
}

export function getTimeline(domain: string): TimelineEntry[] {
  return (readJson<TimelineEntry[]>('timeline', `${domain}.json`) ?? []).sort(
    (a, b) => b.year - a.year,
  );
}

export function getEditorial(domain: string): EditorialNote[] {
  return readJson<EditorialNote[]>('editorial', `${domain}.json`) ?? [];
}

export function getEditorialFor(domain: string, toolSlug: string): EditorialNote[] {
  return getEditorial(domain).filter((n) => n.tool_slug === toolSlug);
}

export function getDomainNote(domain: string): EditorialNote | undefined {
  return getEditorial(domain)
    .filter((n) => n.tool_slug === null)
    .sort((a, b) => b.published_at.localeCompare(a.published_at))[0];
}

/** Archive-derived (editorial tier) plus backfill-derived (observed tier). */
export function getSignals(domain: string): Signal[] {
  const archive = readJson<Signal[]>('signals', `${domain}.json`) ?? [];
  const observed = readJson<Signal[]>('observed', `${domain}.json`) ?? [];
  return [...archive, ...observed];
}

export function getSignalsFor(domain: string, toolSlug: string): Signal[] {
  return getSignals(domain)
    .filter((s) => s.tool_slug === toolSlug)
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at));
}

export function getPractitioners(domain: string): Practitioner[] {
  return (readJson<Practitioner[]>('practitioners.json') ?? []).filter((p) =>
    p.domains.includes(domain),
  );
}

export function getResources(domain: string): Resource[] {
  return readJson<Resource[]>('resources', `${domain}.json`) ?? [];
}

/**
 * Demonstration activity for interface testing. Kept in its own file and always
 * rendered with an unmistakable label — never mixed silently with real people.
 */
export interface DemoActivity {
  id: string;
  display_name: string;
  tool_slug: string;
  state: 'exploring' | 'using' | 'shipped';
  at: string;
  is_demo: true;
}

export function getDemoActivity(domain: string): DemoActivity[] {
  return readJson<DemoActivity[]>('demo', `${domain}.json`) ?? [];
}

export const CATEGORIES = (domain: string): string[] =>
  [...new Set(getPublishedTools(domain).map((t) => t.category).filter(Boolean))].sort() as string[];

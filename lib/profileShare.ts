/**
 * Serverless profile sharing.
 *
 * The snapshot travels in the URL *fragment* (`#s=...`), which browsers never
 * send to any server — GitHub Pages sees a request for /profile/view/ and
 * nothing else. Nothing leaves the user's browser except by their own act of
 * sharing the link.
 *
 * The decoder treats every fragment as hostile: anyone can craft one. Strict
 * validation, hard caps and enum checks — a snapshot either conforms entirely
 * or renders not at all. What cannot be prevented is someone honestly encoding
 * dishonest data, which is why the viewer labels every snapshot self-reported
 * and unverified: the same provenance stance the rest of the product takes.
 */
import { TIERS } from './completion.ts';
import { PROGRESS_ORDER, type ProgressState } from './state.ts';

export interface SharedMark {
  name: string;
  state: ProgressState;
  date: string;
}

export interface SharedDomain {
  name: string;
  tier: string;
  journeyLabel: string | null;
  journey: { touched: number; total: number; shipped: number } | null;
  recent: SharedMark[];
}

export interface ProfileSnapshot {
  v: 1;
  generated_at: string;
  domains: SharedDomain[];
}

const MAX_DOMAINS = 8;
const MAX_RECENT = 5;
const MAX_NAME = 60;
const MAX_LABEL = 80;
const TIER_NAMES = new Set(TIERS.map((t) => t.name));

const toBytes = (s: string) => new TextEncoder().encode(s);
const fromBytes = (b: Uint8Array) => new TextDecoder().decode(b);

export function encodeSnapshot(snapshot: ProfileSnapshot): string {
  const bytes = toBytes(JSON.stringify(snapshot));
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function isIsoDate(s: unknown): s is string {
  return typeof s === 'string' && s.length <= 30 && !Number.isNaN(new Date(s).getTime());
}

function isCount(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 500;
}

/** Null on ANY violation — a snapshot conforms entirely or does not render. */
export function decodeSnapshot(encoded: string): ProfileSnapshot | null {
  try {
    if (typeof encoded !== 'string' || encoded.length === 0 || encoded.length > 8192) return null;
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const raw = JSON.parse(fromBytes(bytes)) as Record<string, unknown>;

    if (raw.v !== 1 || !isIsoDate(raw.generated_at) || !Array.isArray(raw.domains)) return null;
    if (raw.domains.length === 0 || raw.domains.length > MAX_DOMAINS) return null;

    const domains: SharedDomain[] = [];
    for (const d of raw.domains as Array<Record<string, unknown>>) {
      if (typeof d.name !== 'string' || d.name.length === 0 || d.name.length > MAX_NAME) return null;
      if (typeof d.tier !== 'string' || !TIER_NAMES.has(d.tier)) return null;
      const journeyLabel =
        d.journeyLabel == null
          ? null
          : typeof d.journeyLabel === 'string' && d.journeyLabel.length <= MAX_LABEL
            ? d.journeyLabel
            : undefined;
      if (journeyLabel === undefined) return null;

      let journey: SharedDomain['journey'] = null;
      if (d.journey != null) {
        const j = d.journey as Record<string, unknown>;
        if (!isCount(j.touched) || !isCount(j.total) || !isCount(j.shipped)) return null;
        if (j.touched > j.total || j.shipped > j.total) return null;
        journey = { touched: j.touched, total: j.total, shipped: j.shipped };
      }

      if (!Array.isArray(d.recent) || d.recent.length > MAX_RECENT) return null;
      const recent: SharedMark[] = [];
      for (const m of d.recent as Array<Record<string, unknown>>) {
        if (typeof m.name !== 'string' || m.name.length === 0 || m.name.length > MAX_NAME) return null;
        if (typeof m.state !== 'string' || !PROGRESS_ORDER.includes(m.state as ProgressState)) return null;
        if (!isIsoDate(m.date)) return null;
        recent.push({ name: m.name, state: m.state as ProgressState, date: m.date });
      }

      domains.push({ name: d.name, tier: d.tier, journeyLabel, journey, recent });
    }

    return { v: 1, generated_at: raw.generated_at, domains };
  } catch {
    return null;
  }
}

#!/usr/bin/env node
/**
 * Proves the share codec round-trips honest data and refuses everything else.
 *
 * The fragment is attacker-writable: anyone can hand anyone a crafted link.
 * The decoder's contract is all-or-nothing — a snapshot that violates any cap,
 * enum or bound renders as "nothing to show", never partially.
 *
 * Usage: node scripts/tests/profile-share.test.ts
 */
import { decodeSnapshot, encodeSnapshot, type ProfileSnapshot } from '../../lib/profileShare.ts';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got  ${a}\n        want ${e}`}`);
}

const good: ProfileSnapshot = {
  v: 1,
  generated_at: '2026-08-11T00:00:00.000Z',
  domains: [
    {
      name: 'Artificial Intelligence',
      tier: 'Explorer',
      journeyLabel: 'Building with models',
      journey: { touched: 1, total: 6, shipped: 1 },
      recent: [
        { name: 'LiteLLM', state: 'shipped', date: '2026-08-10T00:00:00.000Z' },
        { name: 'PyTorch', state: 'using', date: '2026-08-09T00:00:00.000Z' },
      ],
    },
    { name: 'Frontend', tier: 'Scout', journeyLabel: null, journey: null, recent: [] },
  ],
};

function mutate(fn: (s: ProfileSnapshot) => void): string {
  const copy = JSON.parse(JSON.stringify(good)) as ProfileSnapshot;
  fn(copy);
  return encodeSnapshot(copy);
}

function main() {
  // --- round trip -----------------------------------------------------------
  const encoded = encodeSnapshot(good);
  check('encoding is URL-safe', /^[A-Za-z0-9_-]+$/.test(encoded), true);
  check('round trip preserves the snapshot', decodeSnapshot(encoded), good);

  // --- garbage --------------------------------------------------------------
  check('garbage is rejected', decodeSnapshot('not-base64!!!'), null);
  check('empty is rejected', decodeSnapshot(''), null);
  check('valid base64 of non-JSON is rejected', decodeSnapshot('aGVsbG8'), null);
  check('oversized payloads are rejected', decodeSnapshot('A'.repeat(9000)), null);

  // --- structural violations, each fatal ------------------------------------
  check('wrong version is rejected', decodeSnapshot(mutate((s) => { (s as { v: number }).v = 2; })), null);
  check('bad date is rejected', decodeSnapshot(mutate((s) => { s.generated_at = 'yesterday-ish'; })), null);
  check('no domains is rejected', decodeSnapshot(mutate((s) => { s.domains = []; })), null);
  check('invented tier is rejected', decodeSnapshot(mutate((s) => { s.domains[0].tier = 'Grandmaster'; })), null);
  check('invented state is rejected',
    decodeSnapshot(mutate((s) => { (s.domains[0].recent[0] as { state: string }).state = 'mastered'; })), null);
  check('oversized name is rejected',
    decodeSnapshot(mutate((s) => { s.domains[0].name = 'x'.repeat(61); })), null);
  check('impossible journey is rejected',
    decodeSnapshot(mutate((s) => { s.domains[0].journey = { touched: 9, total: 6, shipped: 1 }; })), null);
  check('negative count is rejected',
    decodeSnapshot(mutate((s) => { s.domains[0].journey = { touched: -1, total: 6, shipped: 1 }; })), null);
  check('too many recents is rejected',
    decodeSnapshot(mutate((s) => {
      s.domains[0].recent = Array(6).fill({ name: 'X', state: 'using', date: '2026-08-10T00:00:00.000Z' });
    })), null);
  check('too many domains is rejected',
    decodeSnapshot(mutate((s) => { s.domains = Array(9).fill(s.domains[1]); })), null);

  // --- the all-or-nothing contract ------------------------------------------
  // One bad domain among good ones must reject the whole snapshot.
  check('one bad domain poisons the snapshot',
    decodeSnapshot(mutate((s) => { s.domains[1].tier = 'Legend'; })), null);

  console.log(failures === 0 ? '\nall green' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main();

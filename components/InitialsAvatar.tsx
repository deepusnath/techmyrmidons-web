/**
 * Practitioner avatar: initials, never a photograph.
 *
 * The site records where every claim came from, but had no field in which to
 * record where a person's photograph came from or under what licence — and
 * published ten of them anyway. One file was even shared by two different
 * people, so it was not a likeness of either. Initials give the same visual
 * anchor with nothing to license and no likeness to misuse.
 *
 * Decorative: the person's name is always rendered beside it, so this is
 * aria-hidden to avoid announcing the same person twice.
 */

/**
 * First letter of the first and last name parts — "Nicholas C. Zakas" is "NZ",
 * "Lea Verou" is "LV", a mononym is one letter.
 *
 * Iterates by code point so names outside the Latin alphabet keep their first
 * character intact rather than being split mid-surrogate.
 */
export function initialsOf(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => Array.from(part).find((ch) => /\p{L}/u.test(ch)) ?? '')
    .filter(Boolean);

  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].toUpperCase();
  return (parts[0] + parts[parts.length - 1]).toUpperCase();
}

export function InitialsAvatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-wide"
      style={{ background: 'var(--bg-3)', color: 'var(--fg-dim)' }}
    >
      {initialsOf(name)}
    </span>
  );
}

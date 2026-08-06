/**
 * Every internal route in one place.
 *
 * Internal navigation MUST go through next/link with one of these paths.
 * A raw <a href="/…"> does not get the configured basePath prepended, which is
 * how timeline event links ended up pointing at the domain root and 404ing on
 * the GitHub Pages project site. Centralising the paths makes that mistake
 * visible in review rather than only in production.
 */
export const routes = {
  home: () => '/',
  domain: (domain: string) => `/${domain}/`,
  landscape: (domain: string, view: string) => `/${domain}/${view}/`,
  tool: (domain: string, slug: string) => `/${domain}/tools/${slug}/`,
  signals: (domain: string) => `/${domain}/activity/`,
  me: () => '/me/',
  submit: () => '/submit/',
} as const;

/**
 * The editorial review inventory.
 *
 * Deliberately NOT a member of `routes`. That object is imported by client
 * components, and every member ships in the production JS bundle whether or not
 * anything calls it — a second client consumer was enough to emit this string
 * into a drafts-hidden export and trip the artifact guard. No review URL may
 * appear in a production build, so the one route that must never be bundled
 * stays out of the object that gets bundled.
 *
 * Both call sites are server components, so nothing here reaches the client.
 */
export const REVIEW_ROUTE = '/review/';

/** Absolute deployment prefix, used by the link-integrity crawler. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Prefix a public asset path (images live outside the router). */
export function asset(path: string): string {
  return `${BASE_PATH}${path}`;
}

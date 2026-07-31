import type { NextConfig } from 'next';

/**
 * Static export. The pilot is local-first — all user state lives in the browser
 * — so there is no server to run and the whole site can be hosted on any static
 * host (GitHub Pages, Firebase Hosting, Netlify).
 *
 * NEXT_PUBLIC_BASE_PATH is set when deploying under a subpath, e.g. GitHub
 * Pages project sites served from /techmyrmidons-web.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * Preview builds additionally treat `page.preview.tsx` as a route. Production
 * builds do not, so review tooling under app/review/ is never discovered, never
 * rendered and never emitted — no HTML, no RSC payload, no manifest entry.
 *
 * Route discovery is the gate. A runtime check would still generate the files.
 */
const showDrafts = process.env.NEXT_PUBLIC_SHOW_DRAFTS !== 'false';
const pageExtensions = showDrafts ? ['tsx', 'ts', 'preview.tsx'] : ['tsx', 'ts'];

const nextConfig: NextConfig = {
  output: 'export',
  pageExtensions,
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    // Unset by default — no contact address ships unless one is configured.
    NEXT_PUBLIC_FEEDBACK_EMAIL: process.env.NEXT_PUBLIC_FEEDBACK_EMAIL ?? '',
  },
  // TypeScript 7 dropped the legacy compiler API Next's inline type checker used;
  // the CLI path is the supported route on TS 7.
  experimental: { useTypeScriptCli: true },
};

export default nextConfig;

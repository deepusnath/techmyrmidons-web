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

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // TypeScript 7 dropped the legacy compiler API Next's inline type checker used;
  // the CLI path is the supported route on TS 7.
  experimental: { useTypeScriptCli: true },
};

export default nextConfig;

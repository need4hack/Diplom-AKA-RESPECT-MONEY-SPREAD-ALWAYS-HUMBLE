import type { NextConfig } from "next";

/**
 * Next.js configuration.
 *
 * API proxying is handled by the Route Handler in app/api/[...path]/route.ts.
 *
 * skipTrailingSlashRedirect: prevents Next.js from issuing 308 redirects
 * on URLs like /api/vehicles/options/year/ — Django requires trailing slashes,
 * but Next.js by default strips them, causing ERR_TOO_MANY_REDIRECTS.
 */

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
};

export default nextConfig;

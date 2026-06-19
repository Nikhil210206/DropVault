import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Compile the shared workspace package (it ships TypeScript source, not a build).
  transpilePackages: ['@dropvault/shared'],
  // Self-contained server output for a slim Docker image; trace from the monorepo root.
  output: 'standalone',
  outputFileTracingRoot: path.join(here, '../..'),
};

export default nextConfig;

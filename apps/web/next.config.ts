import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Compile the shared workspace package (it ships TypeScript source, not a build).
  transpilePackages: ['@dropvault/shared'],
};

export default nextConfig;

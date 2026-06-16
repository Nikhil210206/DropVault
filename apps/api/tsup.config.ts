import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  clean: true,
  dts: false,
  // Bundle the workspace package so the production dist is self-contained.
  noExternal: ['@dropvault/shared'],
});

import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { include: ['tests/integration/**/*.test.ts'], globalSetup: ['tests/integration/global-setup.ts'], testTimeout: 30_000, hookTimeout: 60_000, fileParallelism: false },
});

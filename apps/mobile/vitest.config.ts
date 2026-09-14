import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/** Yalnız saf modüller (i18n, doğrulama) node ortamında test edilir; RN bileşen testleri native/Maestro kapsamındadır. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});

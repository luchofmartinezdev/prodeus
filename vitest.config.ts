import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [angular()],
  envPrefix: 'NG_APP_',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    tsconfig: 'tsconfig.spec.json',
    env: {
      NG_APP_SUPABASE_URL: 'https://test.supabase.co',
      NG_APP_SUPABASE_ANON_KEY: 'test-anon-key',
      NG_APP_PRODUCTION: 'false',
    },
  },
});

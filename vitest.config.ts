import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [angular()],
  envPrefix: 'NG_APP_',
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/app/core', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/app/shared', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/app/features', import.meta.url)),
      '@data': fileURLToPath(new URL('./src/app/data', import.meta.url)),
      '@state': fileURLToPath(new URL('./src/app/state', import.meta.url)),
      '@env': fileURLToPath(new URL('./src/environments', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    tsconfig: 'tsconfig.spec.json',
    env: {
      NG_APP_PRODUCTION: 'false',
      NG_APP_FIREBASE_API_KEY: 'test-api-key',
      NG_APP_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
      NG_APP_FIREBASE_PROJECT_ID: 'test-project',
      NG_APP_FIREBASE_STORAGE_BUCKET: 'test.firebasestorage.app',
      NG_APP_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      NG_APP_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
    },
  },
});

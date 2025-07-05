import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { execSync } from 'child_process';

// Pre-generate Prisma client before tests
try {
  execSync('npx prisma generate --no-engine', { stdio: 'inherit' });
} catch (error) {
  console.error('Failed to generate Prisma client:', error);
}

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'node',
  },
});

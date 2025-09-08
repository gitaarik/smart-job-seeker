#!/usr/bin/env tsx

import { spawn } from 'child_process';
import { getEnv } from '../src/lib/tools/get-env';

const connectionString = getEnv('POSTGRES_URL');

if (!connectionString) {
  console.error('Error: POSTGRES_URL environment variable is not set');
  process.exit(1);
}

const psql = spawn('psql', [connectionString], {
  stdio: 'inherit'
});

psql.on('close', (code) => {
  process.exit(code || 0);
});

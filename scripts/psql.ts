#!/usr/bin/env tsx

import { spawn } from 'child_process';

const connectionString = process.env.POSTGRES_URL;

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

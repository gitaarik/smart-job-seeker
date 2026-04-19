import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { eq, asc } from 'drizzle-orm';
import { scraper_logs } from './src/lib/server/db/schema.ts';

const pool = new pg.Pool({
  connectionString: 'postgres://postgres:postgres@localhost:5432/smartjobseeker',
});
const db = drizzle(pool);

const logs = await db.select({
  level: scraper_logs.level,
  message: scraper_logs.message,
  timestamp: scraper_logs.timestamp,
}).from(scraper_logs)
  .where(eq(scraper_logs.run_id, 210))
  .orderBy(asc(scraper_logs.timestamp));

for (const l of logs) {
  const t = new Date(l.timestamp).toLocaleTimeString('en-US', { hour12: false });
  console.log(t + ' ' + l.level.padEnd(5) + ' ' + l.message);
}
await pool.end();

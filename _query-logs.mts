import { PrismaClient } from './generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: 'postgres://postgres:postgres@localhost:5432/smartjobseeker',
});
const db = new PrismaClient({ adapter });

const logs = await db.scraper_logs.findMany({
  where: { run_id: 210 },
  orderBy: { timestamp: 'asc' },
  select: { level: true, message: true, timestamp: true }
});
for (const l of logs) {
  const t = new Date(l.timestamp).toLocaleTimeString('en-US', { hour12: false });
  console.log(t + ' ' + l.level.padEnd(5) + ' ' + l.message);
}
await db.$disconnect();

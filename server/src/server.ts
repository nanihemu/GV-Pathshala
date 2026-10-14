import { app } from './app';
import { brand } from './config/brand';
import { env, aiConfigured } from './config/env';
import { prisma } from './config/db';
import { startScheduler } from './jobs/weeklySummary.job';

const server = app.listen(env.PORT, () => {
  console.log(`${brand.name} API on http://localhost:${env.PORT}`);
  console.log(aiConfigured ? 'AI: configured' : 'AI: not configured (tutor shows closest passage; generators return a clear message)');
});
startScheduler();

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

import { buildApp } from './app.js';
import { config } from './config.js';
import { prisma } from './lib/prisma.js';

async function main(): Promise<void> {
  const app = await buildApp();

  // Graceful shutdown on SIGTERM/SIGINT (12-factor disposability).
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Shutting down');
    try {
      await app.close();
      await prisma.$disconnect();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ host: '0.0.0.0', port: config.PORT });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error', err);
  process.exit(1);
});

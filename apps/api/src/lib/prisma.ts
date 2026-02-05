import { PrismaClient } from '@prisma/client';
import { config } from '../config/index.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Configure Prisma for Neon serverless (handles connection closing)
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: config.databaseUrl,
      },
    },
  });

// Keep connection alive by pinging periodically
if (config.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma;

  // Ping database every 4 minutes to keep connection alive (Neon closes after 5 min idle)
  setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      console.log('📡 Reconnecting to database...');
    }
  }, 4 * 60 * 1000);
}

// Handle connection errors gracefully
prisma.$connect().catch((e) => {
  console.error('❌ Failed to connect to database:', e.message);
});

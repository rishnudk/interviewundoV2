import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { redis, redisSubscriber } from './config/redis';
import { Server as SocketIOServer } from 'socket.io';
import { socketIOService } from './infrastructure/notification/SocketIOService';
import { container } from './container';
import { DailyChallengeCron } from './infrastructure/cron/DailyChallengeCron';

// ============================================================
// Server Entry Point — With Graceful Shutdown
// ============================================================

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${env.PORT}`);
  logger.info(`📖 Environment: ${env.NODE_ENV}`);
  logger.info(`🏥 Health check: http://localhost:${env.PORT}/health`);
});

// --- Initialize Socket.io Server ---
const io = new SocketIOServer(server, {
  cors: {
    origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
  },
});

socketIOService.initialize(io, container.services.authTokenService);

// --- Initialize Cron Jobs ---
DailyChallengeCron.start();

// --- Graceful Shutdown ---
async function gracefulShutdown(signal: string) {
  logger.info(`\n${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    // Close database connection
    await prisma.$disconnect();
    logger.info('Database disconnected');

    // Close Redis connection
    redis.disconnect();
    redisSubscriber.disconnect();
    logger.info('Redis connections disconnected');

    logger.info('✅ Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('⚠️ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

import { Sentry } from './config/sentry';

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason) => {
  Sentry.captureException(reason);
  logger.error({ reason }, 'Unhandled Rejection');
});

process.on('uncaughtException', (error) => {
  Sentry.captureException(error);
  logger.fatal({ error }, 'Uncaught Exception');
  process.exit(1);
});

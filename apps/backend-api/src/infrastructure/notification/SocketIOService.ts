import { Server as SocketIOServer } from 'socket.io';
import type { INotificationService } from '../../domain/ports/services/INotificationService';
import type { IAuthTokenService } from '../../domain/ports/services/IAuthTokenService';
import { logger } from '../../config/logger';
import { redisSubscriber } from '../../config/redis';

export class SocketIOService implements INotificationService {
  private io: SocketIOServer | null = null;

  initialize(io: SocketIOServer, authTokenService: IAuthTokenService): void {
    this.io = io;
    logger.info('SocketIOService: Socket.io server instance attached');

    // Setup Socket.io middleware for JWT authentication
    this.io.use(async (socket, next) => {
      try {
        let token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;

        if (!token) {
          logger.warn('Socket connection rejected: No token provided');
          return next(new Error('Authentication error: Token missing'));
        }

        if (token.startsWith('Bearer ')) {
          token = token.substring(7);
        }

        const payload = await authTokenService.verifyAccessToken(token);

        socket.data.user = {
          id: payload.userId,
          role: payload.role,
        };

        next();
      } catch (err: any) {
        logger.warn({ err: err.message }, 'Socket connection rejected: Authentication failed');
        next(new Error('Authentication error: Invalid token'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket) => {
      const userId = socket.data.user.id;
      const roomId = `user:${userId}`;
      socket.join(roomId);
      logger.info(
        { userId, socketId: socket.id },
        `Socket client connected and joined room ${roomId}`,
      );

      socket.on('disconnect', () => {
        logger.info({ userId, socketId: socket.id }, 'Socket client disconnected');
      });
    });

    // Start Redis subscriber to listen for submission worker updates
    this.startRedisSubscriber();
  }

  private async startRedisSubscriber(): Promise<void> {
    try {
      redisSubscriber.on('message', (channel: any, message: any) => {
        if (channel === 'submission:updates') {
          try {
            const payload = JSON.parse(message);
            const {
              userId,
              submissionId,
              status,
              data,
              error,
              userStreak,
              streakMilestone,
              runtimePercentile,
            } = payload;

            logger.info(
              { userId, submissionId, status },
              'Received update from Redis channel "submission:updates"',
            );

            this.notifyUser(userId, 'submission:status', {
              submissionId,
              status,
              ...(data ? { data } : {}),
              ...(error ? { error } : {}),
              ...(userStreak !== undefined ? { userStreak } : {}),
              ...(streakMilestone !== undefined ? { streakMilestone } : {}),
              ...(runtimePercentile !== undefined ? { runtimePercentile } : {}),
            });
          } catch (err: any) {
            logger.error({ err: err.message, message }, 'Failed to parse Redis pub/sub message');
          }
        }
      });

      await redisSubscriber.subscribe('submission:updates');
      logger.info('🔔 Subscribed to Redis pub/sub channel "submission:updates"');
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to subscribe to Redis pub/sub channel');
    }
  }

  notifyUser(userId: string, event: string, data: unknown): void {
    if (!this.io) {
      logger.warn(`SocketIOService not initialized. Cannot notify user ${userId}`);
      return;
    }
    const roomId = `user:${userId}`;
    this.io.to(roomId).emit(event, data);
    logger.debug({ userId, event }, `Emitted event "${event}" to room ${roomId}`);
  }

  notifyAll(event: string, data: unknown): void {
    if (!this.io) {
      logger.warn(`SocketIOService not initialized. Cannot broadcast event ${event}`);
      return;
    }
    this.io.emit(event, data);
    logger.debug({ event }, `Broadcasted event "${event}" to all connected sockets`);
  }
}

export const socketIOService = new SocketIOService();

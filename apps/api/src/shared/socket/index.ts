import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { isTokenBlacklisted } from '../middleware/tokenBlacklist';
import pool from '../database';
import logger from '../utils/logger';
import { checkConnectionLimit, checkEventLimit } from './rateLimiter';

let io: Server | null = null;
const onlineUsers = new Set<string>();

export function initSocketServer(httpServer: HTTPServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        const allowed = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'];
        if (!origin || allowed.includes(origin)) return callback(null, true);
        callback(null, true);
      },
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.use(async (socket: Socket, next) => {
    const ip = socket.handshake.address;
    if (checkConnectionLimit(ip)) {
      logger.warn({ ip }, 'Socket connection rate limit exceeded');
      return next(new Error('Connection rate limit exceeded'));
    }

    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const secret = process.env.JWT_SECRET!;
      const decoded = jwt.verify(token as string, secret) as any;

      const blacklisted = await isTokenBlacklisted(token as string);
      if (blacklisted) return next(new Error('Token has been revoked'));

      // Check user still exists, is active, and role hasn't changed
      const userResult = await pool.query(
        'SELECT id, status, role FROM users WHERE id = $1',
        [decoded.userId]
      );
      if (userResult.rows.length === 0) return next(new Error('User no longer exists'));
      if (userResult.rows[0].status === 'deactivated') return next(new Error('Account deactivated'));
      if (userResult.rows[0].role !== decoded.role) return next(new Error('Permissions changed, please log in again'));

      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    if (user?.userId) {
      socket.join(`user:${user.userId}`);
      onlineUsers.add(user.userId);
      // Broadcast online status to all connected users
      socket.broadcast.emit('user:online', { userId: user.userId });
    }

    socket.on('chat:join', async (channelId: string) => {
      if (!user?.userId) return;
      if (checkEventLimit(user.userId)) return;
      try {
        const membership = await pool.query(
          `SELECT 1 FROM chat_members WHERE channel_id = $1 AND user_id = $2`,
          [channelId, user.userId]
        );
        if (membership.rows.length > 0) {
          socket.join(`channel:${channelId}`);
        }
      } catch { logger.warn('socket chat:join membership check failed') }
    });

    socket.on('chat:leave', (channelId: string) => {
      if (!user?.userId) return;
      if (checkEventLimit(user.userId)) return;
      socket.leave(`channel:${channelId}`);
    });

    socket.on('chat:typing', (data: { channelId: string; isTyping: boolean }) => {
      if (!user?.userId) return;
      if (checkEventLimit(user.userId)) return;
      socket.to(`channel:${data.channelId}`).emit('chat:typing', {
        channelId: data.channelId,
        userId: user?.userId,
        isTyping: data.isTyping,
      });
    });

    socket.on('disconnect', () => {
      if (user?.userId) {
        onlineUsers.delete(user.userId);
        socket.broadcast.emit('user:offline', { userId: user.userId });
      }
    });
  });

  logger.info('Socket.io initialized');
  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

export function getOnlineUsers(): Set<string> {
  return onlineUsers;
}

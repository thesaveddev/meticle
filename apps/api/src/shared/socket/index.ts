import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Redis } from 'ioredis';
import { isTokenBlacklisted } from '../middleware/tokenBlacklist';
import pool, { resetRlsSessionVars } from '../database';
import logger from '../utils/logger';
import { checkConnectionLimit, checkEventLimit } from './rateLimiter';
import { createAdapter } from '@socket.io/redis-streams-adapter';
import {
  recordSocketConnection,
  recordSocketDisconnection,
  recordSocketEvent,
  recordSocketError,
  setSocketActiveConnections,
  setSocketOnlineUsers,
} from '../metrics';

const MAX_SOCKETS_PER_USER = 5;
const AUTH_CACHE_TTL_MS = 30_000;
const MEMBERSHIP_CACHE_TTL_MS = 30_000;

interface AuthCacheEntry {
  status: string;
  role: string;
  expiresAt: number;
}

interface SocketEntry {
  socket: Socket;
  connectedAt: number;
}

interface MembershipCacheEntry {
  valid: boolean;
  expiresAt: number;
}

const authCache = new Map<string, AuthCacheEntry>();
const membershipCache = new Map<string, MembershipCacheEntry>();
const userSockets = new Map<string, Map<string, SocketEntry>>();
const onlineUsers = new Set<string>();

let io: Server | null = null;
let adapterRedisClient: Redis | null = null;

function getClientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (forwarded) {
    const first = String(forwarded).split(',')[0].trim();
    if (first) return first;
  }
  return socket.handshake.address;
}

/**
 * Decide whether a socket.io connection origin is allowed. The allowlist is
 * built from CORS_ORIGINS (comma-separated) plus FRONTEND_URL plus the default
 * dev origins, so a misconfigured deployment degrades instead of silently
 * rejecting every real connection. Loopback and private-LAN origins
 * (localhost/127.x/[::1]/10.x/192.168.x/172.16-31.x) are always accepted
 * outside production for local and same-network development; CORS_ORIGINS='*'
 * disables checks.
 */
function isOriginAllowed(origin: string): boolean {
  if (!origin) return true;
  if (process.env.CORS_ORIGINS?.trim() === '*') return true;

  const allowlist = [
    ...(process.env.CORS_ORIGINS?.split(',') ?? []),
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    'http://localhost:3000',
    'http://localhost:5173',
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowlist.includes(origin)) return true;

  if (process.env.NODE_ENV !== 'production') {
    try {
      const hostname = new URL(origin).hostname.replace(/^\[|\]$/g, '');
      const isLoopback = hostname === 'localhost' || hostname === '::1' || hostname.startsWith('127.');
      const isPrivateLan =
        /^(10\.|192\.168\.)/.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
      if (isLoopback || isPrivateLan) return true;
    } catch {
      // Malformed origin — fall through to rejection.
    }
  }
  return false;
}

/**
 * Verify the user row with RLS session variables set, mirroring the HTTP
 * `authenticate` path. Sockets have no request-scoped client, so we acquire
 * a dedicated pooled client, set the session vars, query, then reset before
 * releasing (avoids leaking tenant context back into the pool).
 */
async function getUserAuthStatus(decoded: { userId: string; role: string; organizationId?: string }): Promise<{ status: string; role: string } | null> {
  const result = await scopedQuery(decoded, 'SELECT id, status, role FROM users WHERE id = $1', [decoded.userId]);
  if (result.rows.length === 0) return null;
  return { status: result.rows[0].status, role: result.rows[0].role };
}

/**
 * Run a query scoped to a user's tenant context (RLS session vars set),
 * then reset and release the client. Mirrors how HTTP requests query via
 * the request-scoped client so socket handlers stay tenant-isolated.
 */
async function scopedQuery(
  decoded: { userId: string; role: string; organizationId?: string },
  text: string,
  params?: any[]
): Promise<any> {
  const client = await pool.connect();
  try {
    const setCalls: Promise<any>[] = [];
    if (decoded.organizationId) {
      setCalls.push(client.query(`SELECT set_config('app.current_org_id', $1, false)`, [decoded.organizationId]));
    }
    setCalls.push(client.query(`SELECT set_config('app.current_user_id', $1, false)`, [decoded.userId]));
    setCalls.push(client.query(`SELECT set_config('app.current_user_role', $1, false)`, [decoded.role]));
    await Promise.all(setCalls);

    return await client.query(text, params);
  } finally {
    await resetRlsSessionVars(client);
    client.release();
  }
}

export async function initSocketServer(httpServer: HTTPServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin as string)) return callback(null, true);
        logger.warn({ origin }, 'Socket connection rejected (origin not allowed by CORS)');
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6,
    serveClient: false,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
  });

  // Use the Redis Streams adapter (supports connectionStateRecovery) when available.
  // It takes a single client and duplicates internally for pub/sub; ioredis auto-connects.
  try {
    const url = process.env.REDIS_URL;
    if (url) {
      adapterRedisClient = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
      });
      adapterRedisClient.on('error', (err) => logger.warn({ err: err.message }, 'Socket Redis adapter error'));
      await adapterRedisClient.connect();
      io.adapter(createAdapter(adapterRedisClient, { onlyPlaintext: true }));
      logger.info('Socket.IO using Redis Streams adapter (connection state recovery enabled)');
    } else {
      logger.info('Socket.IO using in-memory adapter (connection state recovery enabled)');
    }
  } catch (err) {
    adapterRedisClient = null;
    logger.warn({ err: (err as Error)?.message }, 'Redis unavailable for Socket.IO adapter, using in-memory (single-process mode)');
  }

  io.use(async (socket: Socket, next) => {
    try {
      const ip = getClientIp(socket);
      if (await checkConnectionLimit(ip)) {
        logger.warn({ ip }, 'Socket connection rate limit exceeded');
        return next(new Error('Connection rate limit exceeded'));
      }

      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication required'));

      const secret = process.env.JWT_SECRET!;
      const decoded = jwt.verify(token as string, secret) as {
        userId: string;
        email: string;
        role: string;
        organizationId: string;
      };
      if (!decoded?.userId) return next(new Error('Invalid token'));

      const blacklisted = await isTokenBlacklisted(token as string);
      if (blacklisted) return next(new Error('Token has been revoked'));

      // Cache status/role so reconnects and recovery don't hit the DB every time.
      let cached = authCache.get(decoded.userId);
      if (!cached || cached.expiresAt < Date.now()) {
        const auth = await getUserAuthStatus(decoded);
        if (!auth) return next(new Error('User no longer exists'));
        cached = {
          status: auth.status,
          role: auth.role,
          expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
        };
        authCache.set(decoded.userId, cached);
      }

      if (cached.status === 'deactivated') return next(new Error('Account deactivated'));
      if (cached.role !== decoded.role) return next(new Error('Permissions changed, please log in again'));

      // Persist in socket.data so connectionStateRecovery restores it without re-authing.
      socket.data.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        organizationId: decoded.organizationId,
      };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as { userId: string; email: string; role: string; organizationId: string };
    if (!user?.userId) {
      socket.disconnect(true);
      return;
    }

    recordSocketConnection(String((socket.conn.transport as { name?: string })?.name || 'websocket'));
    setSocketActiveConnections(io!.engine.clientsCount);

    if (!Array.isArray(socket.data.joinedChannels)) socket.data.joinedChannels = [];

    socket.join(`user:${user.userId}`);

    // Refcounted presence: keyed by userId with per-socket entries so multi-tab
    // and multi-instance stay consistent. Recovery may re-use the same socket.id,
    // so entry identity is checked against the socket object on disconnect.
    let entries = userSockets.get(user.userId);
    if (!entries) {
      entries = new Map();
      userSockets.set(user.userId, entries);
    }
    entries.set(socket.id, { socket, connectedAt: Date.now() });
    setSocketOnlineUsers(userSockets.size);

    // Enforce per-user cap: disconnect the oldest sockets beyond the limit.
    if (entries.size > MAX_SOCKETS_PER_USER) {
      const over = entries.size - MAX_SOCKETS_PER_USER;
      const oldest = [...entries.entries()]
        .sort((a, b) => a[1].connectedAt - b[1].connectedAt)
        .slice(0, over);
      for (const [sid, entry] of oldest) {
        logger.warn({ userId: user.userId, socketId: sid }, 'Disconnecting oldest socket (per-user cap)');
        entry.socket.disconnect(true);
      }
    }

    // Broadcast online only on the 0→1 transition.
    if (entries.size === 1) {
      onlineUsers.add(user.userId);
      socket.broadcast.emit('user:online', { userId: user.userId });
    }

    // Snapshot of current presence for the freshly connected socket.
    socket.emit('presence:snapshot', { onlineUserIds: [...userSockets.keys()] });

    const joinedChannels = () => socket.data.joinedChannels as string[];

    socket.on('chat:join', async (channelId: string, ack?: (res: { ok: boolean }) => void) => {
      if (!user?.userId || typeof channelId !== 'string' || !channelId) return;
      recordSocketEvent('chat:join');
      if (await checkEventLimit(user.userId)) return;
      try {
        const key = `${user.userId}:${channelId}`;
        const cached = membershipCache.get(key);
        let valid: boolean;
        if (cached && cached.expiresAt > Date.now()) {
          valid = cached.valid;
        } else {
          const membership = await scopedQuery(
            user,
            'SELECT 1 FROM chat_members WHERE channel_id = $1 AND user_id = $2',
            [channelId, user.userId]
          );
          valid = membership.rows.length > 0;
          membershipCache.set(key, { valid, expiresAt: Date.now() + MEMBERSHIP_CACHE_TTL_MS });
        }
        if (valid) {
          socket.join(`channel:${channelId}`);
          if (!joinedChannels().includes(channelId)) joinedChannels().push(channelId);
        }
        if (typeof ack === 'function') ack({ ok: valid });
      } catch {
        logger.warn('socket chat:join membership check failed');
        if (typeof ack === 'function') ack({ ok: false });
      }
    });

    socket.on('chat:leave', (channelId: string) => {
      if (!user?.userId || typeof channelId !== 'string') return;
      recordSocketEvent('chat:leave');
      socket.leave(`channel:${channelId}`);
      const list = joinedChannels();
      const idx = list.indexOf(channelId);
      if (idx !== -1) list.splice(idx, 1);
      // Clear any lingering typing indicator when leaving.
      socket.to(`channel:${channelId}`).emit('chat:typing', { channelId, userId: user.userId, isTyping: false });
    });

    socket.on('chat:typing', (data: { channelId: string; isTyping: boolean }) => {
      if (!user?.userId || !data || typeof data.channelId !== 'string') return;
      recordSocketEvent('chat:typing');
      // Only members who validated their join may broadcast typing.
      if (!socket.rooms.has(`channel:${data.channelId}`)) return;
      socket.to(`channel:${data.channelId}`).emit('chat:typing', {
        channelId: data.channelId,
        userId: user.userId,
        isTyping: !!data.isTyping,
      });
    });

    socket.on('error', (err) => {
      logger.warn({ err: (err as Error)?.message }, 'Socket error');
      recordSocketError('socket_error');
    });

    socket.on('disconnect', (reason) => {
      recordSocketDisconnection(reason);
      setSocketActiveConnections(io?.engine.clientsCount ?? 0);

      const userSock = userSockets.get(user.userId);
      const entry = userSock?.get(socket.id);
      if (entry && entry.socket === socket) {
        userSock!.delete(socket.id);
        // Only broadcast offline on the 1→0 transition.
        if (userSock!.size === 0) {
          userSockets.delete(user.userId);
          onlineUsers.delete(user.userId);
          socket.broadcast.emit('user:offline', { userId: user.userId });
        }
      }
      setSocketOnlineUsers(userSockets.size);

      // Clear typing indicators for every channel this socket had joined.
      for (const channelId of joinedChannels()) {
        socket.to(`channel:${channelId}`).emit('chat:typing', { channelId, userId: user.userId, isTyping: false });
      }
      socket.data.joinedChannels = [];
    });
  });

  io.engine.on('connection_error', (err) => {
    logger.warn(
      {
        err: err.message,
        code: err.code,
        context: err.context,
        origin: (err as any).req?.headers?.origin,
        url: (err as any).req?.url,
      },
      'Socket connection error'
    );
    recordSocketError('engine_connection_error');
  });

  logger.info('Socket.io initialized');
  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

/**
 * No-op emitter used when Socket.IO is not initialized (e.g. startup race,
 * the socket server refused to start, or the worker is running in a context
 * that never called initSocketServer — e.g. integration tests). Anything
 * emitted to this stub is silently dropped, so callers can treat the return
 * value as Server-shaped without guarding every emit() call.
 */
export const NOOP_SOCKET = {
  to: () => ({ emit: () => {}, emitAsync: async () => {} }),
  sockets: { sockets: { values: () => [] as never[] } },
};

/**
 * Returns the active Socket.IO server, or a no-op stub if it isn't initialized.
 * Use this in any code path that emits real-time events but where the request
 * should still succeed if the socket layer is unavailable — the realtime
 * delivery is best-effort, not part of the API contract.
 */
export function safeIo() {
  try {
    return getIO();
  } catch {
    return NOOP_SOCKET;
  }
}

export function getOnlineUsers(): Set<string> {
  return onlineUsers;
}

/** Drop all sockets and close the server. Called during graceful shutdown. */
export async function closeSocketServer(): Promise<void> {
  if (!io) return;
  io.disconnectSockets(true);
  await new Promise<void>((resolve) => io!.close(() => resolve()));
  io = null;
  if (adapterRedisClient) {
    await adapterRedisClient.quit();
    adapterRedisClient = null;
  }
  logger.info('Socket.IO closed');
}

/** Invalidate cached auth/membership for a user (e.g. after a role or permission change). */
export function invalidateUserCaches(userId: string): void {
  authCache.delete(userId);
  for (const key of membershipCache.keys()) {
    if (key.startsWith(`${userId}:`)) membershipCache.delete(key);
  }
}

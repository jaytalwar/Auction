import type { Server as HttpServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { verifyAuthToken } from './auth';
import { auctionsService } from './auctions.service';
import { auctionEvents } from './events';
import { getRedisUrl } from './redis';
import type { Notification } from '@prisma/client';

interface SocketData {
  userId?: string;
}

function auctionRoom(auctionId: string): string {
  return `auction:${auctionId}`;
}

function userRoom(userId: string): string {
  return `user:${userId}`;
}

/**
 * Real-time layer over the same `auctionsService` used by the REST API — a
 * bid placed here goes through the exact same mechanism validation and
 * wallet escrow as a bid placed over HTTP. Broadcasting is driven by the
 * `auction.*` events `auctionsService` emits (via the shared event
 * emitter), not by calling into this file directly, so REST-originated
 * bids/closes (e.g. the scheduler auto-closing an expired auction) also
 * reach connected clients.
 *
 * Backed by Redis pub/sub (`@socket.io/redis-adapter`) so room broadcasting
 * works across multiple server instances, not just in-memory within one
 * process — a bid accepted by instance A still reaches a bidder connected
 * to instance B.
 */
export async function createSocketServer(httpServer: HttpServer): Promise<Server> {
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    path: '/socket.io',
  });

  const pubClient = new Redis(getRedisUrl());
  const subClient = pubClient.duplicate();
  // Backs Socket.io's room broadcasting with Redis pub/sub for the whole
  // server (all namespaces), not just in-memory within one process.
  io.adapter(createAdapter(pubClient, subClient));

  const namespace = io.of('/auctions');

  namespace.on('connection', (socket: Socket) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      const payload = verifyAuthToken(token);
      if (!payload) {
        socket.emit('auction:error', { message: 'Invalid or expired token' });
        socket.disconnect(true);
        return;
      }
      (socket.data as SocketData).userId = payload.sub;
      // Personal room for this user's own notifications (outbid/won/lost/sold).
      socket.join(userRoom(payload.sub));
    }
    // Anonymous connections are allowed (to watch live bidding); a bad token is not.

    socket.on('auction:join', (data: { auctionId: string }, ack?: (res: unknown) => void) => {
      socket.join(auctionRoom(data.auctionId));
      ack?.({ auctionId: data.auctionId, joined: true });
    });

    socket.on('auction:leave', (data: { auctionId: string }, ack?: (res: unknown) => void) => {
      socket.leave(auctionRoom(data.auctionId));
      ack?.({ auctionId: data.auctionId, left: true });
    });

    socket.on(
      'auction:bid',
      async (data: { auctionId: string; amount: number }, ack?: (res: unknown) => void) => {
        const userId = (socket.data as SocketData).userId;
        if (!userId) {
          ack?.({ accepted: false, reason: 'Authentication required to bid' });
          return;
        }
        if (!Number.isInteger(data.amount) || data.amount <= 0) {
          ack?.({ accepted: false, reason: 'Bid amount must be a positive integer' });
          return;
        }

        try {
          const bid = await auctionsService.placeBid(data.auctionId, userId, { amount: data.amount });
          ack?.({ accepted: true, bid });
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'Bid rejected';
          ack?.({ accepted: false, reason });
        }
      },
    );
  });

  auctionEvents.on('auction.bid.placed', (payload) => {
    namespace.to(auctionRoom(payload.auctionId)).emit('auction:bid-placed', payload);
  });

  auctionEvents.on('auction.extended', (payload) => {
    namespace.to(auctionRoom(payload.auctionId)).emit('auction:extended', payload);
  });

  auctionEvents.on('auction.closed', (payload) => {
    namespace.to(auctionRoom(payload.auction.id)).emit('auction:closed', payload);
  });

  auctionEvents.on('notification.created', (notification: Notification) => {
    namespace.to(userRoom(notification.userId)).emit('notification:new', notification);
  });

  return io;
}

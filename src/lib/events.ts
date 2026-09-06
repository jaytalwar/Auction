import { EventEmitter } from 'node:events';
import type { Auction, Bid, Notification } from '@prisma/client';

export interface BidPlacedEvent {
  auctionId: string;
  bid: Bid;
  auction: Auction;
}

export interface AuctionExtendedEvent {
  auctionId: string;
  closesAt: Date;
}

export interface AuctionClosedEvent {
  auction: Auction;
  /** Bids as they stood at settlement time — lets listeners know winner/losers without another query. */
  bids: Bid[];
}

export interface BidOutbidEvent {
  auctionId: string;
  auctionTitle: string;
  bidderId: string;
  amount: number;
}

interface AuctionEvents {
  'auction.bid.placed': [BidPlacedEvent];
  'auction.extended': [AuctionExtendedEvent];
  'auction.closed': [AuctionClosedEvent];
  'auction.bid.outbid': [BidOutbidEvent];
  'notification.created': [Notification];
}

/**
 * Decouples the domain services (auctions, notifications) from the
 * transport layer (the Socket.io gateway) — mirrors what NestJS's
 * EventEmitter2 did in the original backend. A bid placed over REST and a
 * bid placed over WebSocket both flow through the same
 * `auctions.service.ts` code path and emit the same events here, so
 * `socket-server.ts` doesn't need to know or care which transport a given
 * bid came in on.
 *
 * Stashed on globalThis so Next.js's dev-mode module reloading doesn't
 * spawn a second emitter that the socket server isn't listening on.
 */
class TypedEventEmitter extends EventEmitter {
  emit<K extends keyof AuctionEvents>(event: K, ...args: AuctionEvents[K]): boolean {
    return super.emit(event, ...args);
  }

  on<K extends keyof AuctionEvents>(event: K, listener: (...args: AuctionEvents[K]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }
}

const globalForEvents = globalThis as unknown as { auctionEvents?: TypedEventEmitter };

export const auctionEvents = globalForEvents.auctionEvents ?? new TypedEventEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalForEvents.auctionEvents = auctionEvents;
}

auctionEvents.setMaxListeners(50);

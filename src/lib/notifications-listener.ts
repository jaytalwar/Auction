import { NotificationType } from '@prisma/client';
import { notificationsService } from './notifications.service';
import { auctionEvents, AuctionClosedEvent, BidOutbidEvent } from './events';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Turns the same domain events the socket server broadcasts over WebSocket
 * into persisted, per-user notifications. Decoupled from auctions.service.ts
 * via the shared event emitter for the same reason the socket server is —
 * this listener doesn't need to know whether a bid came in over REST or
 * WebSocket. Registered once from server.ts at boot.
 */
export function registerNotificationsListener() {
  auctionEvents.on('auction.bid.outbid', async (payload: BidOutbidEvent) => {
    await notificationsService.create(
      payload.bidderId,
      NotificationType.OUTBID,
      `You've been outbid on "${payload.auctionTitle}" (previous bid: ${formatCents(payload.amount)}).`,
      payload.auctionId,
    );
  });

  auctionEvents.on('auction.closed', async ({ auction, bids }: AuctionClosedEvent) => {
    if (!auction.winnerId || auction.clearingPrice === null) {
      await notificationsService.create(
        auction.sellerId,
        NotificationType.AUCTION_UNSOLD,
        `Your auction "${auction.title}" closed with no winner.`,
        auction.id,
      );
      return;
    }

    const price = formatCents(auction.clearingPrice);

    await notificationsService.create(
      auction.winnerId,
      NotificationType.AUCTION_WON,
      `You won "${auction.title}" for ${price}.`,
      auction.id,
    );

    await notificationsService.create(
      auction.sellerId,
      NotificationType.AUCTION_SOLD,
      `Your auction "${auction.title}" sold for ${price}.`,
      auction.id,
    );

    const losers = bids.filter((bid) => bid.bidderId !== auction.winnerId);
    for (const bid of losers) {
      await notificationsService.create(
        bid.bidderId,
        NotificationType.AUCTION_LOST,
        `You lost "${auction.title}" — it sold for ${price}.`,
        auction.id,
      );
    }
  });
}

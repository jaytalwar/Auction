import { Auction, AuctionMechanismType, AuctionStatus, Bid, BidStatus } from '@prisma/client';
import { prisma } from './prisma';
import { walletService } from './wallet.service';
import { auctionEvents, BidOutbidEvent } from './events';
import { AuctionMechanismFactory } from './domain/auctions/mechanisms/auction-mechanism.factory';
import { AuctionContext, Bid as DomainBid } from './domain/auctions/types';
import { toDomainBid, toDomainMechanismType } from './mechanism-mapping';
import { ANTI_SNIPE_EXTENSION_MS, ANTI_SNIPE_WINDOW_MS } from './anti-snipe.constants';
import { BadRequestError, ForbiddenError, NotFoundError } from './errors';
import type { CreateAuctionInput, PlaceBidInput } from './validation';
import { BID_JOB_TIMEOUT_MS, CLOSE_AUCTION_JOB, PLACE_BID_JOB } from './queue/queue.constants';
import { bidQueue, bidQueueEvents, closingQueue } from './queue/queues';

export interface PlaceBidJobData {
  auctionId: string;
  bidderId: string;
  amount: number;
}

export interface CloseAuctionJobData {
  auctionId: string;
}

async function create(sellerId: string, dto: CreateAuctionInput): Promise<Auction> {
  const closesAt = new Date(dto.closesAt);
  if (Number.isNaN(closesAt.getTime()) || closesAt.getTime() <= Date.now()) {
    throw new BadRequestError('closesAt must be a valid date in the future');
  }

  const auction = await prisma.auction.create({
    data: {
      title: dto.title,
      description: dto.description,
      mechanism: dto.mechanism,
      reservePrice: dto.reservePrice,
      minIncrement: dto.minIncrement,
      startPrice: dto.startPrice,
      closesAt,
      sellerId,
    },
  });

  await scheduleClose(auction.id, closesAt);

  return auction;
}

function findAll() {
  return prisma.auction.findMany({ orderBy: { createdAt: 'desc' } });
}

async function findOne(id: string) {
  const auction = await prisma.auction.findUnique({
    where: { id },
    include: { bids: { orderBy: { createdAt: 'asc' } } },
  });
  if (!auction) throw new NotFoundError('Auction not found');
  return auction;
}

/**
 * Preflight checks (existence, open, not expired, not the seller) run
 * synchronously here so a bad request comes back immediately without
 * touching the queue. The actual mechanism validation and wallet/DB writes
 * happen inside `executeBidJob`, run by a worker with concurrency 1 — that's
 * what actually prevents two concurrent bids on the same auction from both
 * reading the same "current highest" and both winning.
 */
async function placeBid(auctionId: string, bidderId: string, dto: PlaceBidInput): Promise<Bid> {
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw new NotFoundError('Auction not found');
  if (auction.status !== AuctionStatus.OPEN) {
    throw new BadRequestError('Auction is not open for bidding');
  }
  if (auction.closesAt.getTime() <= Date.now()) {
    throw new BadRequestError('Bidding has ended on this auction');
  }
  if (auction.sellerId === bidderId) {
    throw new BadRequestError('Sellers cannot bid on their own auction');
  }

  const job = await bidQueue.add(PLACE_BID_JOB, { auctionId, bidderId, amount: dto.amount });

  try {
    return (await job.waitUntilFinished(bidQueueEvents, BID_JOB_TIMEOUT_MS)) as Bid;
  } catch (err) {
    throw new BadRequestError(err instanceof Error ? err.message : 'Bid rejected');
  }
}

/**
 * Runs inside the bid-processing worker — see queue/workers.ts. Throws a
 * plain Error on any validation or wallet failure, since exceptions don't
 * survive the Redis round-trip back to the caller with their class intact;
 * `placeBid()` above turns the message into the right response for
 * whichever transport (REST or WebSocket) is waiting on it.
 */
async function executeBidJob(data: PlaceBidJobData): Promise<Bid> {
  const { auctionId, bidderId, amount } = data;

  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { bids: true },
  });
  if (!auction) throw new Error('Auction not found');
  if (auction.status !== AuctionStatus.OPEN) throw new Error('Auction is not open for bidding');
  if (auction.closesAt.getTime() <= Date.now()) throw new Error('Bidding has ended on this auction');

  const mechanism = AuctionMechanismFactory.create(toDomainMechanismType(auction.mechanism));
  const existingBids: DomainBid[] = auction.bids.map(toDomainBid);
  const incoming: DomainBid = { bidderId, amount, timestamp: Date.now() };

  const ctx: AuctionContext = {
    reservePrice: auction.reservePrice,
    minIncrement: auction.minIncrement ?? undefined,
    startPrice: auction.startPrice ?? undefined,
    // Dutch auctions don't yet have a live descending clock (that needs a
    // ticking price feed pushed to clients) — for now the "clock price" is
    // simply the starting price, so a Dutch auction can be accepted at
    // exactly its asking price.
    currentClockPrice: auction.startPrice ?? undefined,
  };

  const validation = mechanism.validateBid(existingBids, incoming, ctx);
  if (!validation.valid) {
    throw new Error(validation.reason ?? 'Bid rejected');
  }

  // English auctions: the bidder being outbid gets their escrow released immediately.
  if (auction.mechanism === AuctionMechanismType.ENGLISH && existingBids.length > 0) {
    const previousHighest = existingBids.reduce((max, b) => (b.amount > max.amount ? b : max));
    await walletService.releaseFunds(previousHighest.bidderId, previousHighest.amount);
    await prisma.bid.updateMany({
      where: { auctionId, bidderId: previousHighest.bidderId, status: BidStatus.ACTIVE },
      data: { status: BidStatus.OUTBID },
    });
    auctionEvents.emit('auction.bid.outbid', {
      auctionId,
      auctionTitle: auction.title,
      bidderId: previousHighest.bidderId,
      amount: previousHighest.amount,
    } satisfies BidOutbidEvent);
  }

  await walletService.holdFunds(bidderId, amount);

  const bid = await prisma.bid.create({
    data: { auctionId, bidderId, amount, heldAmount: amount },
  });

  let updatedAuction: Auction = auction;

  // Anti-sniping: a bid landing inside the closing window pushes the
  // deadline back, so nobody can win purely by bidding in the last instant.
  // Doesn't apply to Dutch — the first accepted bid ends it immediately anyway.
  if (auction.mechanism !== AuctionMechanismType.DUTCH) {
    const remainingMs = auction.closesAt.getTime() - Date.now();
    if (remainingMs <= ANTI_SNIPE_WINDOW_MS) {
      const newClosesAt = new Date(Date.now() + ANTI_SNIPE_EXTENSION_MS);
      updatedAuction = await prisma.auction.update({
        where: { id: auctionId },
        data: { closesAt: newClosesAt },
      });
      await scheduleClose(auctionId, newClosesAt);
      auctionEvents.emit('auction.extended', { auctionId, closesAt: newClosesAt });
    }
  }

  auctionEvents.emit('auction.bid.placed', { auctionId, bid, auction: updatedAuction });

  // Dutch auctions: the first accepted bid closes the auction immediately.
  if (auction.mechanism === AuctionMechanismType.DUTCH) {
    await settleAuction(auctionId);
  }

  return bid;
}

async function close(auctionId: string, requesterId: string): Promise<Auction> {
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw new NotFoundError('Auction not found');
  if (auction.sellerId !== requesterId) {
    throw new ForbiddenError('Only the seller can close this auction');
  }
  if (auction.status !== AuctionStatus.OPEN) {
    throw new BadRequestError('Auction is already closed');
  }

  return settleAuction(auctionId);
}

/** Run by the delayed close-auction job (see queue/workers.ts). No-ops if already closed. */
async function closeIfStillOpen(auctionId: string): Promise<Auction | null> {
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction || auction.status !== AuctionStatus.OPEN) return null;
  return settleAuction(auctionId);
}

/**
 * Safety net, not the primary close mechanism — that's the delayed
 * per-auction job scheduled in `scheduleClose`. This just catches anything
 * that job missed (e.g. a Redis restart that lost delayed jobs). Polled by
 * scheduler.ts.
 */
async function closeExpiredAuctions(): Promise<Auction[]> {
  const expired = await prisma.auction.findMany({
    where: { status: AuctionStatus.OPEN, closesAt: { lte: new Date() } },
    select: { id: true },
  });

  const closed: Auction[] = [];
  for (const { id } of expired) {
    const result = await closeIfStillOpen(id);
    if (result) closed.push(result);
  }
  return closed;
}

/** (Re)schedules the delayed job that closes this auction at exactly closesAt. */
async function scheduleClose(auctionId: string, closesAt: Date): Promise<void> {
  await closingQueue.remove(auctionId).catch(() => undefined);
  const delay = Math.max(0, closesAt.getTime() - Date.now());
  await closingQueue.add(CLOSE_AUCTION_JOB, { auctionId }, { jobId: auctionId, delay });
}

/** Resolves the mechanism, settles every bidder's escrow, and pays the seller. */
async function settleAuction(auctionId: string): Promise<Auction> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { bids: true },
  });
  if (!auction) throw new NotFoundError('Auction not found');

  const mechanism = AuctionMechanismFactory.create(toDomainMechanismType(auction.mechanism));
  const ctx: AuctionContext = {
    reservePrice: auction.reservePrice,
    minIncrement: auction.minIncrement ?? undefined,
    startPrice: auction.startPrice ?? undefined,
  };
  const result = mechanism.resolve(auction.bids.map(toDomainBid), ctx);

  const activeBids = auction.bids.filter((b) => b.status === BidStatus.ACTIVE);
  for (const bid of activeBids) {
    if (bid.bidderId === result.winnerId) {
      await walletService.captureFunds(bid.bidderId, bid.heldAmount, result.clearingPrice);
      await prisma.bid.update({ where: { id: bid.id }, data: { status: BidStatus.WON } });
    } else {
      await walletService.releaseFunds(bid.bidderId, bid.heldAmount);
      await prisma.bid.update({ where: { id: bid.id }, data: { status: BidStatus.LOST } });
    }
  }

  if (result.winnerId) {
    await walletService.creditFunds(auction.sellerId, result.clearingPrice);
  }

  const closedAuction = await prisma.auction.update({
    where: { id: auctionId },
    data: {
      status: AuctionStatus.CLOSED,
      winnerId: result.winnerId,
      clearingPrice: result.winnerId ? result.clearingPrice : null,
      closedAt: new Date(),
    },
  });

  auctionEvents.emit('auction.closed', { auction: closedAuction, bids: activeBids });

  return closedAuction;
}

export const auctionsService = {
  create,
  findAll,
  findOne,
  placeBid,
  executeBidJob,
  close,
  closeIfStillOpen,
  closeExpiredAuctions,
};

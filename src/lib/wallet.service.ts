import { prisma } from './prisma';
import { BadRequestError, NotFoundError } from './errors';

/** New users start with this much fake balance (in cents) so they can bid right away. */
const STARTING_BALANCE_CENTS = 100_000;

export const walletService = {
  createForUser(userId: string) {
    return prisma.wallet.create({
      data: { userId, balance: STARTING_BALANCE_CENTS },
    });
  },

  async getByUserId(userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundError('Wallet not found');
    return wallet;
  },

  /**
   * Move funds from available balance into escrow for a pending bid.
   * Uses a single conditional UPDATE so concurrent bids can't both pass a
   * balance check and then both deduct — the WHERE clause re-checks the
   * balance atomically at the database level.
   */
  async holdFunds(userId: string, amountCents: number): Promise<void> {
    const result = await prisma.wallet.updateMany({
      where: { userId, balance: { gte: amountCents } },
      data: {
        balance: { decrement: amountCents },
        heldAmount: { increment: amountCents },
      },
    });

    if (result.count === 0) {
      throw new BadRequestError('Insufficient funds to place this bid');
    }
  },

  /** Return held funds to the available balance (e.g. bid was outbid or auction cancelled). */
  async releaseFunds(userId: string, amountCents: number): Promise<void> {
    await prisma.wallet.update({
      where: { userId },
      data: {
        balance: { increment: amountCents },
        heldAmount: { decrement: amountCents },
      },
    });
  },

  /**
   * Settle a winning bidder's escrow: the held amount is released, but only
   * the actual clearing price is captured (e.g. under Vickrey the winner
   * held their own bid but only owes the second-highest bid — the
   * difference is refunded back to their available balance).
   */
  async captureFunds(userId: string, heldAmountCents: number, actualPriceCents: number): Promise<void> {
    const refund = heldAmountCents - actualPriceCents;
    await prisma.wallet.update({
      where: { userId },
      data: {
        heldAmount: { decrement: heldAmountCents },
        balance: { increment: refund },
      },
    });
  },

  /** Pay auction proceeds to the seller. */
  async creditFunds(userId: string, amountCents: number): Promise<void> {
    await prisma.wallet.update({
      where: { userId },
      data: { balance: { increment: amountCents } },
    });
  },
};

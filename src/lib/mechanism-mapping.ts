import { AuctionMechanismType as PrismaMechanismType, Bid as PrismaBid } from '@prisma/client';
import { AuctionMechanismType as DomainMechanismType, Bid as DomainBid } from './domain/auctions/types';

const PRISMA_TO_DOMAIN: Record<PrismaMechanismType, DomainMechanismType> = {
  ENGLISH: 'english',
  DUTCH: 'dutch',
  SEALED_FIRST_PRICE: 'sealed-first-price',
  VICKREY: 'vickrey',
};

export function toDomainMechanismType(mechanism: PrismaMechanismType): DomainMechanismType {
  return PRISMA_TO_DOMAIN[mechanism];
}

export function toDomainBid(bid: PrismaBid): DomainBid {
  return { bidderId: bid.bidderId, amount: bid.amount, timestamp: bid.createdAt.getTime() };
}

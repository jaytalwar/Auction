import { AuctionMechanism, AuctionMechanismType } from '../types';
import { EnglishAuctionMechanism } from './english-auction.mechanism';
import { DutchAuctionMechanism } from './dutch-auction.mechanism';
import { SealedFirstPriceMechanism } from './sealed-first-price.mechanism';
import { VickreyMechanism } from './vickrey.mechanism';

const registry: Record<AuctionMechanismType, () => AuctionMechanism> = {
  english: () => new EnglishAuctionMechanism(),
  dutch: () => new DutchAuctionMechanism(),
  'sealed-first-price': () => new SealedFirstPriceMechanism(),
  vickrey: () => new VickreyMechanism(),
};

export class AuctionMechanismFactory {
  static create(type: AuctionMechanismType): AuctionMechanism {
    const factory = registry[type];
    if (!factory) {
      throw new Error(`Unknown auction mechanism type: ${type}`);
    }
    return factory();
  }
}

export type AuctionMechanism = 'ENGLISH' | 'DUTCH' | 'SEALED_FIRST_PRICE' | 'VICKREY';
export type AuctionStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export type BidStatus = 'ACTIVE' | 'OUTBID' | 'WON' | 'LOST' | 'REFUNDED';
export type NotificationType = 'OUTBID' | 'AUCTION_WON' | 'AUCTION_LOST' | 'AUCTION_SOLD' | 'AUCTION_UNSOLD';

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  heldAmount: number;
  updatedAt: string;
}

export interface Bid {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: number;
  heldAmount: number;
  status: BidStatus;
  createdAt: string;
}

export interface Auction {
  id: string;
  title: string;
  description: string | null;
  mechanism: AuctionMechanism;
  status: AuctionStatus;
  reservePrice: number;
  minIncrement: number | null;
  startPrice: number | null;
  sellerId: string;
  winnerId: string | null;
  clearingPrice: number | null;
  createdAt: string;
  closesAt: string;
  closedAt: string | null;
  bids?: Bid[];
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  auctionId: string | null;
  read: boolean;
  createdAt: string;
}

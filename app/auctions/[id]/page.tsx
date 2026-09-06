'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { api, ApiError } from '@/lib/client/api';
import { getSocket } from '@/lib/client/socket';
import { useAuth } from '@/context/AuthContext';
import { MechanismBadge } from '@/components/MechanismBadge';
import { Countdown } from '@/components/Countdown';
import { formatCents, formatRelativeTime } from '@/lib/client/format';
import type { Auction, Bid } from '@/lib/client/types';

const SEALED = new Set(['SEALED_FIRST_PRICE', 'VICKREY']);

export default function AuctionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { user, refreshWallet } = useAuth();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);
  const [flashBidId, setFlashBidId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidError, setBidError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [closing, setClosing] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get<Auction>(`/auctions/${id}`)
      .then(setAuction)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const existing = getSocket();
    const socket = existing ?? io('/auctions', { transports: ['websocket'] });
    const ownsSocket = !existing;
    socketRef.current = socket;

    function join() {
      socket.emit('auction:join', { auctionId: id });
    }
    if (socket.connected) join();
    socket.on('connect', join);

    function onBidPlaced(payload: { auctionId: string; bid: Bid; auction: Auction }) {
      if (payload.auctionId !== id) return;
      setAuction((prev) => (prev ? { ...payload.auction, bids: mergeBid(prev.bids, payload.bid) } : prev));
      setFlashBidId(payload.bid.id);
      refreshWallet();
    }
    function onExtended(payload: { auctionId: string; closesAt: string }) {
      if (payload.auctionId !== id) return;
      setAuction((prev) => (prev ? { ...prev, closesAt: payload.closesAt } : prev));
    }
    function onClosed(payload: { auction: Auction }) {
      if (payload.auction.id !== id) return;
      setAuction((prev) => (prev ? { ...payload.auction, bids: prev.bids } : payload.auction));
      refreshWallet();
    }

    socket.on('auction:bid-placed', onBidPlaced);
    socket.on('auction:extended', onExtended);
    socket.on('auction:closed', onClosed);

    return () => {
      socket.emit('auction:leave', { auctionId: id });
      socket.off('connect', join);
      socket.off('auction:bid-placed', onBidPlaced);
      socket.off('auction:extended', onExtended);
      socket.off('auction:closed', onClosed);
      if (ownsSocket) socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!flashBidId) return;
    const t = setTimeout(() => setFlashBidId(null), 1200);
    return () => clearTimeout(t);
  }, [flashBidId]);

  const activeBids = useMemo(() => (auction?.bids ?? []).filter((b) => b.status !== 'REFUNDED'), [auction]);
  const highestActive = useMemo(
    () => activeBids.filter((b) => b.status === 'ACTIVE').reduce((max, b) => (b.amount > max ? b.amount : max), 0),
    [activeBids],
  );
  const isSealed = auction ? SEALED.has(auction.mechanism) : false;
  const isSeller = !!user && auction?.sellerId === user.id;
  const myBid = user ? activeBids.find((b) => b.bidderId === user.id) : undefined;
  const isOpen = auction?.status === 'OPEN';

  async function placeBid(amountDollars: string) {
    if (!auction) return;
    const amount = Math.round(parseFloat(amountDollars) * 100);
    if (!Number.isFinite(amount) || amount <= 0) {
      setBidError('Enter a valid amount');
      return;
    }
    setBidError(null);
    setPlacing(true);

    const socket = socketRef.current;
    if (socket && socket.connected) {
      // Guard against the ack never arriving (dropped connection, server
      // restart mid-request) so the button doesn't stay stuck on "Placing…" forever.
      const timeout = setTimeout(() => {
        setPlacing(false);
        setBidError('No response from server — try again');
      }, 8000);

      socket.emit(
        'auction:bid',
        { auctionId: auction.id, amount },
        (ack: { accepted: boolean; bid?: Bid; reason?: string }) => {
          clearTimeout(timeout);
          setPlacing(false);
          if (!ack.accepted) {
            setBidError(ack.reason ?? 'Bid rejected');
          } else {
            setBidAmount('');
            refreshWallet();
          }
        },
      );
    } else {
      try {
        await api.post<Bid>(`/auctions/${auction.id}/bids`, { amount });
        setBidAmount('');
        refreshWallet();
      } catch (err) {
        setBidError(err instanceof ApiError ? err.message : 'Bid rejected');
      } finally {
        setPlacing(false);
      }
    }
  }

  async function closeAuction() {
    if (!auction) return;
    setClosing(true);
    try {
      const updated = await api.post<Auction>(`/auctions/${auction.id}/close`);
      setAuction((prev) => (prev ? { ...updated, bids: prev.bids } : updated));
    } catch (err) {
      setBidError(err instanceof ApiError ? err.message : 'Could not close auction');
    } finally {
      setClosing(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl px-6 py-16 text-center text-gray-500">Loading…</div>;
  }
  if (!auction) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16 text-center text-gray-500">
        Auction not found.{' '}
        <button onClick={() => router.push('/')} className="text-violet-400">
          Go home
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{auction.title}</h1>
            <MechanismBadge mechanism={auction.mechanism} />
          </div>
          {auction.description && <p className="mt-2 max-w-xl text-gray-400">{auction.description}</p>}
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            {isOpen ? 'Closes in' : 'Status'}
          </div>
          {isOpen ? (
            <div className="text-lg">
              <Countdown closesAt={auction.closesAt} />
            </div>
          ) : (
            <div className={`text-lg font-semibold ${auction.winnerId ? 'text-emerald-400' : 'text-gray-400'}`}>
              {auction.winnerId ? 'Sold' : 'Unsold'}
            </div>
          )}
        </div>
      </div>

      {!isOpen && (
        <div
          className={`mt-6 rounded-2xl border p-5 ${
            auction.winnerId ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-white/[0.02]'
          }`}
        >
          {auction.winnerId ? (
            <p className="text-emerald-300">
              🏆 {auction.winnerId === user?.id ? 'You won!' : 'Sold'} for{' '}
              <span className="font-mono font-semibold">{formatCents(auction.clearingPrice ?? 0)}</span>
              {myBid?.status === 'LOST' && ' — better luck next time.'}
            </p>
          ) : (
            <p className="text-gray-400">This auction closed with no winner (reserve not met).</p>
          )}
        </div>
      )}

      {isOpen && isSeller && (
        <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-sm text-gray-400">You&apos;re the seller — you can end this auction early.</p>
          <button onClick={closeAuction} disabled={closing} className="btn-secondary">
            {closing ? 'Closing…' : 'Close now'}
          </button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="md:col-span-3">
          <div className="rounded-2xl border border-white/10 bg-[color:var(--color-surface)] p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                {isSealed ? 'Sealed bids' : 'Bid history'}
              </h2>
              <span className="text-xs text-gray-600">
                {activeBids.length} bid{activeBids.length === 1 ? '' : 's'}
              </span>
            </div>

            <ul className="mt-3 flex flex-col gap-1.5">
              {activeBids.length === 0 && <li className="py-6 text-center text-sm text-gray-600">No bids yet</li>}
              {[...activeBids]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((bid) => {
                  const isMine = bid.bidderId === user?.id;
                  const hideAmount = isSealed && isOpen && !isMine;
                  return (
                    <li
                      key={bid.id}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                        flashBidId === bid.id ? 'animate-flash-bid' : ''
                      } ${bid.status === 'WON' ? 'bg-emerald-500/10' : ''}`}
                    >
                      <span className="text-gray-400">
                        {isMine ? 'You' : `Bidder ${bid.bidderId.slice(0, 6)}`}
                        {bid.status === 'OUTBID' && <span className="ml-2 text-xs text-gray-600">outbid</span>}
                        {bid.status === 'WON' && <span className="ml-2 text-xs text-emerald-400">won</span>}
                      </span>
                      <span className="font-mono">
                        {hideAmount ? <span className="text-gray-600">🔒 hidden</span> : formatCents(bid.amount)}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="sticky top-24 rounded-2xl border border-white/10 bg-[color:var(--color-surface)] p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wide text-gray-500">Reserve</span>
              <span className="font-mono text-sm text-gray-300">{formatCents(auction.reservePrice)}</span>
            </div>
            {auction.mechanism === 'ENGLISH' && (
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wide text-gray-500">Current highest</span>
                <span className="font-mono text-lg font-semibold text-emerald-400">
                  {formatCents(highestActive || auction.reservePrice)}
                </span>
              </div>
            )}
            {auction.mechanism === 'DUTCH' && (
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wide text-gray-500">Accept price</span>
                <span className="font-mono text-lg font-semibold text-emerald-400">
                  {formatCents(auction.startPrice ?? 0)}
                </span>
              </div>
            )}

            <div className="mt-4 border-t border-white/10 pt-4">
              {!user ? (
                <p className="text-sm text-gray-500">
                  <a href="/login" className="text-violet-400 hover:text-violet-300">
                    Log in
                  </a>{' '}
                  to bid.
                </p>
              ) : isSeller ? (
                <p className="text-sm text-gray-500">You can&apos;t bid on your own auction.</p>
              ) : !isOpen ? (
                <p className="text-sm text-gray-500">Bidding has ended.</p>
              ) : myBid && isSealed ? (
                <p className="text-sm text-gray-400">
                  Your sealed bid: <span className="font-mono text-gray-200">{formatCents(myBid.amount)}</span>
                </p>
              ) : auction.mechanism === 'DUTCH' ? (
                <button
                  onClick={() => placeBid(String((auction.startPrice ?? 0) / 100))}
                  disabled={placing}
                  className="btn-primary w-full"
                >
                  {placing ? 'Placing…' : `Accept for ${formatCents(auction.startPrice ?? 0)}`}
                </button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    placeBid(bidAmount);
                  }}
                  className="flex flex-col gap-2"
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      className="input pl-6"
                      placeholder="0.00"
                    />
                  </div>
                  <button type="submit" disabled={placing} className="btn-primary">
                    {placing ? 'Placing…' : 'Place bid'}
                  </button>
                </form>
              )}
              {bidError && <p className="mt-2 text-sm text-red-400">{bidError}</p>}
            </div>

            <p className="mt-4 text-xs text-gray-600">Created {formatRelativeTime(auction.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function mergeBid(bids: Bid[] | undefined, bid: Bid): Bid[] {
  const existing = bids ?? [];
  const rest = existing
    .filter((b) => b.id !== bid.id)
    .map((b) => (b.bidderId === bid.bidderId && b.status === 'ACTIVE' ? { ...b, status: 'OUTBID' as const } : b));
  return [...rest, bid];
}

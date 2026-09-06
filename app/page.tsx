'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/client/api';
import { useAuth } from '@/context/AuthContext';
import { AuctionCard } from '@/components/AuctionCard';
import type { Auction } from '@/lib/client/types';

type Filter = 'OPEN' | 'CLOSED' | 'ALL';

export default function HomePage() {
  const { user } = useAuth();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [filter, setFilter] = useState<Filter>('OPEN');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Auction[]>('/auctions')
      .then(setAuctions)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load auctions'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = auctions.filter((a) => {
    if (filter === 'ALL') return true;
    if (filter === 'OPEN') return a.status === 'OPEN';
    return a.status !== 'OPEN';
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Live auctions</h1>
          <p className="mt-1 text-gray-400">
            English, Dutch, sealed first-price, and Vickrey — pick your mechanism, bid your strategy.
          </p>
        </div>
        {user && (
          <Link href="/create" className="btn-primary w-fit">
            + New auction
          </Link>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        {(['OPEN', 'CLOSED', 'ALL'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              filter === f
                ? 'bg-violet-500/20 text-violet-300 ring-1 ring-inset ring-violet-500/40'
                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
            }`}
          >
            {f === 'OPEN' ? 'Open' : f === 'CLOSED' ? 'Closed' : 'All'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <p className="font-medium">Couldn&apos;t load auctions</p>
          <p className="mt-1 text-red-400/80">{error}</p>
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl border border-white/5 bg-white/[0.02]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-20 text-center text-gray-500">
            No {filter === 'ALL' ? '' : filter.toLowerCase()} auctions yet.
            {user && (
              <>
                {' '}
                <Link href="/create" className="text-violet-400 hover:text-violet-300">
                  Create one
                </Link>
                .
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

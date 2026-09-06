import Link from 'next/link';
import type { Auction } from '@/lib/client/types';
import { MechanismBadge } from './MechanismBadge';
import { Countdown } from './Countdown';
import { formatCents } from '@/lib/client/format';

export function AuctionCard({ auction }: { auction: Auction }) {
  const closed = auction.status !== 'OPEN';

  return (
    <Link
      href={`/auctions/${auction.id}`}
      className="group relative flex flex-col gap-3 rounded-2xl border border-white/5 bg-[color:var(--color-surface)]/80 p-5 shadow-lg shadow-black/20 backdrop-blur transition hover:-translate-y-0.5 hover:border-violet-500/30 hover:shadow-violet-500/10"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-base font-semibold text-white group-hover:text-violet-300">
          {auction.title}
        </h3>
        <MechanismBadge mechanism={auction.mechanism} />
      </div>

      {auction.description && <p className="line-clamp-2 text-sm text-gray-400">{auction.description}</p>}

      <div className="mt-auto flex items-end justify-between pt-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">
            {closed ? 'Closed for' : 'Reserve'}
          </div>
          <div className="font-mono text-lg font-semibold text-emerald-400">
            {formatCents(closed ? (auction.clearingPrice ?? 0) : auction.reservePrice)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            {closed ? 'Status' : 'Closes in'}
          </div>
          {closed ? (
            <span
              className={`text-sm font-medium ${auction.winnerId ? 'text-emerald-400' : 'text-gray-400'}`}
            >
              {auction.winnerId ? 'Sold' : 'Unsold'}
            </span>
          ) : (
            <Countdown closesAt={auction.closesAt} />
          )}
        </div>
      </div>
    </Link>
  );
}

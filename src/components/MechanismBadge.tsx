import type { AuctionMechanism } from '@/lib/client/types';

const STYLES: Record<AuctionMechanism, string> = {
  ENGLISH: 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
  DUTCH: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  SEALED_FIRST_PRICE: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  VICKREY: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
};

const LABELS: Record<AuctionMechanism, string> = {
  ENGLISH: 'English',
  DUTCH: 'Dutch',
  SEALED_FIRST_PRICE: 'Sealed First-Price',
  VICKREY: 'Vickrey',
};

export function MechanismBadge({ mechanism }: { mechanism: AuctionMechanism }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[mechanism]}`}>
      {LABELS[mechanism]}
    </span>
  );
}

'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/client/api';
import { useAuth } from '@/context/AuthContext';
import { Field } from '@/components/Field';
import type { Auction, AuctionMechanism } from '@/lib/client/types';

const MECHANISM_HINTS: Record<AuctionMechanism, string> = {
  ENGLISH: 'Open ascending bidding. Each bid must beat the current highest by at least the minimum increment.',
  DUTCH: 'Price starts high and descends. The first bid to accept the current price wins instantly.',
  SEALED_FIRST_PRICE: 'Hidden bids, one per bidder. Highest bid wins and pays their own bid.',
  VICKREY: 'Hidden bids, one per bidder. Highest bid wins but pays the second-highest bid.',
};

function defaultClosesAt(): string {
  const d = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes out
  d.setSeconds(0, 0);
  // datetime-local wants local time without a timezone suffix
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export default function CreateAuctionPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mechanism, setMechanism] = useState<AuctionMechanism>('ENGLISH');
  const [reservePrice, setReservePrice] = useState('10.00');
  const [minIncrement, setMinIncrement] = useState('1.00');
  const [startPrice, setStartPrice] = useState('50.00');
  const [closesAt, setClosesAt] = useState(defaultClosesAt);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const auction = await api.post<Auction>('/auctions', {
        title,
        description: description || undefined,
        mechanism,
        reservePrice: Math.round(parseFloat(reservePrice) * 100),
        minIncrement: mechanism === 'ENGLISH' ? Math.round(parseFloat(minIncrement) * 100) : undefined,
        startPrice: mechanism === 'DUTCH' ? Math.round(parseFloat(startPrice) * 100) : undefined,
        closesAt: new Date(closesAt).toISOString(),
      });
      router.push(`/auctions/${auction.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !user) return null;

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="text-2xl font-bold text-white">Create an auction</h1>
      <p className="mt-1 text-sm text-gray-400">{MECHANISM_HINTS[mechanism]}</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <Field label="Title">
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Vintage watch" />
        </Field>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input min-h-20 resize-y"
            placeholder="Tell bidders what they're getting…"
          />
        </Field>

        <Field label="Mechanism">
          <select value={mechanism} onChange={(e) => setMechanism(e.target.value as AuctionMechanism)} className="input">
            <option value="ENGLISH">English (ascending)</option>
            <option value="DUTCH">Dutch (descending)</option>
            <option value="SEALED_FIRST_PRICE">Sealed first-price</option>
            <option value="VICKREY">Vickrey (second-price)</option>
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Reserve price ($)">
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={reservePrice}
              onChange={(e) => setReservePrice(e.target.value)}
              className="input"
            />
          </Field>

          {mechanism === 'ENGLISH' && (
            <Field label="Min increment ($)">
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={minIncrement}
                onChange={(e) => setMinIncrement(e.target.value)}
                className="input"
              />
            </Field>
          )}

          {mechanism === 'DUTCH' && (
            <Field label="Starting price ($)">
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={startPrice}
                onChange={(e) => setStartPrice(e.target.value)}
                className="input"
              />
            </Field>
          )}
        </div>

        <Field label="Closes at">
          <input
            type="datetime-local"
            required
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className="input"
          />
        </Field>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button type="submit" disabled={busy} className="btn-primary mt-2">
          {busy ? 'Creating…' : 'Create auction'}
        </button>
      </form>
    </div>
  );
}

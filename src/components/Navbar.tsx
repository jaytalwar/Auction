'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { NotificationsDropdown } from './NotificationsDropdown';
import { formatCents } from '@/lib/client/format';

export function Navbar() {
  const { user, wallet, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-10 border-b border-white/5 bg-[color:var(--color-bg)]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-sm shadow-lg shadow-violet-500/30">
            ⚡
          </span>
          Mechanism
        </Link>

        {user ? (
          <div className="flex items-center gap-4">
            <Link
              href="/create"
              className="hidden rounded-lg bg-white/5 px-3 py-1.5 text-sm font-medium text-gray-200 transition hover:bg-white/10 sm:block"
            >
              + New auction
            </Link>

            <div className="hidden items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-1.5 sm:flex">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-gray-500">Balance</div>
                <div className="font-mono text-sm font-semibold text-emerald-400">
                  {wallet ? formatCents(wallet.balance) : '—'}
                </div>
              </div>
              {wallet && wallet.heldAmount > 0 && (
                <div className="border-l border-white/10 pl-3 text-right">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">Held</div>
                  <div className="font-mono text-sm font-semibold text-amber-400">
                    {formatCents(wallet.heldAmount)}
                  </div>
                </div>
              )}
            </div>

            <NotificationsDropdown />

            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-gray-400 md:block">{user.displayName}</span>
              <button
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
                className="rounded-lg px-2.5 py-1.5 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white"
              >
                Log out
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm text-gray-300 hover:text-white">
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-lg shadow-violet-500/20 transition hover:opacity-90"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client/api';
import { getSocket } from '@/lib/client/socket';
import { formatRelativeTime } from '@/lib/client/format';
import type { Notification } from '@/lib/client/types';

const ICONS: Record<Notification['type'], string> = {
  OUTBID: '⚡',
  AUCTION_WON: '🏆',
  AUCTION_LOST: '☹️',
  AUCTION_SOLD: '💰',
  AUCTION_UNSOLD: '📭',
};

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<Notification[]>('/notifications').then(setNotifications).catch(() => {});

    const socket = getSocket();
    const handler = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
    };
    socket?.on('notification:new', handler);
    return () => {
      socket?.off('notification:new', handler);
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    api.post(`/notifications/${id}/read`).catch(() => {});
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 text-gray-300 transition hover:bg-white/5 hover:text-white"
        aria-label="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white ring-2 ring-[color:var(--color-bg)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-white/10 bg-[color:var(--color-surface-2)] shadow-2xl shadow-black/40">
          <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">Notifications</div>
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">Nothing yet</div>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`cursor-pointer border-b border-white/5 px-4 py-3 text-sm transition last:border-0 hover:bg-white/5 ${
                    n.read ? 'text-gray-400' : 'text-gray-100'
                  }`}
                >
                  <div className="flex gap-2">
                    <span>{ICONS[n.type]}</span>
                    <div className="flex-1">
                      <p>{n.message}</p>
                      <p className="mt-1 text-xs text-gray-500">{formatRelativeTime(n.createdAt)}</p>
                    </div>
                    {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-400" />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  );
}

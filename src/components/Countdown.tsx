'use client';

import { useEffect, useState } from 'react';
import { formatCountdown } from '@/lib/client/format';

export function Countdown({ closesAt, ended }: { closesAt: string; ended?: boolean }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (ended) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [ended]);

  if (ended) {
    return <span className="font-mono text-sm text-gray-500">closed</span>;
  }

  const remainingMs = new Date(closesAt).getTime() - Date.now();
  const urgent = remainingMs > 0 && remainingMs <= 30_000;
  const over = remainingMs <= 0;

  return (
    <span
      className={`font-mono text-sm tabular-nums ${
        over ? 'text-gray-500' : urgent ? 'animate-pulse text-red-400' : 'text-gray-300'
      }`}
    >
      {over ? 'ending…' : formatCountdown(closesAt)}
    </span>
  );
}

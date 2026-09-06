export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function formatMechanism(mechanism: string): string {
  switch (mechanism) {
    case 'ENGLISH':
      return 'English (ascending)';
    case 'DUTCH':
      return 'Dutch (descending)';
    case 'SEALED_FIRST_PRICE':
      return 'Sealed first-price';
    case 'VICKREY':
      return 'Vickrey (second-price)';
    default:
      return mechanism;
  }
}

export function formatRelativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const seconds = Math.round(abs / 1000);
  if (seconds < 60) return diffMs < 0 ? `${seconds}s ago` : `in ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return diffMs < 0 ? `${minutes}m ago` : `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return diffMs < 0 ? `${hours}h ago` : `in ${hours}h`;
  const days = Math.round(hours / 24);
  return diffMs < 0 ? `${days}d ago` : `in ${days}d`;
}

/** mm:ss or hh:mm:ss countdown string; "00:00" once passed. */
export function formatCountdown(closesAtIso: string): string {
  const remainingMs = Math.max(0, new Date(closesAtIso).getTime() - Date.now());
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

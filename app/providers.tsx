'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { Navbar } from '@/components/Navbar';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen">
        <Navbar />
        {children}
      </div>
    </AuthProvider>
  );
}

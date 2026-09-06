import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { walletService } from '@/lib/wallet.service';
import { withErrorHandling } from '@/lib/api-helpers';

export const GET = withErrorHandling(async (req) => {
  const user = requireUser(req);
  const wallet = await walletService.getByUserId(user.sub);
  return NextResponse.json(wallet);
});

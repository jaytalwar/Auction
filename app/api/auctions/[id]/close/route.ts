import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { auctionsService } from '@/lib/auctions.service';
import { withErrorHandling } from '@/lib/api-helpers';

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const user = requireUser(req);
  const auction = await auctionsService.close(id, user.sub);
  return NextResponse.json(auction);
});

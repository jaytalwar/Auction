import { NextResponse } from 'next/server';
import { auctionsService } from '@/lib/auctions.service';
import { withErrorHandling } from '@/lib/api-helpers';

export const GET = withErrorHandling(async (_req, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const auction = await auctionsService.findOne(id);
  return NextResponse.json(auction);
});

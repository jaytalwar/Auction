import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { auctionsService } from '@/lib/auctions.service';
import { createAuctionSchema } from '@/lib/validation';
import { parseBody, withErrorHandling } from '@/lib/api-helpers';

export const GET = withErrorHandling(async () => {
  const auctions = await auctionsService.findAll();
  return NextResponse.json(auctions);
});

export const POST = withErrorHandling(async (req) => {
  const user = requireUser(req);
  const dto = await parseBody(req, createAuctionSchema);
  const auction = await auctionsService.create(user.sub, dto);
  return NextResponse.json(auction);
});

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { auctionsService } from '@/lib/auctions.service';
import { placeBidSchema } from '@/lib/validation';
import { parseBody, withErrorHandling } from '@/lib/api-helpers';

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const user = requireUser(req);
  const dto = await parseBody(req, placeBidSchema);
  const bid = await auctionsService.placeBid(id, user.sub, dto);
  return NextResponse.json(bid);
});

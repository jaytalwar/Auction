import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { notificationsService } from '@/lib/notifications.service';
import { NotFoundError } from '@/lib/errors';
import { withErrorHandling } from '@/lib/api-helpers';

export const POST = withErrorHandling(async (req, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const user = requireUser(req);
  try {
    await notificationsService.markRead(id, user.sub);
  } catch {
    throw new NotFoundError('Notification not found');
  }
  return NextResponse.json({ ok: true });
});

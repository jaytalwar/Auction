import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { notificationsService } from '@/lib/notifications.service';
import { withErrorHandling } from '@/lib/api-helpers';

export const GET = withErrorHandling(async (req) => {
  const user = requireUser(req);
  const notifications = await notificationsService.findForUser(user.sub);
  return NextResponse.json(notifications);
});

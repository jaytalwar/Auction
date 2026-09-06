import { NotificationType } from '@prisma/client';
import { prisma } from './prisma';
import { auctionEvents } from './events';

export const notificationsService = {
  async create(userId: string, type: NotificationType, message: string, auctionId?: string) {
    const notification = await prisma.notification.create({
      data: { userId, type, message, auctionId },
    });
    // Picked up by socket-server.ts to push over WebSocket to this user only.
    auctionEvents.emit('notification.created', notification);
    return notification;
  },

  findForUser(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async markRead(id: string, userId: string): Promise<void> {
    const result = await prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
    if (result.count === 0) {
      throw new Error('Notification not found');
    }
  },
};

import { NextResponse } from 'next/server';
import { usersService } from '@/lib/users.service';
import { walletService } from '@/lib/wallet.service';
import { hashPassword, signAuthToken } from '@/lib/auth';
import { ConflictError } from '@/lib/errors';
import { registerSchema } from '@/lib/validation';
import { parseBody, withErrorHandling } from '@/lib/api-helpers';

export const POST = withErrorHandling(async (req) => {
  const dto = await parseBody(req, registerSchema);

  const existing = await usersService.findByEmail(dto.email);
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await hashPassword(dto.password);
  const user = await usersService.create({
    email: dto.email,
    passwordHash,
    displayName: dto.displayName,
  });
  await walletService.createForUser(user.id);

  const accessToken = signAuthToken({ sub: user.id, email: user.email });
  return NextResponse.json({
    accessToken,
    user: { id: user.id, email: user.email, displayName: user.displayName },
  });
});

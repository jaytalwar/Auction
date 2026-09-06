import { NextResponse } from 'next/server';
import { usersService } from '@/lib/users.service';
import { comparePassword, signAuthToken } from '@/lib/auth';
import { UnauthorizedError } from '@/lib/auth';
import { loginSchema } from '@/lib/validation';
import { parseBody, withErrorHandling } from '@/lib/api-helpers';

export const POST = withErrorHandling(async (req) => {
  const dto = await parseBody(req, loginSchema);

  const user = await usersService.findByEmail(dto.email);
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const passwordMatches = await comparePassword(dto.password, user.passwordHash);
  if (!passwordMatches) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const accessToken = signAuthToken({ sub: user.id, email: user.email });
  return NextResponse.json({
    accessToken,
    user: { id: user.id, email: user.email, displayName: user.displayName },
  });
});

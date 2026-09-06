import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const BCRYPT_ROUNDS = 12;

export interface JwtPayload {
  sub: string;
  email: string;
}

function getSecret(): string {
  return process.env.JWT_SECRET ?? 'change-me-in-production';
}

function getExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN ?? '1d';
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAuthToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: getExpiresIn() } as jwt.SignOptions);
}

/** Returns null instead of throwing — every caller just treats a bad token as "unauthenticated". */
export function verifyAuthToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

/** Extracts and verifies the bearer token from a Next.js Request's Authorization header. */
export function getUserFromRequest(req: Request): JwtPayload | null {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return verifyAuthToken(header.slice('Bearer '.length));
}

export class UnauthorizedError extends Error {}

export function requireUser(req: Request): JwtPayload {
  const user = getUserFromRequest(req);
  if (!user) throw new UnauthorizedError('Missing or invalid access token');
  return user;
}

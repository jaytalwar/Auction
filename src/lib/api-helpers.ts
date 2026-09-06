import { NextResponse } from 'next/server';
import { ZodType } from 'zod';
import { BadRequestError, statusForError } from './errors';
import { UnauthorizedError } from './auth';

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new BadRequestError('Request body must be valid JSON');
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new BadRequestError(result.error.issues.map((i) => i.message).join(', '));
  }
  return result.data;
}

/** Wraps a route handler so any thrown error becomes the right JSON error response. */
export function withErrorHandling(fn: (req: Request, ctx: unknown) => Promise<Response>) {
  return async (req: Request, ctx: unknown): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json({ message: err.message }, { status: 401 });
      }
      const message = err instanceof Error ? err.message : 'Something went wrong';
      return NextResponse.json({ message }, { status: statusForError(err) });
    }
  };
}

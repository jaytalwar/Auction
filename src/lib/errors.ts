export class NotFoundError extends Error {}
export class BadRequestError extends Error {}
export class ForbiddenError extends Error {}
export class ConflictError extends Error {}

/** Maps a thrown error to the right HTTP status code for a route handler response. */
export function statusForError(err: unknown): number {
  if (err instanceof NotFoundError) return 404;
  if (err instanceof ForbiddenError) return 403;
  if (err instanceof ConflictError) return 409;
  if (err instanceof BadRequestError) return 400;
  return 400;
}

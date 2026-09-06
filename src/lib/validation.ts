import { z } from 'zod';

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const createAuctionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  mechanism: z.enum(['ENGLISH', 'DUTCH', 'SEALED_FIRST_PRICE', 'VICKREY']),
  /** In cents. */
  reservePrice: z.number().int().positive(),
  /** English only, in cents. */
  minIncrement: z.number().int().positive().optional(),
  /** Dutch only, in cents. */
  startPrice: z.number().int().positive().optional(),
  /** ISO 8601 timestamp string. The service layer checks it parses to a future date. */
  closesAt: z.string().min(1),
});

export const placeBidSchema = z.object({
  /** In cents. */
  amount: z.number().int().positive(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateAuctionInput = z.infer<typeof createAuctionSchema>;
export type PlaceBidInput = z.infer<typeof placeBidSchema>;

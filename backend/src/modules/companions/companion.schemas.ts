import { z } from 'zod';

export const createCompanionSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  note: z.string().trim().max(1000).optional().nullable(),
  isPublic: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

export const updateCompanionSchema = createCompanionSchema.partial();

export const softDeleteSchema = z.object({
  deleteReason: z.string().trim().min(1).max(500),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

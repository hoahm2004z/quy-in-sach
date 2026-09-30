import type { UserRole } from '@prisma/client';

export type AuthUser = {
  id: string;
  supabaseUserId: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
};

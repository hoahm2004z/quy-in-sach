import { prisma } from '../../utils/prisma';
import type { Prisma } from '@prisma/client';

type AuditInput = {
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  ip?: string;
  userAgent?: string;
};

/** Append-only audit writer. Never update/delete from UI. */
export async function writeAuditLog(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      oldValue: input.oldValue === null || input.oldValue === undefined
        ? undefined
        : (JSON.parse(JSON.stringify(input.oldValue)) as Prisma.InputJsonValue),
      newValue: input.newValue === null || input.newValue === undefined
        ? undefined
        : (JSON.parse(JSON.stringify(input.newValue)) as Prisma.InputJsonValue),
      ip: input.ip,
      userAgent: input.userAgent,
    },
  });
}

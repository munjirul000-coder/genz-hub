import type { AuditAction, AuditLog } from "./types";
export type { AuditAction, AuditLog } from "./types";

export function createAuditLog(
  action: AuditAction,
  actorId: string,
  actorRole: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, any>,
  ip?: string
): AuditLog {
  return {
    id: "audit_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    timestamp: Date.now(),
    actorId,
    actorRole,
    action,
    targetType,
    targetId,
    metadata,
    ip,
  };
}

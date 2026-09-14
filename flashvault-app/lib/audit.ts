export type AuditAction =
  | "ADMIN_LOGIN"
  | "APPROVE_PRODUCT"
  | "REJECT_PRODUCT"
  | "LIVE_PRODUCT"
  | "SUSPEND_PRODUCT"
  | "TOGGLE_DROP_LOCK"
  | "CREATE_DROP"
  | "UPDATE_DROP"
  | "CANCEL_DROP"
  | "SUSPEND_MERCHANT"
  | "VERIFY_MERCHANT"
  | "ORDER_STATUS_CHANGE"
  | "PAYOUT_RELEASED";

export type AuditLog = {
  id: string;
  timestamp: number;
  actorId: string;
  actorRole: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  metadata?: Record<string, any>;
  ip?: string;
};

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

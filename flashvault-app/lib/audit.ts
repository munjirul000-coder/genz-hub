import { readDB, writeDB } from "./db";
import type { AuditAction as AuditActionType, AuditLog as AuditLogType } from "./types";
export type { AuditAction, AuditLog } from "./types";

export type AuditActionExtended = 
  | AuditActionType
  | "USER_LOGIN" | "USER_SIGNUP" | "USER_SUSPEND" | "USER_DELETE"
  | "MERCHANT_APPROVE" | "MERCHANT_REJECT" | "MERCHANT_SUSPEND"
  | "PRODUCT_APPROVE" | "PRODUCT_REJECT" | "PRODUCT_DELETE" | "PRODUCT_RESUBMIT"
  | "ORDER_CREATE" | "ORDER_CANCEL" | "ORDER_DELIVERED"
  | "PAYMENT_CREATE" | "PAYMENT_VERIFY" | "PAYMENT_WEBHOOK" | "PAYMENT_REFUND"
  | "DROP_CREATE" | "DROP_UPDATE" | "DROP_CANCEL"
  | "SETTINGS_UPDATE" | "ADMIN_ACTION" | "SECURITY_VIOLATION";

export function createAuditLog(
  action: string,
  userId?: string,
  userRole?: string,
  targetType?: string,
  targetId?: string,
  details?: any,
  ip?: string
) {
  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    action,
    userId: userId || "system",
    userRole: userRole || "SYSTEM",
    actorId: userId || "system",
    actorRole: userRole || "SYSTEM",
    targetId: targetId || null,
    targetType: targetType || null,
    details: details || null,
    metadata: details || null,
    ip: ip || null,
    timestamp: Date.now(),
    createdAt: new Date().toISOString(),
  } as any;
}

export function logAudit(params: {
  action: AuditActionExtended;
  userId?: string;
  userRole?: string;
  targetId?: string;
  targetType?: string;
  details?: any;
  ip?: string;
}) {
  try {
    const db = readDB();
    if (!db.auditLogs) db.auditLogs = [];
    const log = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action: params.action,
      userId: params.userId || "system",
      userRole: params.userRole || "SYSTEM",
      actorId: params.userId || "system",
      actorRole: params.userRole || "SYSTEM",
      targetId: params.targetId || null,
      targetType: params.targetType || null,
      details: params.details || null,
      metadata: params.details || null,
      ip: params.ip || null,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
    } as any;
    db.auditLogs.push(log as any);
    if (db.auditLogs.length > 1000) db.auditLogs = db.auditLogs.slice(-1000);
    writeDB(db);
    console.log(`[AUDIT] ${params.action} by ${params.userId} (${params.userRole}) target ${params.targetId}`);
    return log;
  } catch (e) {
    console.error("[audit] failed", e);
    return null;
  }
}

export function getAuditLogs(filters?: { userId?: string; action?: string; limit?: number }) {
  try {
    const db = readDB();
    let logs = db.auditLogs || [];
    if (filters?.userId) logs = logs.filter((l: any) => l.userId === filters.userId || l.actorId === filters.userId);
    if (filters?.action) logs = logs.filter((l: any) => l.action === filters.action);
    logs.sort((a: any, b: any) => b.timestamp - a.timestamp);
    const limit = filters?.limit || 100;
    return logs.slice(0, limit);
  } catch {
    return [];
  }
}

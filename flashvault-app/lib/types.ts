// Shared types - client-safe, no fs import
export type ProductStatus = "pending" | "approved" | "rejected" | "live" | "soldout" | "suspended";
export type ProductCondition = "New" | "Surplus" | "Deadstock" | "Sample";

export type Product = {
  id: string;
  brand: string;
  title: string;
  description?: string;
  originalPrice: number;
  vaultPrice: number;
  discountPercent: number;
  stock: number;
  availableQuantity: number;
  sold: number;
  soldQuantity: number;
  images: string[];
  image: string;
  category: string;
  size?: string;
  condition: ProductCondition;
  location?: string;
  deliveryInfo?: string;
  returnPolicy?: string;
  verificationStatus: "unverified" | "verified" | "suspicious";
  approvalStatus: ProductStatus;
  status: ProductStatus;
  merchantId: string;
  dropId?: string;
  rejectionReason?: string;
  createdAt: number;
  updatedAt: number;
  verifiedAt?: number;
  verifiedBy?: string;
};

export type MerchantStatus = "pending" | "approved" | "suspended" | "rejected";

export type Merchant = {
  id: string;
  name: string;
  brand: string;
  phone: string;
  email: string;
  verified: boolean;
  status: MerchantStatus;
  totalSales: number;
  totalOrders: number;
  rating?: number;
  address?: string;
  payoutBalance: number;
  totalPayouts: number;
  createdAt: number;
  updatedAt: number;
  suspendedReason?: string;
};

export type UserRole = "CUSTOMER" | "MERCHANT" | "ADMIN" | "SUPER_ADMIN";

export type User = {
  id: string;
  role: UserRole;
  name: string;
  phone: string;
  email?: string;
  passwordHash?: string;
  merchantId?: string;
  createdAt: number;
  lastLogin?: number;
  isSuspended?: boolean;
  resetToken?: string;
  resetExpiry?: number;
};

export type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "returned" | "refunded" | "payout_released" | "paid";

export type Order = {
  id: string;
  productId: string;
  productTitle: string;
  quantity: number;
  amount: number;
  commission: number;
  merchantEarning: number;
  customerId?: string;
  customerPhone: string;
  customerName?: string;
  customerEmail?: string;
  shippingAddress: string;
  city: string;
  area?: string;
  deliveryFee: number;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  deliveryStatus: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  courierTracking?: string;
  courierName?: string;
  idempotencyKey: string;
  createdAt: number;
  updatedAt: number;
  deliveredAt?: number;
  payoutReleasedAt?: number;
};

export type DropConfig = {
  isLocked: boolean;
  nextDropAt: number;
  liveTraffic: number;
  totalGross: number;
  currentDropId?: string;
};

export type PlatformSettings = {
  platformName: string;
  currency: string;
  timezone: string;
  dropDay: number;
  dropStartHour: number;
  dropStartMinute: number;
  dropDurationMinutes: number;
  commissionPercent: number;
  minOrderAmount: number;
  shippingFeeInsideDhaka: number;
  shippingFeeOutside: number;
  maintenanceMode: boolean;
  logoUrl?: string;
};

export type DropState = "UPCOMING" | "LIVE" | "ENDED" | "LOCKED" | "CANCELLED";

export type DropSchedule = {
  id: string;
  title: string;
  scheduledAt: number;
  durationMinutes: number;
  status: DropState;
  productIds: string[];
  createdAt: number;
  createdBy?: string;
};

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

/**
 * Shared domain models, state transition machines, and domain contracts.
 *
 * NOTE: (§1.1) Imported by client components, so nothing here may reach for `server-only`.
 */

// ─── Catalog ──────────────────────────────────────────────────────────────────

/** NOTE: (§2.4) Editorial product specification pair. */
export interface SpecPair {
  key: string;
  value: string;
}

/** NOTE: (§2.3) Component product definition within a bundled set. */
export interface ProductComponentView {
  productId: string;
  slug: string;
  nameUk: string;
  image: string;
  quantity: number;
}

/**
 * Product domain entity for storefront presentation.
 *
 * NOTE: (§2.4, §2.6) Prices evaluated via chargedPrice() to support promotional discounts.
 */
export interface Product {
  id: string;
  /** NOTE: (§2.4) Hand-curated English URL segment. */
  slug: string;
  /** Latin product name. */
  name: string;
  nameUk: string;
  /** NOTE: (§2.6) Standard price in whole UAH. Consult chargedPrice() for charging calculations. */
  price: number;
  /** Active promotional price in whole UAH. */
  promotionalPrice?: number;
  /** Category URL identifier. */
  category: string;
  categoryNameUk: string;
  tagline: string;
  description: string;
  /** Application guidance content. */
  usage: string;
  specifications: SpecPair[];
  /** Ordered media assets (images and video paths). */
  media: string[];
  /** Primary card thumbnail URL. */
  image: string;
  stock: number;
  badge?: ManualBadge;
  /** NOTE: (§8.3) Product-specific packaging copy. */
  packaging: string;
  /** NOTE: (§2.5) Soft deletion flag preserving order integrity. */
  isDeleted: boolean;
  /** NOTE: (§2.3) Bundled set components; empty for standalone items. */
  components: ProductComponentView[];
}

/** NOTE: (§2.5) Administrative product entity with order attachment indicator. */
export interface AdminProduct extends Product {
  hasOrders: boolean;
}

/** NOTE: (§12.4) Editorial manual badge whitelist. */
export const MANUAL_BADGES = ["NEW", "BESTSELLER"] as const;

export type ManualBadge = (typeof MANUAL_BADGES)[number];

export const MANUAL_BADGE_LABELS: Record<ManualBadge, string> = {
  NEW: "New",
  BESTSELLER: "Bestseller",
};

/** Product media gallery thumbnail limit. */
export const MAX_PRODUCT_IMAGES = 5;

export interface CartItem {
  product: Product;
  quantity: number;
}

/** NOTE: (§7.4) Cart reconciliation notices for stock or price discrepancies. */
export type CartNotice =
  | { kind: "removed"; nameUk: string }
  | { kind: "sold-out"; nameUk: string }
  | { kind: "reduced"; nameUk: string; requested: number; available: number }
  | { kind: "order-released"; orderId: string }
  | { kind: "order-release-failed"; orderId: string };

/**
 * Checks whether a cart notice alters order contents and requires explicit acknowledgement.
 *
 * NOTE: (§7.4) Blocks checkout if items were removed, sold out, or quantities reduced.
 */
export function noticeBlocksCheckout(notice: CartNotice): boolean {
  return notice.kind === "removed" || notice.kind === "sold-out" || notice.kind === "reduced";
}

interface Priced {
  price: number;
  promotionalPrice?: number | null;
}

/**
 * Resolves effective price to charge for a product.
 *
 * NOTE: (§2.6) Prioritizes promotionalPrice when present over regular price.
 */
export function chargedPrice(product: Priced): number {
  return product.promotionalPrice ?? product.price;
}

/**
 * Resolves strike-through regular price during an active promotion.
 *
 * NOTE: (§2.6) Returns standard price if promo is active; undefined otherwise.
 */
export function regularPrice(product: Priced): number | undefined {
  return product.promotionalPrice == null ? undefined : product.price;
}

/** Resolves unit price for a cart line. */
export function cartLinePrice(item: CartItem): number {
  return chargedPrice(item.product);
}

/** Resolves strike-through regular unit price for a cart line. */
export function cartLineRegularPrice(item: CartItem): number | undefined {
  return regularPrice(item.product);
}

export interface WishlistItem {
  product: Product;
}

export interface StoredWishlistLine {
  productId: string;
}

/** NOTE: (§7.4) Minimal client storage schema for cart persistence. */
export interface StoredCartLine {
  productId: string;
  quantity: number;
}

// ─── Home-Page Banners ────────────────────────────────────────────────────────

/** NOTE: (§8.3) Tri-panel desktop hero banner photograph requirement. */
export const BANNER_PHOTO_COUNT = 3;

export const BANNER_PHOTOS_ON_PHONE = 1;
export const BANNER_PHOTOS_ON_TABLET = 2;

/** Maximum concurrently active hero carousel banners. */
export const MAX_ACTIVE_BANNERS = 3;

export interface BannerDeviceView {
  device: "phone" | "tablet" | "desktop";
  label: string;
  photos: number;
  cellAspect: number;
}

const FRAME_ASPECT = {
  phone: 390 / 780,
  tablet: 834 / 1100,
  desktop: 1920 / 950,
} as const;

export function bannerDeviceViews(): BannerDeviceView[] {
  return [
    {
      device: "phone",
      label: "Phone",
      photos: BANNER_PHOTOS_ON_PHONE,
      cellAspect: FRAME_ASPECT.phone / BANNER_PHOTOS_ON_PHONE,
    },
    {
      device: "tablet",
      label: "Tablet",
      photos: BANNER_PHOTOS_ON_TABLET,
      cellAspect: FRAME_ASPECT.tablet / BANNER_PHOTOS_ON_TABLET,
    },
    {
      device: "desktop",
      label: "Desktop",
      photos: BANNER_PHOTO_COUNT,
      cellAspect: FRAME_ASPECT.desktop / BANNER_PHOTO_COUNT,
    },
  ];
}

export interface Banner {
  id: string;
  subtitle?: string;
  title: string;
  images: string[];
  ctaLabel?: string;
  ctaHref?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
  isActive: boolean;
  position: number;
}

const BANNER_TITLE_SIZES = [
  "text-2xl min-[380px]:text-3xl sm:text-4xl lg:text-[44px]",
  "text-xl min-[380px]:text-2xl sm:text-3xl lg:text-[34px]",
  "text-base min-[380px]:text-lg sm:text-2xl lg:text-[26px]",
] as const;

function bannerTitleStep(length: number): number {
  if (length > 70) return 2;
  if (length > 40) return 1;
  return 0;
}

/**
 * Dynamically computes typography scale classes for hero banner headings based on text volume.
 */
export function bannerTitleScale(title: string): string {
  const lines = title
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return BANNER_TITLE_SIZES[0];

  const longest = Math.max(...lines.map((line) => line.length));
  const total = lines.join(" ").length;

  const step =
    Math.max(bannerTitleStep(longest), bannerTitleStep(total) - 1) +
    (lines.length > 2 ? 1 : 0);

  return BANNER_TITLE_SIZES[Math.min(step, BANNER_TITLE_SIZES.length - 1)];
}

// ─── Accounts & Access ────────────────────────────────────────────────────────

/** NOTE: (§8.1) System user roles. */
export type UserRole = "OWNER" | "MANAGER" | "CUSTOMER";

/** NOTE: (§8.1) Administrative authorization allow-list for admin dashboard access. */
export const ADMIN_ROLES: readonly UserRole[] = ["OWNER", "MANAGER"];

export function isAdminRole(role: string | undefined): boolean {
  return ADMIN_ROLES.includes(role as UserRole);
}

// ─── Audit Trail ──────────────────────────────────────────────────────────────

/**
 * NOTE: (§2.7) Supported audit actions across authentication, catalog, orders, and integrations.
 */
export const AUDIT_ACTIONS = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "MFA_ENROL_STARTED",
  "MFA_VERIFIED",
  "MFA_FAILED",
  "MFA_DISABLED",
  "MFA_RESET",
  "LOGOUT",
  "PRODUCT_CREATED",
  "PRODUCT_UPDATED",
  "PRODUCT_DELETED",
  "PRODUCT_RESTORED",
  "PRODUCTS_REORDERED",
  "CATEGORY_CREATED",
  "CATEGORY_UPDATED",
  "AUDIT_ENTRY_DELETED",
  "TESTING_DATA_RESET",
  "ORDERS_ANONYMIZED",
  "ORDER_UPDATED",
  "ORDER_CANCELLED",
  "ORDER_DELETED",
  "ORDER_PAID",
  "ORDER_PAID_MANUALLY",
  "PAYMENT_MISMATCH",
  "PAYMENT_AFTER_CANCEL",
  "PAYMENT_NOT_COMPLETED",
  "PAYMENT_UNKNOWN_ORDER",
  "ORDER_EXPIRED",
  "ORDER_RELEASED_BY_CUSTOMER",
  "USER_CREATED",
  "USER_PASSWORD_SET",
  "USER_DEACTIVATED",
  "USER_REACTIVATED",
  "NOVA_POSHTA_UNAVAILABLE",
  "NOVA_POSHTA_SYNCED",
  "ORDER_REVIEW_RESOLVED",
  "BANNER_CREATED",
  "BANNER_UPDATED",
  "BANNER_DELETED",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  LOGIN_SUCCESS: "Signed in",
  LOGIN_FAILED: "Failed sign-in",
  MFA_ENROL_STARTED: "2FA enrolment started",
  MFA_VERIFIED: "2FA code verified",
  MFA_FAILED: "Wrong 2FA code",
  MFA_DISABLED: "2FA switched off",
  MFA_RESET: "2FA reset by the owner",
  LOGOUT: "Signed out",
  PRODUCT_CREATED: "Product created",
  PRODUCT_UPDATED: "Product updated",
  PRODUCT_DELETED: "Product hidden",
  PRODUCT_RESTORED: "Product restored",
  PRODUCTS_REORDERED: "Catalogue order changed",
  CATEGORY_CREATED: "Category created",
  CATEGORY_UPDATED: "Category renamed",
  ORDER_UPDATED: "Order updated",
  AUDIT_ENTRY_DELETED: "Journal entry deleted",
  TESTING_DATA_RESET: "Rehearsal data cleared before opening",
  ORDERS_ANONYMIZED: "Order personal data erased",
  ORDER_CANCELLED: "Order cancelled",
  ORDER_DELETED: "Order deleted for good",
  ORDER_PAID: "Order paid",
  ORDER_PAID_MANUALLY: "Payment confirmed by hand",
  ORDER_RELEASED_BY_CUSTOMER: "Customer came back and released the order",
  PAYMENT_MISMATCH: "Payment mismatch",
  PAYMENT_AFTER_CANCEL: "Payment after cancellation",
  PAYMENT_NOT_COMPLETED: "Payment not completed",
  PAYMENT_UNKNOWN_ORDER: "Payment for an unknown order",
  ORDER_EXPIRED: "Reservation released",
  USER_CREATED: "Account created",
  USER_PASSWORD_SET: "Password set by the owner",
  USER_DEACTIVATED: "Access switched off",
  USER_REACTIVATED: "Access restored",
  NOVA_POSHTA_UNAVAILABLE: "Nova Poshta not responding",
  NOVA_POSHTA_SYNCED: "Nova Poshta directory refreshed",
  ORDER_REVIEW_RESOLVED: "Payment mismatch resolved",
  BANNER_CREATED: "Banner created",
  BANNER_UPDATED: "Banner updated",
  BANNER_DELETED: "Banner deleted",
};

/** NOTE: (§2.7) Audit actions visible to the MANAGER role. */
export const MANAGER_VISIBLE_AUDIT_ACTIONS: readonly AuditAction[] = [
  "ORDER_UPDATED",
  "ORDER_CANCELLED",
  "ORDER_DELETED",
  "ORDER_RELEASED_BY_CUSTOMER",
  "ORDER_PAID",
  "ORDER_EXPIRED",
  "PAYMENT_MISMATCH",
  "PAYMENT_AFTER_CANCEL",
  "PAYMENT_NOT_COMPLETED",
  "PAYMENT_UNKNOWN_ORDER",
  "ORDER_REVIEW_RESOLVED",
  "NOVA_POSHTA_UNAVAILABLE",
];

/** NOTE: (§2.7) Drawn as a warning: nothing here resolves on its own. */
export const CRITICAL_AUDIT_ACTIONS: readonly AuditAction[] = [
  "PAYMENT_MISMATCH",
  "PAYMENT_AFTER_CANCEL",
  "PAYMENT_UNKNOWN_ORDER",
  "NOVA_POSHTA_UNAVAILABLE",
];

// ─── Orders ───────────────────────────────────────────────────────────────────

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

/** NOTE: (§4.1) Order statuses manually settable by staff. */
export const MANUAL_ORDER_STATUSES = [
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const satisfies readonly OrderStatus[];

export type ManualOrderStatus = (typeof MANUAL_ORDER_STATUSES)[number];

/**
 * Permissible order state transitions table for staff operations.
 *
 * NOTE: (§4.1, §4.5) PAID is set exclusively by payment webhooks/sweeps.
 * SHIPPED orders transition to DELIVERED or RETURNED (not CANCELLED) to prevent inventory corruption.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly ManualOrderStatus[]> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PAID: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

/** NOTE: (§4.6) True if physical goods have departed the warehouse. */
export function goodsHaveLeft(status: OrderStatus): boolean {
  return status === "SHIPPED" || status === "DELIVERED" || status === "RETURNED";
}

/** NOTE: (§4.6) Verifies whether line items can be returned from current status. */
export function canRecordReturn(status: OrderStatus): boolean {
  return status === "PAID" || goodsHaveLeft(status);
}

export function canTransition(from: OrderStatus, to: ManualOrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function isManualOrderStatus(status: OrderStatus): status is ManualOrderStatus {
  return (MANUAL_ORDER_STATUSES as readonly OrderStatus[]).includes(status);
}

export type DeliveryMethod = "branch" | "courier";

/** NOTE: (§4.7) Exclusive online payment channel. */
export type PaymentMethod = "mono";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  mono: "mono pay (online payment)",
};

export interface OrderCustomer {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  /** NOTE: (§5.2) Nova Poshta CityRef UUID. */
  cityRef: string;
  deliveryMethod: DeliveryMethod;
  branch?: string;
  /** NOTE: (§5.2) Nova Poshta WarehouseRef UUID. Nothing generates a waybill from it (§5.1.1). */
  branchRef?: string;
  address?: string;
  paymentMethod: PaymentMethod;
  comment?: string;
}

/** NOTE: (§2.5) Line item snapshot frozen at checkout creation. */
export interface OrderItem {
  id: string;
  productId: string;
  nameUk: string;
  price: number;
  quantity: number;
  image?: string;
  returnedQuantity: number;
  restockedQuantity: number;
}

/** Resolves remaining revenue for a line item after returns. */
export function lineNetTotal(item: OrderItem): number {
  return item.price * (item.quantity - item.returnedQuantity);
}

/** NOTE: (§4.6) Derives overall return state dynamically across line items. */
export function orderReturnState(items: OrderItem[]): "none" | "partial" | "full" {
  const returned = items.reduce((sum, i) => sum + i.returnedQuantity, 0);
  if (returned === 0) return "none";
  const ordered = items.reduce((sum, i) => sum + i.quantity, 0);
  return returned >= ordered ? "full" : "partial";
}

/** Resolves refunded amount in whole UAH. */
export function orderRefundedTotal(items: OrderItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.returnedQuantity, 0);
}

/** NOTE: (§2.6) Net turnover calculation (gross total minus returns). */
export function orderNetTotal(order: { total: number; items: OrderItem[] }): number {
  return order.total - orderRefundedTotal(order.items);
}

export interface Order {
  id: string;
  createdAt: string;
  status: OrderStatus;
  customer: OrderCustomer;
  items: OrderItem[];
  total: number;
  invoiceId?: string;
  /** NOTE: (§3.1) Hosted-checkout attempt counter. */
  paymentAttempts?: number;
  paidAt?: string;
  trackingNumber?: string;
  managerNote?: string;
  /** NOTE: (§8.5) Reversible archive flag. */
  archivedAt?: string;
  /** NOTE: (§3.1) Flag indicating unresolved payment anomaly requiring manager action. */
  needsReview?: boolean;
  reviewNote?: string;
  /** NOTE: (§4.4) Stock reservation expiry timestamp. */
  expiresAt: string;
}

/** NOTE: (§4.4) Checkout validity (20m) and stock hold reservation (30m). */
export const PAYMENT_WINDOW_MINUTES = 20;
export const PENDING_PAYMENT_TTL_MINUTES = PAYMENT_WINDOW_MINUTES + 10;


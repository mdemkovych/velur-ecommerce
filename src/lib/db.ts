import "server-only";

/**
 * Unified database facade re-exporting operations from db/ domain modules.
 *
 * NOTE: (§3.4) Consolidates storage access surface. Auth & staff role management reside in auth.ts.
 */


export { ADMIN_ROLES } from "./types";
export type { Order, OrderStatus, UserRole } from "./types";

export {
  createCategory,
  CategoryWriteError,
  createProduct,
  deleteProductForever,
  getAllProducts,
  getCategories,
  getProductById,
  getProductNames,
  getPublishedProducts,
  getPublishedProductSlugs,
  getPublishedProductRevisions,
  getPublishedCategories,
  ProductWriteError,
  reorderProducts,
  restoreProduct,
  softDeleteProduct,
  updateCategory,
  updateProduct,
} from "./db/products";
export type { CategoryInput, ProductComponentInput, ProductInput } from "./db/products";

export {
  cancelOrder,
  claimInvoice,
  clearOrderReview,
  createOrder,
  deleteCancelledOrder,
  flagOrderForReview,
  getOrderById,
  getOrderStats,
  listOrders,
  markOrderPaid,
  MAX_PAYMENT_ATTEMPTS,
  ORDERS_PAGE_SIZE,
  registerPaymentAttempt,
  setOrderArchived,
  updateOrder,
  updateOrderCustomer,
} from "./db/orders";
export type {
  CartLine,
  CreateOrderResult,
  OrderListQuery,
  OrderPage,
  OrderStats,
} from "./db/orders";

export { listTeam } from "./db/users";
export type { TeamMember } from "./db/users";

export { markOrderReturned, setItemReturn } from "./db/returns";

export { expireStaleOrders } from "./db/expiry";

export { anonymizeOldOrders, ORDER_RETENTION_YEARS } from "./db/retention";

export {
  BannerWriteError,
  createBanner,
  deleteBanner,
  getActiveBanners,
  getAllBanners,
  getBannerById,
  moveBanner,
  updateBanner,
} from "./db/banners";
export type { BannerInput } from "./db/banners";

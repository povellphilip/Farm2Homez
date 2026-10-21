import type { components } from './schema';

type S = components['schemas'];

export type Role = S['RoleEnum'];
export type User = S['User'];
export type Session = S['Session'];
export type Category = S['Category'];
export type CategoryBrief = S['CategoryBrief'];
export type ProductList = S['ProductList'];
export type ProductDetail = S['ProductDetail'];
export type ProductImage = S['ProductImage'];
export type ProducerBrief = S['ProducerBrief'];
export type ProducerPublic = S['ProducerPublic'];
export type ProducerProfile = S['ProducerProfile'];
export type ProducerProduct = S['ProducerProduct'];
export type ProducerProductRequest = S['ProducerProductRequest'];
export type Cart = S['Cart'];
export type CartLine = S['CartLine'];
export type Order = S['Order'];
export type OrderList = S['OrderList'];
export type OrderItem = S['OrderItem'];
export type ConsumerProducerOrder = S['ConsumerProducerOrder'];
export type ProducerOrder = S['ProducerOrder'];
export type AdminOrder = S['AdminOrder'];
export type AdminUser = S['AdminUser'];
export type AdminProducer = S['AdminProducer'];
export type AdminProduct = S['AdminProduct'];
export type AdminCategory = S['AdminCategory'];
export type AuditLog = S['AuditLog'];
export type Address = S['Address'];
export type AddressRequest = S['AddressRequest'];
export type Inquiry = S['Inquiry'];
export type Review = S['Review'];
export type PaymentMethod = S['PaymentMethod'];
export type UploadTicket = S['UploadTicket'];
export type FavoriteProduct = S['FavoriteProduct'];
export type FavoriteProducer = S['FavoriteProducer'];
export type Unit = S['UnitEnum'];
export type FulfillmentStatus = S['FulfillmentStatusEnum'];
export type OrderStatus = S['OrderStatusEnum'];
export type ProductStatus = S['ProductStatusEnum'];
export type ModerationStatus = S['ModerationStatusEnum'];
export type VerificationStatus = S['VerificationStatusEnum'];
export type InquiryStatus = S['InquiryStatusEnum'];

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DailyPoint {
  date: string;
  orders: number;
  revenue: string;
}

export interface ProducerOverview {
  listings: {
    total: number;
    by_status: Partial<Record<ProductStatus, number>>;
    pending_moderation: number;
    rejected: number;
    low_stock: { id: number; name: string; slug: string; stock_quantity: number; unit: Unit }[];
  };
  orders: { total: number; by_status: Partial<Record<FulfillmentStatus, number>>; awaiting_action: number };
  sales: {
    revenue_total: string;
    revenue_delivered: string;
    revenue_period: string;
    daily: DailyPoint[];
    top_products: { product_id: number | null; product_name: string; quantity: number; revenue: string }[];
  };
  views: { period_total: number; top_products: { product_id: number; product__name: string; views: number }[] };
  inquiries: { open: number };
  period_days: number;
}

export interface PlatformOverview {
  users: { by_role: Partial<Record<Role, number>>; new_in_period: number; suspended: number };
  producers: { by_verification: Partial<Record<VerificationStatus, number>>; pending_verification: number };
  products: { by_status: Partial<Record<ProductStatus, number>>; pending_moderation: number; live: number; out_of_stock_live: number };
  orders: { total: number; by_status: Partial<Record<OrderStatus, number>>; in_period: number; fulfilments_by_status: Partial<Record<FulfillmentStatus, number>> };
  revenue: {
    gross_total: string;
    gross_period: string;
    delivered_total: string;
    test_payments_total: string;
    daily: DailyPoint[];
    top_producers: { producer_id: number; producer__farm_name: string; orders: number; revenue: string }[];
  };
  inquiries: { open: number; platform_open: number };
  period_days: number;
}

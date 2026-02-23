export interface Coupon {
  code: string;
  title: string;
  items: string[];
  originalPrice: number;
  discountedPrice: number;
  validUntil: string;
  minPurchasePrice?: number; // Minimum purchase requirement (e.g., NT$320)
  deliveryType?: 'delivery' | 'takeout' | 'both'; // 外送 | 外帶 | 外送外帶
  _searchText?: string; // Pre-calculated lowercase text for searching
}

export interface Metadata {
  lastUpdated: string;
  totalCoupons: number;
  scannedRanges: string[];
  newCouponsFound?: number;
  existingCoupons?: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  isStartingPrice?: boolean;
  category: string;
  categoryId: number;
  subcategory?: string;
  imageUrl?: string;
  url: string;
}

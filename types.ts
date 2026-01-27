export interface Coupon {
  code: string;
  title: string;
  items: string[];
  originalPrice: number;
  discountedPrice: number;
  validUntil: string;
}

export interface Metadata {
  lastUpdated: string;
  totalCoupons: number;
  scannedRanges: string[];
  newCouponsFound?: number;
  existingCoupons?: number;
}

export interface Coupon {
  id: string;
  code: string;
  title: string;
  items: string[];
  originalPrice: number;
  discountedPrice: number;
  validUntil: string;
  imageUrl: string;
}

export interface Metadata {
  lastUpdated: string;
  totalCoupons: number;
  scannedRanges: string[];
}

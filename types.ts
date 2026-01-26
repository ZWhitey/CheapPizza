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

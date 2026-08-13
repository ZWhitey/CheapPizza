import { Coupon } from './types';

export const buildCouponSearchText = (coupon: Coupon): string =>
  [coupon.code, coupon.title, ...(coupon.items ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();

export const parseSearchKeywords = (query: string): string[] =>
  query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/u)
    .filter(Boolean);

export const couponMatchesKeywords = (coupon: Coupon, keywords: string[]): boolean => {
  if (keywords.length === 0) return true;

  const searchText = coupon._searchText ?? buildCouponSearchText(coupon);
  return keywords.every(keyword => searchText.includes(keyword));
};

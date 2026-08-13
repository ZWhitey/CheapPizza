import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCouponSearchText, couponMatchesKeywords, parseSearchKeywords } from './search';
import { Coupon } from './types';

const coupon: Coupon = {
  code: 'ABC123',
  title: '歡樂大披薩套餐',
  items: ['夏威夷披薩', '可樂'],
  originalPrice: 800,
  discountedPrice: 499,
  validUntil: '2026-12-31'
};

test('search text contains coupon code, title and meal contents', () => {
  const searchText = buildCouponSearchText(coupon);

  assert.match(searchText, /abc123/);
  assert.match(searchText, /歡樂大披薩套餐/);
  assert.match(searchText, /夏威夷披薩 可樂/);
});

test('multiple whitespace-separated keywords use case-insensitive AND matching', () => {
  const keywords = parseSearchKeywords('  ABC123   可樂 ');

  assert.deepEqual(keywords, ['abc123', '可樂']);
  assert.equal(couponMatchesKeywords(coupon, keywords), true);
  assert.equal(couponMatchesKeywords(coupon, parseSearchKeywords('ABC123 雞翅')), false);
});

test('an empty query matches every coupon', () => {
  assert.equal(couponMatchesKeywords(coupon, parseSearchKeywords('   ')), true);
});

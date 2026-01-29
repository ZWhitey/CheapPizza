import React, { useState } from 'react';
import { Coupon } from '../types';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface CouponCardProps {
  coupon: Coupon;
}

const CouponCard: React.FC<CouponCardProps> = ({ coupon }) => {
  const [copied, setCopied] = useState(false);

  const discountPercentage = coupon.originalPrice > 0 
    ? Math.round(((coupon.originalPrice - coupon.discountedPrice) / coupon.originalPrice) * 100)
    : 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOrder = () => {
    const encodedCode = encodeURIComponent(coupon.code);
    window.open(`https://pizzahut.com.tw/order/?mode=step_2&type_id=1025&cno=${encodedCode}`, '_blank');
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full relative overflow-hidden group">
        {/* Discount Badge */}
        {discountPercentage > 0 && (
            <div className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-bl-lg z-10 shadow-sm">
                -{discountPercentage}%
            </div>
        )}

      <div className="p-5 flex-1 flex flex-col">
        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 mb-2 leading-snug group-hover:text-red-600 transition-colors">
            {coupon.title}
        </h3>

        {/* Valid Date */}
        {coupon.validUntil && (
            <div className="text-xs text-gray-400 mb-3">
                有效期限：{coupon.validUntil}
            </div>
        )}

        {/* Divider */}
        <div className="h-px bg-gray-100 my-2"></div>

        {/* Items */}
        <div className="flex-1 mb-4">
            {coupon.items && coupon.items.length > 0 ? (
                <ul className="space-y-2">
                    {coupon.items.map((item, idx) => (
                        <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0"></span>
                            <span className="leading-relaxed">{item}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-gray-400 italic">無詳細餐點說明</p>
            )}
        </div>

        {/* Price */}
        <div className="mt-auto flex items-end gap-2 mb-4">
            <div className="text-2xl font-extrabold text-red-600">
                ${coupon.discountedPrice}
            </div>
            {coupon.originalPrice > 0 && (
                <div className="text-sm text-gray-400 line-through mb-1">
                    ${coupon.originalPrice}
                </div>
            )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-2 border border-gray-100">
                <span className="text-base font-mono font-bold text-gray-700 tracking-wider pl-1">
                    {coupon.code}
                </span>
                <button
                    onClick={handleCopy}
                    className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-colors
                        ${copied 
                            ? 'bg-green-100 text-green-700'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900'
                        }
                    `}
                >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? '已複製' : '複製'}
                </button>
            </div>

            <button
                onClick={handleOrder}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm bg-red-600 text-white hover:bg-red-700 active:bg-red-800 transition-colors shadow-sm"
            >
                <ExternalLink size={16} />
                前往點餐
            </button>
        </div>
      </div>
    </div>
  );
};

export default CouponCard;

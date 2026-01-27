import React, { useState } from 'react';
import { Coupon } from '../types';
import { Copy, Check, Clock, Utensils, ExternalLink } from 'lucide-react';

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
    <div className="group bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col h-full relative">
      {/* Top Section: Brand Banner */}
      <div className="relative h-24 overflow-hidden flex-shrink-0 bg-gradient-to-br from-red-600 to-red-700">
        {discountPercentage > 0 && (
          <div className="absolute top-0 right-0 bg-yellow-400 text-red-900 font-bold px-3 py-1 rounded-bl-xl shadow-md z-10">
            省 {discountPercentage}%
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-3">
           <span className="text-white text-sm font-bold">必勝客 Pizza Hut</span>
        </div>
      </div>

      {/* Decorative dashed line for "Coupon" feel */}
      <div className="relative h-4 bg-gray-50 flex items-center justify-between flex-shrink-0">
        <div className="w-4 h-4 bg-gray-50 rounded-full -ml-2 border-r border-gray-200"></div>
        <div className="w-full border-t-2 border-dashed border-gray-300"></div>
        <div className="w-4 h-4 bg-gray-50 rounded-full -mr-2 border-l border-gray-200"></div>
      </div>

      {/* Bottom Section: Details */}
      <div className="p-4 flex-1 flex flex-col justify-between bg-white">
        <div>
          <h4 className="text-lg font-bold text-gray-800 mb-3 leading-snug">{coupon.title}</h4>
          
          {coupon.items && coupon.items.length > 0 && (
            <div className="mb-4 bg-red-50/50 p-3 rounded-lg border border-red-100">
               <ul className="space-y-1.5">
                 {coupon.items.map((item, idx) => (
                   <li key={idx} className="text-sm text-gray-700 flex items-start">
                     <Utensils size={14} className="text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                     <span className="leading-tight">{item}</span>
                   </li>
                 ))}
               </ul>
            </div>
          )}

          {coupon.validUntil && (
            <div className="flex items-center text-xs text-gray-400 mb-4 gap-1">
              <Clock size={12} />
              <span>有效期限: {coupon.validUntil}</span>
            </div>
          )}
        </div>

        <div>
            {/* Price Row */}
            {coupon.originalPrice > 0 && coupon.discountedPrice > 0 && (
              <div className="flex items-end justify-between mb-4">
                  <div className="text-gray-400 text-sm line-through decoration-gray-400">
                      ${coupon.originalPrice}
                  </div>
                  <div className="text-2xl font-extrabold text-red-600 flex items-baseline">
                      <span className="text-sm mr-0.5">$</span>
                      {coupon.discountedPrice}
                  </div>
              </div>
            )}

            {/* Action Row */}
            <div className="bg-gray-50 rounded-xl p-2 flex items-center justify-between border border-gray-100 mb-2">
                <div className="flex flex-col px-2">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">優惠碼</span>
                    <span className="font-mono font-bold text-gray-800 text-lg tracking-widest">{coupon.code}</span>
                </div>
                <button
                    onClick={handleCopy}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
                        ${copied 
                            ? 'bg-green-500 text-white' 
                            : 'bg-red-600 text-white hover:bg-red-700 active:scale-95'
                        }
                    `}
                >
                    {copied ? (
                        <>
                            <Check size={16} />
                            <span>已複製</span>
                        </>
                    ) : (
                        <>
                            <Copy size={16} />
                            <span>複製</span>
                        </>
                    )}
                </button>
            </div>

            {/* Order Button */}
            <button
                onClick={handleOrder}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-gray-800 text-white hover:bg-gray-900 transition-all duration-200 active:scale-95"
            >
                <ExternalLink size={16} />
                <span>前往點餐</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default CouponCard;
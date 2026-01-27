import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import CouponCard from './components/CouponCard';
import { Coupon, Metadata } from './types';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Coupons from JSON
  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        setLoading(true);
        // In a real deployed app, this fetches from /coupons.json
        // In some dev environments, we might need to reference public folder
        const response = await fetch('./coupons.json');
        if (!response.ok) {
          throw new Error('Failed to load coupons');
        }
        const data = await response.json();
        setCoupons(data);
      } catch (err) {
        console.error("Error loading coupons:", err);
        setError('無法載入優惠券資料，請稍後再試。');
      } finally {
        setLoading(false);
      }
    };

    const fetchMetadata = async () => {
      try {
        const response = await fetch('./metadata.json');
        if (!response.ok) {
          console.warn('Metadata not found, this is OK for older deployments');
          return;
        }
        const data = await response.json();
        setMetadata(data);
      } catch (err) {
        console.warn("Error loading metadata:", err);
      }
    };

    fetchCoupons();
    fetchMetadata();
  }, []);

  // Format update time for display
  const formatUpdateTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString('zh-TW', { 
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Taipei'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header lastUpdated={metadata?.lastUpdated} />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-brand-500 mb-4" size={40} />
            <p className="text-gray-500">正在搜尋最新優惠...</p>
          </div>
        ) : error ? (
           <div className="text-center py-20 text-red-500 bg-red-50 rounded-lg">
             <p>{error}</p>
           </div>
        ) : (
          <>
            {/* Results Count */}
            <div className="mb-4 text-sm text-gray-500 font-medium">
              全部優惠 ({coupons.length})
            </div>

            {/* Coupon Grid */}
            {coupons.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {coupons.map((coupon) => (
                  <CouponCard key={coupon.code} coupon={coupon} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-gray-500">
                目前沒有可用的優惠券。
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">
            © 2024 CouponHunt. 圖片僅供參考，實際內容以餐廳現場為主。
          </p>
          <p className="text-gray-400 text-xs mt-2">
            資料來源：網路公開資訊整理
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
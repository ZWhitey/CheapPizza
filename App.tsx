import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import CouponCard from './components/CouponCard';
import Filter from './components/Filter';
import { Coupon, Metadata, MenuItem } from './types';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedFilterItems, setSelectedFilterItems] = useState<string[]>([]);
  const [selectedDeliveryTypes, setSelectedDeliveryTypes] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Parallel fetch
        const [couponsRes, menuRes, metadataRes] = await Promise.all([
            fetch('./coupons.json'),
            fetch('./menu.json'),
            fetch('./metadata.json').catch(() => null)
        ]);

        if (!couponsRes.ok) throw new Error('Failed to load coupons');
        const couponsData = await couponsRes.json();
        setCoupons(couponsData);

        if (menuRes.ok) {
            const menuData = await menuRes.json();
            setMenuItems(menuData);
        }

        if (metadataRes && metadataRes.ok) {
            const metadataData = await metadataRes.json();
            setMetadata(metadataData);
        }

      } catch (err) {
        console.error("Error loading data:", err);
        setError('無法載入優惠券資料，請稍後再試。');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter and Sort Coupons
  const filteredCoupons = useMemo(() => {
      // 1. Filter
      let result = coupons;

      // Filter by menu items
      if (selectedFilterItems.length > 0) {
          result = result.filter(coupon => {
              // Combine title and items for searching
              const couponText = (coupon.title + (coupon.items ? coupon.items.join('') : '')).toLowerCase();

              // Check if ALL selected items are present in the coupon text
              return selectedFilterItems.every(item => {
                  return couponText.includes(item.toLowerCase());
              });
          });
      }

      // Filter by delivery type
      if (selectedDeliveryTypes.length > 0) {
          result = result.filter(coupon => {
              // If coupon has no delivery type, show it (backward compatibility)
              if (!coupon.deliveryType) return true;
              
              // If coupon supports 'both', it matches any selection
              if (coupon.deliveryType === 'both') return true;
              
              // Check if coupon's delivery type is in the selected types
              return selectedDeliveryTypes.includes(coupon.deliveryType);
          });
      }

      // 2. Sort by Price (Low to High)
      // Use minPurchasePrice when discountedPrice is 0
      result.sort((a, b) => {
          const priceA = a.discountedPrice || a.minPurchasePrice || 0;
          const priceB = b.discountedPrice || b.minPurchasePrice || 0;
          return priceA - priceB;
      });

      return result;
  }, [coupons, selectedFilterItems, selectedDeliveryTypes]);


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
            {/* Filter Section */}
            {menuItems.length > 0 && (
                <Filter
                    menuItems={menuItems}
                    selectedItems={selectedFilterItems}
                    onSelectionChange={setSelectedFilterItems}
                    selectedDeliveryTypes={selectedDeliveryTypes}
                    onDeliveryTypesChange={setSelectedDeliveryTypes}
                />
            )}

            {/* Results Count */}
            <div className="mb-4 text-sm text-gray-500 font-medium flex justify-between items-center">
              <span>
                  {selectedFilterItems.length > 0 ? `搜尋結果: ${filteredCoupons.length} 筆優惠` : `全部優惠 (${coupons.length})`}
              </span>
              <span className="text-xs text-gray-400">
                  排序：價格低到高
              </span>
            </div>

            {/* Coupon Grid */}
            {filteredCoupons.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredCoupons.map((coupon) => (
                  <CouponCard key={coupon.code} coupon={coupon} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-gray-500 bg-white rounded-xl border border-gray-200">
                <p className="text-lg font-medium mb-2">找不到符合條件的優惠券</p>
                <button
                    onClick={() => {
                        setSelectedFilterItems([]);
                        setSelectedDeliveryTypes([]);
                    }}
                    className="text-red-600 hover:underline"
                >
                    清除篩選條件
                </button>
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

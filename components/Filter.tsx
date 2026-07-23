import React, { useState, useMemo } from 'react';
import { Coupon, MenuItem } from '../types';
import { ChevronDown, ChevronUp, Filter as FilterIcon, X } from 'lucide-react';

// Number of popular items shown as always-visible quick-select chips
const QUICK_PICK_COUNT = 15;

interface FilterProps {
  coupons: Coupon[];
  menuItems: MenuItem[];
  selectedItems: string[];
  onSelectionChange: (items: string[]) => void;
  selectedDeliveryTypes: string[];
  onDeliveryTypesChange: (types: string[]) => void;
}

const Filter: React.FC<FilterProps> = ({
  coupons,
  menuItems,
  selectedItems,
  onSelectionChange,
  selectedDeliveryTypes,
  onDeliveryTypesChange
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const couponTexts = useMemo(
    () => coupons.map(c => c._searchText || (c.title + (c.items ? c.items.join('') : '')).toLowerCase()),
    [coupons]
  );

  // Count matching coupons for each unique menu item name
  const itemCounts = useMemo(() => {
    const counts = new Map<string, number>();
    menuItems.forEach(item => {
      if (!item.name || counts.has(item.name)) return;
      const nameLower = item.name.toLowerCase();
      let count = 0;
      for (const text of couponTexts) {
        if (text.includes(nameLower)) count++;
      }
      counts.set(item.name, count);
    });
    return counts;
  }, [menuItems, couponTexts]);

  // Most popular items, shown as always-visible chips for one-tap filtering.
  // Selected items stay visible even when they fall outside the top list.
  const quickPickItems = useMemo(() => {
    const popular = Array.from(itemCounts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, QUICK_PICK_COUNT)
      .map(([name]) => name);
    const extras = selectedItems.filter(name => !popular.includes(name));
    return [...popular, ...extras].map(name => ({ name, count: itemCounts.get(name) ?? 0 }));
  }, [itemCounts, selectedItems]);

  // Group items by category and deduplicate names within category.
  // Items that match no coupon are hidden — selecting them could only return empty results.
  const categories = useMemo(() => {
    const grouped: Record<string, Set<string>> = {};
    // Preferred order for food categories
    const order = ["大/小比薩", "個人比薩", "拼盤/熱烤", "義大利麵/燉飯", "甜點/飲料"];

    menuItems.forEach(item => {
      // Skip empty names and items with no matching coupons
      if (!item.name) return;
      if ((itemCounts.get(item.name) ?? 0) === 0) return;

      if (!grouped[item.category]) {
        grouped[item.category] = new Set();
      }
      grouped[item.category].add(item.name);
    });

    // Sort categories: specific ones first, then others
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
        const indexA = order.indexOf(a);
        const indexB = order.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    return sortedKeys.map(key => ({
      name: key,
      items: Array.from(grouped[key])
        .map(name => ({ name, count: itemCounts.get(name) ?? 0 }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    }));
  }, [menuItems, itemCounts]);

  const toggleItem = (item: string) => {
    if (selectedItems.includes(item)) {
      onSelectionChange(selectedItems.filter(i => i !== item));
    } else {
      onSelectionChange([...selectedItems, item]);
    }
  };

  const handleDeliveryTypeChange = (type: string) => {
    if (selectedDeliveryTypes.includes(type)) {
      onDeliveryTypesChange(selectedDeliveryTypes.filter(t => t !== type));
    } else {
      onDeliveryTypesChange([...selectedDeliveryTypes, type]);
    }
  };

  const clearFilter = () => {
      onSelectionChange([]);
      onDeliveryTypesChange([]);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
      <div
        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors gap-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <FilterIcon size={20} className="text-red-600" />
          <span className="font-bold text-gray-800">
            想吃什麼？
          </span>
          <span className="text-sm text-gray-500 ml-2">
            (點選餐點來篩選優惠券)
          </span>
        </div>

        <div className="flex items-center gap-4">
             {selectedItems.length > 0 && (
                <div className="flex flex-wrap gap-2 mr-2">
                    {/* Show first few tags summary if collapsed? No, assume expanded usually or just show count */}
                    {!isExpanded && (
                        <span className="text-sm text-red-600 font-medium">
                            {selectedItems.length} 個項目
                        </span>
                    )}
                </div>
             )}
             {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </div>
      </div>

      {/* Quick-select meal chips (always visible) */}
      {quickPickItems.length > 0 && (
        <div className="px-4 pb-4 bg-gray-50 flex flex-wrap items-center gap-2">
          {quickPickItems.map(({ name, count }) => {
            const isSelected = selectedItems.includes(name);
            return (
              <button
                key={name}
                onClick={() => toggleItem(name)}
                aria-pressed={isSelected}
                className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-full text-sm font-medium border cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-red-400 hover:text-red-600'
                }`}
              >
                {name}
                <span className={`text-xs ${isSelected ? 'text-red-100' : 'text-gray-500'}`}>({count})</span>
                {isSelected && <X size={14} className="ml-0.5" />}
              </button>
            );
          })}
          {!isExpanded && (
            <button
              onClick={() => setIsExpanded(true)}
              className="px-2 py-2 text-sm text-gray-500 hover:text-red-600 underline cursor-pointer"
            >
              更多餐點…
            </button>
          )}
          {selectedItems.length > 0 && (
            <button
              onClick={clearFilter}
              className="px-2 py-2 text-sm text-gray-500 hover:text-red-600 underline cursor-pointer"
            >
              清除
            </button>
          )}
        </div>
      )}

      {isExpanded && (
        <div className="p-4 border-t border-gray-200">
            {/* Delivery Type Filter */}
            <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">優惠使用範圍</h2>
                <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={selectedDeliveryTypes.includes('delivery')}
                                onChange={() => handleDeliveryTypeChange('delivery')}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                        </div>
                        <span className={`text-sm font-medium transition-colors ${
                            selectedDeliveryTypes.includes('delivery') ? 'text-blue-700' : 'text-gray-700'
                        }`}>
                            外送
                        </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={selectedDeliveryTypes.includes('takeout')}
                                onChange={() => handleDeliveryTypeChange('takeout')}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                        </div>
                        <span className={`text-sm font-medium transition-colors ${
                            selectedDeliveryTypes.includes('takeout') ? 'text-blue-700' : 'text-gray-700'
                        }`}>
                            外帶
                        </span>
                    </label>
                </div>
            </div>

            {categories.length > 0 && (
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">餐點分類</h2>
                {selectedItems.length > 0 && (
                    <button onClick={clearFilter} className="text-sm text-gray-500 hover:text-red-600 underline">
                        清除所有篩選
                    </button>
                )}
            </div>
            )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8">
            {categories.map((category) => (
              <div key={category.name} className="flex flex-col">
                <h3 className="font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100 flex items-center gap-2">
                    {category.name}
                    <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{category.items.length}</span>
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {category.items.map((item) => (
                    <label key={item.name} className="flex items-start gap-2 cursor-pointer group hover:bg-gray-50 p-1 rounded -ml-1 transition-colors">
                      <div className="relative flex items-center mt-0.5">
                        <input
                            type="checkbox"
                            checked={selectedItems.includes(item.name)}
                            onChange={() => toggleItem(item.name)}
                            className="peer h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                      </div>
                      <span className={`text-sm leading-tight transition-colors ${selectedItems.includes(item.name) ? 'text-red-700 font-medium' : 'text-gray-600 group-hover:text-gray-900'}`}>
                        {item.name}
                        <span className="text-xs text-gray-500 ml-1">({item.count})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Filter;

import React, { useState, useMemo } from 'react';
import { MenuItem } from '../types';
import { ChevronDown, ChevronUp, Filter as FilterIcon, X } from 'lucide-react';

interface FilterProps {
  menuItems: MenuItem[];
  selectedItems: string[];
  onSelectionChange: (items: string[]) => void;
}

const Filter: React.FC<FilterProps> = ({ menuItems, selectedItems, onSelectionChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Group items by category and deduplicate names within category
  const categories = useMemo(() => {
    const grouped: Record<string, Set<string>> = {};
    // Preferred order for food categories
    const order = ["大/小比薩", "個人比薩", "拼盤/熱烤", "義大利麵/燉飯", "甜點/飲料"];

    menuItems.forEach(item => {
      // Skip empty names
      if (!item.name) return;

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
      items: Array.from(grouped[key]).sort()
    }));
  }, [menuItems]);

  const handleCheckboxChange = (item: string) => {
    if (selectedItems.includes(item)) {
      onSelectionChange(selectedItems.filter(i => i !== item));
    } else {
      onSelectionChange([...selectedItems, item]);
    }
  };

  const clearFilter = () => {
      onSelectionChange([]);
  }

  const removeTag = (item: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onSelectionChange(selectedItems.filter(i => i !== item));
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
            (選擇餐點以搜尋包含該項目的優惠券)
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

      {/* Selected Tags Area (Always visible if items selected, or inside expanded?)
          Let's put it inside expanded area or a separate bar.
          Actually, having it visible when collapsed is nice.
      */}
      {!isExpanded && selectedItems.length > 0 && (
          <div className="px-4 pb-3 flex flex-wrap gap-2 bg-gray-50">
              {selectedItems.map(item => (
                  <span key={item} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      {item}
                      <button onClick={(e) => removeTag(item, e)} className="ml-1.5 text-red-600 hover:text-red-900">
                          <X size={12} />
                      </button>
                  </span>
              ))}
              <button onClick={(e) => { e.stopPropagation(); clearFilter(); }} className="text-xs text-gray-500 hover:text-red-600 underline ml-2 self-center">
                  清除
              </button>
          </div>
      )}

      {isExpanded && (
        <div className="p-4 border-t border-gray-200">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">餐點分類</h2>
                {selectedItems.length > 0 && (
                    <button onClick={clearFilter} className="text-sm text-gray-500 hover:text-red-600 underline">
                        清除所有篩選
                    </button>
                )}
            </div>

            {/* Selected Tags inside Expanded View */}
            {selectedItems.length > 0 && (
                <div className="mb-6 flex flex-wrap gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
                    {selectedItems.map(item => (
                        <span key={item} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white border border-red-200 text-red-800 shadow-sm">
                            {item}
                            <button onClick={(e) => removeTag(item, e)} className="ml-2 text-red-400 hover:text-red-700">
                                <X size={14} />
                            </button>
                        </span>
                    ))}
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
                    <label key={item} className="flex items-start gap-2 cursor-pointer group hover:bg-gray-50 p-1 rounded -ml-1 transition-colors">
                      <div className="relative flex items-center mt-0.5">
                        <input
                            type="checkbox"
                            checked={selectedItems.includes(item)}
                            onChange={() => handleCheckboxChange(item)}
                            className="peer h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                      </div>
                      <span className={`text-sm leading-tight transition-colors ${selectedItems.includes(item) ? 'text-red-700 font-medium' : 'text-gray-600 group-hover:text-gray-900'}`}>
                        {item}
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

import React from 'react';

interface HeaderProps {
  lastUpdated?: string;
}

const Header: React.FC<HeaderProps> = ({ lastUpdated }) => {
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
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v6l4 2"></path>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">PizzaHunt</h1>
              <p className="text-xs text-gray-500 hidden sm:block">必勝客優惠券整理</p>
            </div>
          </div>
          {lastUpdated && (
            <div className="text-sm text-gray-600">
              <span className="hidden sm:inline font-medium">最後更新：</span>
              <span className="sm:ml-1">{formatUpdateTime(lastUpdated)}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
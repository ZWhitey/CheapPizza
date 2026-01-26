import React from 'react';
import { TicketPercent } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 p-2 rounded-lg text-white">
              <TicketPercent size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">PizzaHunt</h1>
              <p className="text-xs text-gray-500 hidden sm:block">必勝客優惠券整理</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Optional: Add links to official site or simple status indicators */}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
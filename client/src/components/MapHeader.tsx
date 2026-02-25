import React from 'react';
import { Search } from 'lucide-react';

interface MapHeaderProps {
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
}

const MapHeader: React.FC<MapHeaderProps> = ({ 
  searchQuery, 
  onSearchChange, 
  onSearchSubmit
}) => {
  return (
    <>
      {/* Search bar - Fixed at top with safe area inset */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 flex justify-center items-center" style={{ paddingTop: 'max(env(safe-area-inset-top, 12px), 12px)' }}>
        <div className="flex-1 max-w-md">
          <form onSubmit={onSearchSubmit} className="relative">
            <input 
              type="text" 
              placeholder="Search locations..." 
              className="w-full h-11 px-4 pr-10 rounded-full text-black bg-white/90 backdrop-blur-sm text-sm"
              value={searchQuery}
              onChange={onSearchChange}
            />
            <button className="absolute right-2 top-1/2 transform -translate-y-1/2 text-dark-gray" type="submit">
              <Search className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default MapHeader;

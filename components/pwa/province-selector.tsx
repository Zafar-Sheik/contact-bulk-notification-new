'use client';

import { useState, useEffect } from 'react';

const PROVINCES = [
  'Gauteng',
  'KwaZulu-Natal',
  'Western Cape',
  'Eastern Cape',
  'Free State',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
] as const;

export type Province = typeof PROVINCES[number] | 'unknown';

interface ProvinceSelectorProps {
  onSelect: (province: Province) => void;
  onClose?: () => void;
  isOpen?: boolean;
}

export function ProvinceSelector({ onSelect, onClose, isOpen = true }: ProvinceSelectorProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    setIsVisible(isOpen);
  }, [isOpen]);

  const handleSelect = (province: Province) => {
    if (isSelecting) return; // Prevent spam clicks
    
    setIsSelecting(true);
    onSelect(province);
    localStorage.setItem('userProvince', province);
    setIsVisible(false);
    onClose?.();
    
    // Reset after delay to allow new selections
    setTimeout(() => setIsSelecting(false), 500);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => {
          setIsVisible(false);
          onClose?.();
        }}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 pb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Select Your Province
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            This helps us send you relevant local notifications.
          </p>
        </div>

        {/* Province List */}
        <div className="px-2 pb-6 max-h-[60vh] overflow-y-auto">
          {PROVINCES.map((province) => (
            <button
              key={province}
              onClick={() => handleSelect(province)}
              className="w-full px-4 py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors duration-150 flex items-center justify-between group"
            >
              <span className="font-medium">{province}</span>
              <svg 
                className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>

        {/* Skip Button */}
        <div className="px-6 pb-6">
          <button
            onClick={() => {
              handleSelect('unknown');
            }}
            className="w-full py-3 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage province selection state
 */
export function useProvinceSelection() {
  const [province, setProvince] = useState<Province | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage on mount
    const stored = localStorage.getItem('userProvince');
    if (stored) {
      setProvince(stored as Province);
    }
    setIsLoading(false);
  }, []);

  const selectProvince = (newProvince: Province) => {
    setProvince(newProvince);
    localStorage.setItem('userProvince', newProvince);
    setShowSelector(false);
  };

  const shouldShowSelector = !isLoading && !province;

  return {
    province,
    showSelector,
    isLoading,
    shouldShowSelector,
    selectProvince,
    setShowSelector,
  };
}

export default ProvinceSelector;

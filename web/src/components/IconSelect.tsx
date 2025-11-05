import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface IconSelectOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  iconColor?: string;
  flagUrl?: string;
}

interface IconSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: IconSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
}

export default function IconSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  clearable = false,
}: IconSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options based on search term
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (isOpen) {
        setSearchTerm('');
      }
    }
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Select Button Container */}
      <div className="relative">
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={`w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors flex items-center justify-between ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700'
          } ${clearable && value ? 'pr-20' : ''}`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectedOption ? (
              <>
                {selectedOption.icon && (
                  <selectedOption.icon 
                    size={18} 
                    className={`flex-shrink-0 ${selectedOption.iconColor || ''}`}
                  />
                )}
                {selectedOption.flagUrl && (
                  <img
                    src={selectedOption.flagUrl}
                    alt={selectedOption.label}
                    className="w-5 h-4 object-cover rounded flex-shrink-0"
                  />
                )}
                <span className="truncate">{selectedOption.label}</span>
              </>
            ) : (
              <span className="text-neutral-400 dark:text-neutral-500">{placeholder}</span>
            )}
          </div>
          <ChevronDown
            size={18}
            className={`flex-shrink-0 text-neutral-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
        
        {/* Clear Button - Outside main button */}
        {clearable && value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-10 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors z-10"
            title="Clear selection"
          >
            <X size={14} className="text-neutral-500 dark:text-neutral-400" />
          </button>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg shadow-2xl max-h-80 flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b border-neutral-200 dark:border-neutral-700">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400 text-sm">
                No results found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full px-4 py-2.5 flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-left ${
                    option.value === value ? 'bg-pink-50 dark:bg-pink-900/20' : ''
                  }`}
                >
                  {option.icon && (
                    <option.icon
                      size={18}
                      className={`flex-shrink-0 ${
                        option.iconColor 
                          ? option.iconColor 
                          : option.value === value
                          ? 'text-pink-600 dark:text-pink-400'
                          : 'text-neutral-600 dark:text-neutral-400'
                      }`}
                    />
                  )}
                  {option.flagUrl && (
                    <img
                      src={option.flagUrl}
                      alt={option.label}
                      className="w-5 h-4 object-cover rounded flex-shrink-0"
                    />
                  )}
                  <span
                    className={`flex-1 truncate ${
                      option.value === value
                        ? 'text-pink-600 dark:text-pink-400 font-medium'
                        : 'text-neutral-900 dark:text-neutral-100'
                    }`}
                  >
                    {option.label}
                  </span>
                  {option.value === value && (
                    <Check size={18} className="flex-shrink-0 text-pink-600 dark:text-pink-400" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

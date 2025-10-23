import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Globe } from 'lucide-react';
import { useCountry, Country } from '../store/country';

interface CountrySelectorProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  disabled?: boolean;
}

interface DropdownPortalProps {
  isOpen: boolean;
  buttonRef: React.RefObject<HTMLButtonElement>;
  children: React.ReactNode;
  onClose: () => void;
}

const DropdownPortal: React.FC<DropdownPortalProps> = ({ isOpen, buttonRef, children, onClose }) => {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePosition = () => {
      const buttonRect = buttonRef.current!.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;

      // 计算下拉菜单的预估高度
      const estimatedDropdownHeight = 300;
      const spaceBelow = viewportHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;

      // 智能选择展开方向
      const shouldOpenUpward = spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow;

      // 计算绝对位置
      let top = shouldOpenUpward 
        ? buttonRect.top + scrollY - estimatedDropdownHeight
        : buttonRect.bottom + scrollY + 4;

      let left = buttonRect.left + scrollX;

      // 水平边界检测和调整
      const dropdownWidth = buttonRect.width;
      if (left + dropdownWidth > viewportWidth) {
        left = viewportWidth - dropdownWidth - 8;
      }
      if (left < 8) {
        left = 8;
      }

      // 垂直边界检测和调整
      if (shouldOpenUpward && top < scrollY + 8) {
        top = buttonRect.bottom + scrollY + 4;
      } else if (!shouldOpenUpward && top + estimatedDropdownHeight > scrollY + viewportHeight - 8) {
        top = buttonRect.top + scrollY - estimatedDropdownHeight;
      }

      setPosition({
        top,
        left,
        width: buttonRect.width
      });
    };

    updatePosition();

    // 监听滚动和窗口大小变化
    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, buttonRef]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-[9999] bg-white border border-gray-300 rounded-lg shadow-lg max-h-[300px] overflow-y-auto"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        minWidth: '200px'
      }}
    >
      {children}
    </div>,
    document.body
  );
};

const CountrySelector: React.FC<CountrySelectorProps> = ({
  className = '',
  size = 'md',
  showLabel = true,
  disabled = false
}) => {
  const { selectedCountry, setSelectedCountry, countries } = useCountry();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 过滤国家列表
  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 处理国家选择
  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearchTerm('');
    setFocusedIndex(-1);
  };

  // 处理键盘事件
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        if (isOpen && focusedIndex >= 0 && focusedIndex < filteredCountries.length) {
          handleCountrySelect(filteredCountries[focusedIndex]);
        } else {
          setIsOpen(!isOpen);
        }
        break;
      case ' ':
        if (!isOpen) {
          event.preventDefault();
          setIsOpen(true);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        setFocusedIndex(-1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex(prev => 
            prev < filteredCountries.length - 1 ? prev + 1 : 0
          );
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) {
          setFocusedIndex(prev => 
            prev > 0 ? prev - 1 : filteredCountries.length - 1
          );
        }
        break;
    }
  };

  // 当下拉菜单打开时，自动聚焦搜索框
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // 尺寸样式映射
  const sizeClasses = {
    sm: {
      button: 'h-8 px-2 text-sm',
      flag: 'text-sm',
      text: 'text-sm'
    },
    md: {
      button: 'h-10 px-3 text-base',
      flag: 'text-base',
      text: 'text-base'
    },
    lg: {
      button: 'h-12 px-4 text-lg',
      flag: 'text-lg',
      text: 'text-lg'
    }
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          ${currentSize.button}
          flex items-center justify-between
          bg-white border border-gray-300 rounded-lg
          hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isOpen ? 'ring-2 ring-blue-500 border-transparent' : ''}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="选择国家"
      >
        <div className="flex items-center space-x-2 min-w-0">
          <Globe className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className={`${currentSize.flag} flex-shrink-0`}>
            {selectedCountry.flag}
          </span>
          {showLabel && (
            <span className={`${currentSize.text} text-gray-700 truncate`}>
              {selectedCountry.name}
            </span>
          )}
        </div>
        <ChevronDown 
          className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`} 
        />
      </button>

      <DropdownPortal
        isOpen={isOpen}
        buttonRef={buttonRef}
        onClose={() => {
          setIsOpen(false);
          setSearchTerm('');
          setFocusedIndex(-1);
        }}
      >
        <div className="p-2">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="搜索国家..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setFocusedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
        
        <div className="max-h-48 overflow-y-auto">
          {filteredCountries.length === 0 ? (
            <div className="px-3 py-2 text-gray-500 text-sm">
              未找到匹配的国家
            </div>
          ) : (
            filteredCountries.map((country, index) => (
              <button
                key={country.code}
                type="button"
                onClick={() => handleCountrySelect(country)}
                onMouseEnter={() => setFocusedIndex(index)}
                className={`
                  w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none
                  flex items-center space-x-3 transition-colors duration-150
                  ${focusedIndex === index ? 'bg-gray-100' : ''}
                  ${selectedCountry.code === country.code ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
                `}
                role="option"
                aria-selected={selectedCountry.code === country.code}
              >
                <span className={`${currentSize.flag} flex-shrink-0`}>
                  {country.flag}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`${currentSize.text} font-medium truncate`}>
                    {country.name}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    +{country.phonePrefix}
                  </div>
                </div>
                {selectedCountry.code === country.code && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      </DropdownPortal>
    </div>
  );
};

export default CountrySelector;
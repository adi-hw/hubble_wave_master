import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  value: string[]; // Array of selected values
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  value = [],
  onChange,
  placeholder = 'Select options...',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  const removeOption = (e: React.MouseEvent, optionValue: string) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== optionValue));
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger */}
      <div
        className={`min-h-[38px] w-full px-3 py-1.5 rounded-lg cursor-pointer flex items-center justify-between transition-colors bg-card border border-border ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex flex-wrap gap-1.5">
          {value.length > 0 ? (
            value.map((v) => {
              const label = options.find((o) => o.value === v)?.label || v;
              return (
                <span
                  key={v}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary"
                >
                  {label}
                  <button
                    type="button"
                    onClick={(e) => removeOption(e, v)}
                    className="ml-1 focus:outline-none text-primary"
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })
          ) : (
            <span className="text-sm text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`transition-transform text-muted-foreground ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div
          className="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-auto bg-card border border-border"
        >
          {options.length > 0 ? (
            options.map((option) => {
              const isSelected = value.includes(option.value);
              return (
                <div
                  key={option.value}
                  className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between transition-colors ${isSelected ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}
                  onClick={() => toggleOption(option.value)}
                >
                  <span>{option.label}</span>
                  {isSelected && <Check size={16} />}
                </div>
              );
            })
          ) : (
            <div className="px-3 py-2 text-sm text-center text-muted-foreground">
              No options available
            </div>
          )}
        </div>
      )}
    </div>
  );
};

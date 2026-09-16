"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TextField, Spinner } from "./TextField";

interface AutocompleteProps<T> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (option: T) => void;
  options: T[];
  getOptionKey: (option: T) => string;
  renderOption: (option: T) => ReactNode;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  isLoading?: boolean;
  emptyMessage?: string;
  onBlur?: () => void;
  maxLength?: number;
}

/**
 * Text input with advisory suggestion dropdown for Nova Poshta city and warehouse selection.
 *
 * NOTE: (§1.2, §5.1, §5.2) Keeps input free-form for graceful fallback during carrier directory unavailability.
 */
export function Autocomplete<T>({
  label,
  value,
  onChange,
  onSelect,
  options,
  getOptionKey,
  renderOption,
  placeholder,
  error,
  disabled,
  isLoading,
  emptyMessage,
  onBlur,
  maxLength = 150,
}: AutocompleteProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const showEmpty = isOpen && !isLoading && options.length === 0 && value.trim().length >= 2;

  /** Active suggestion selection state. */
  const isChoosing = isOpen && options.length > 0;

  // Suppresses error text visibility while dropdown menu is actively open.
  const isFieldInUse = isOpen;

  return (
    <div className="relative" ref={containerRef}>
      <TextField
        label={label}
        value={value}
        placeholder={placeholder}
        error={isFieldInUse ? undefined : error}
        disabled={disabled}
        maxLength={maxLength}
        adornment={isLoading ? <Spinner /> : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={onBlur}
        autoComplete="off"
      />

      {isChoosing && (
        <ul className="absolute left-0 right-0 mt-1 bg-white border border-neutral-300 max-h-56 overflow-y-auto z-50 text-sm divide-y divide-neutral-100">
          {options.map((option) => (
            <li
              key={getOptionKey(option)}
              onClick={() => {
                onSelect(option);
                setIsOpen(false);
              }}
              className="px-4 py-2.5 hover:bg-neutral-50 cursor-pointer transition-colors leading-snug"
            >
              {renderOption(option)}
            </li>
          ))}
        </ul>
      )}

      {showEmpty && emptyMessage && (
        <p className="text-[10px] text-ink-3 mt-1 font-semibold">{emptyMessage}</p>
      )}
    </div>
  );
}


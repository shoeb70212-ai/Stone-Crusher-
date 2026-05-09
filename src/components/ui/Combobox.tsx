import React, { useState, useRef, useEffect } from "react";
import { Check, Plus, Search, X } from "lucide-react";

interface ComboboxProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  allowCreate?: boolean;
  mobileTitle?: string;
  emptyText?: string;
  clearable?: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select...",
  className = "",
  allowCreate = false,
  mobileTitle,
  emptyText = "No results found",
  clearable = false,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [opensUp, setOpensUp] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [freqs, setFreqs] = useState<Record<string, number>>({});

  const selectedOption = options.find((o) => o.value === value);
  const displayValue = selectedOption
    ? selectedOption.label
    : allowCreate && value.startsWith("NEW:")
      ? value.slice("NEW:".length).trim()
      : allowCreate
        ? value
        : "";

  useEffect(() => {
    if (isOpen) {
      try {
        const usageKey = `combobox_freq_${mobileTitle || placeholder || "generic"}`;
        setFreqs(JSON.parse(localStorage.getItem(usageKey) || "{}"));
      } catch (e) {
        // ignore
      }
    }
  }, [isOpen, mobileTitle, placeholder]);

  useEffect(() => {
    if (!isOpen) {
      setSearch(displayValue);
    }
  }, [isOpen, displayValue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = 240;
    setOpensUp(spaceBelow < dropdownHeight && rect.top > dropdownHeight);
  }, [isOpen]);

  const normalizedSearch = search.toLowerCase().replace(/[\s\-\.]+/g, "");
  
  const sortedOptions = React.useMemo(() => {
    return [...options].sort((a, b) => {
      const freqA = freqs[a.value] || 0;
      const freqB = freqs[b.value] || 0;
      return freqB - freqA;
    });
  }, [options, freqs]);

  const filteredOptions = sortedOptions.filter((o) =>
    o.label.toLowerCase().replace(/[\s\-\.]+/g, "").includes(normalizedSearch),
  ).slice(0, 5);

  const handleCreate = () => {
    if (allowCreate && search.trim()) {
      onChange(`NEW:${search.trim()}`);
      setIsOpen(false);
    }
  };

  const handleSelect = (option: { label: string; value: string }) => {
    try {
      const usageKey = `combobox_freq_${mobileTitle || placeholder || "generic"}`;
      const currentFreqs = JSON.parse(localStorage.getItem(usageKey) || "{}");
      currentFreqs[option.value] = (currentFreqs[option.value] || 0) + 1;
      localStorage.setItem(usageKey, JSON.stringify(currentFreqs));
    } catch (e) {
      // ignore
    }
    
    onChange(option.value);
    setSearch(option.label);
    setIsOpen(false);
  };

  const openPicker = () => {
    setSearch(displayValue);
    setIsOpen(true);
  };

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          value={isOpen ? search : displayValue}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && allowCreate && filteredOptions.length === 0) {
              e.preventDefault();
              handleCreate();
            }
          }}
          onClick={openPicker}
          className="w-full min-h-11 border border-zinc-300 dark:border-zinc-600 rounded-xl px-4 py-2.5 pr-10 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
          placeholder={placeholder}
        />
        {clearable && displayValue && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setSearch("");
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
            aria-label="Clear selection"
          >
            <X className="mx-auto h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <ul className={`absolute z-50 w-full max-h-60 overflow-auto bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg ${opensUp ? "bottom-full mb-1" : "top-full mt-1"}`}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <li
                key={option.value}
                onClick={() => handleSelect(option)}
                className={`px-4 py-2 text-sm cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                  option.value === value ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium" : "text-zinc-700 dark:text-zinc-200"
                }`}
              >
                {option.label}
              </li>
            ))
          ) : allowCreate ? (
            <li
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCreate}
              className="px-4 py-3 text-sm text-primary-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer font-medium"
            >
              Create "{search}"
            </li>
          ) : (
            <li className="px-4 py-3 text-sm text-zinc-500 text-center">{emptyText}</li>
          )}
        </ul>
      )}
    </div>
  );
}

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

function useCompactPicker() {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setIsCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isCompact;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const isCompactPicker = useCompactPicker();

  const selectedOption = options.find((o) => o.value === value);
  const displayValue = selectedOption
    ? selectedOption.label
    : allowCreate && value.startsWith("NEW:")
      ? value.slice("NEW:".length)
      : allowCreate
        ? value
        : "";

  useEffect(() => {
    if (!isOpen) {
      setSearch(displayValue);
    }
  }, [isOpen, displayValue]);

  useEffect(() => {
    if (!isOpen) return;
    if (isCompactPicker) {
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => {
      if (isCompactPicker) document.body.style.overflow = "";
    };
  }, [isOpen, isCompactPicker]);

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
    if (!isOpen || !wrapperRef.current || isCompactPicker) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = 240;
    setOpensUp(spaceBelow < dropdownHeight && rect.top > dropdownHeight);
  }, [isOpen, isCompactPicker]);

  const normalizedSearch = search.toLowerCase().replace(/\s+/g, "");
  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().replace(/\s+/g, "").includes(normalizedSearch),
  );

  const handleCreate = () => {
    if (allowCreate && search.trim()) {
      onChange(`NEW:${search.trim()}`);
      setIsOpen(false);
    }
  };

  const handleSelect = (option: { label: string; value: string }) => {
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
          value={isOpen && !isCompactPicker ? search : displayValue}
          readOnly={isCompactPicker}
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

      {isOpen && !isCompactPicker && (
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

      {isOpen && isCompactPicker && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end md:hidden">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative flex max-h-[82dvh] flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-900">
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            </div>
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 pb-3 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                {mobileTitle || placeholder}
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b border-zinc-100 p-3 dark:border-zinc-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full min-h-11 rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  placeholder="Search"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`flex min-h-12 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold ${
                      option.value === value
                        ? "bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300"
                        : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {option.value === value && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                ))
              ) : allowCreate && search.trim() ? (
                <button
                  type="button"
                  onClick={handleCreate}
                  className="flex min-h-12 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-primary-700 dark:text-primary-300"
                >
                  <Plus className="h-4 w-4" />
                  Create "{search.trim()}"
                </button>
              ) : (
                <div className="py-8 text-center text-sm text-zinc-500">{emptyText}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

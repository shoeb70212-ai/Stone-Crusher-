import React, { useState, useRef, useEffect } from "react";

interface ComboboxProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  allowCreate?: boolean;
}

export function Combobox({ options, value, onChange, placeholder = "Select...", className = "", allowCreate = false }: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    if (!isOpen) {
      if (allowCreate) {
        setSearch(value);
      } else {
        setSearch(selectedOption ? selectedOption.label : "");
      }
    }
  }, [isOpen, selectedOption, value, allowCreate]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (allowCreate && search.trim()) {
      onChange(search.trim());
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <input
        type="text"
        value={isOpen ? search : (selectedOption ? selectedOption.label : (allowCreate ? value : ""))}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && allowCreate && filteredOptions.length === 0) {
            e.preventDefault();
            handleCreate();
          }
        }}
        onClick={() => setIsOpen(true)}
        className="w-full border border-zinc-300 dark:border-zinc-600 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
        placeholder={placeholder}
      />
      {isOpen && (
        <ul className="absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <li
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setSearch(option.label);
                  setIsOpen(false);
                }}
                className={`px-4 py-2 text-sm cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                  option.value === value ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium" : "text-zinc-700 dark:text-zinc-200"
                }`}
              >
                {option.label}
              </li>
            ))
          ) : (
            allowCreate ? (
              <li 
                onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
                onClick={handleCreate}
                className="px-4 py-3 text-sm text-primary-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer font-medium"
              >
                Create "{search}"
              </li>
            ) : (
              <li className="px-4 py-3 text-sm text-zinc-500 text-center">
                No results found
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

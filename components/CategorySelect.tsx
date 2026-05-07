"use client";

import { useEffect, useRef, useState } from "react";
import { SearchCategory } from "@/types";
import { CATEGORY_META } from "@/lib/categories";

interface Props {
  value: SearchCategory;
  onChange: (value: SearchCategory) => void;
  className?: string;
}

const CATEGORIES: SearchCategory[] = [
  "accommodation",
  "tour",
  "restaurant",
  "activity",
  "attraction",
];

export default function CategorySelect({ value, onChange, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selected = CATEGORY_META[value];

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 whitespace-nowrap text-sm rounded-lg border px-2.5 py-2 focus:outline-none transition-colors
          bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700
          text-gray-800 dark:text-gray-200
          hover:border-gray-400 dark:hover:border-gray-600"
      >
        <span>{selected.icon}</span>
        <span className="font-medium">{selected.label}</span>
        <span className="text-gray-400 dark:text-gray-600 text-[10px] ml-0.5">▾</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-52
          bg-white dark:bg-gray-900
          border border-gray-200 dark:border-gray-700
          rounded-xl shadow-xl overflow-hidden">
          {CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const isActive = cat === value;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => { onChange(cat); setOpen(false); }}
                className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors
                  ${isActive
                    ? "bg-blue-50 dark:bg-blue-900/30"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
              >
                <span className="text-base mt-0.5 flex-shrink-0">{meta.icon}</span>
                <span className="flex flex-col">
                  <span className={`text-sm font-medium leading-tight ${isActive ? "text-blue-700 dark:text-blue-300" : "text-gray-800 dark:text-gray-200"}`}>
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug mt-0.5">
                    {meta.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

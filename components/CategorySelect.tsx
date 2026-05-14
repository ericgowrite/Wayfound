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
          bg-white dark:bg-[#1e2d3d] border-[#E0E8ED] dark:border-[#3D5A6E]
          text-[#2C3E50] dark:text-[#B8D4E3]
          hover:border-[#9BB0C1] dark:hover:border-[#4A6275]"
      >
        <span>{selected.icon}</span>
        <span className="font-medium">{selected.label}</span>
        <span className="text-[#9BB0C1] dark:text-[#6B8299] text-[10px] ml-0.5">▾</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-52
          bg-white dark:bg-[#1e2d3d]
          border border-[#E0E8ED] dark:border-[#3D5A6E]
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
                    ? "bg-[#5B8BA0]/8 dark:bg-[#5B8BA0]/15"
                    : "hover:bg-[#F8FAFB] dark:hover:bg-[#2a3f52]"
                  }`}
              >
                <span className="text-base mt-0.5 flex-shrink-0">{meta.icon}</span>
                <span className="flex flex-col">
                  <span className={`text-sm font-medium leading-tight ${isActive ? "text-[#5B8BA0] dark:text-[#7DBAD4]" : "text-[#2C3E50] dark:text-[#B8D4E3]"}`}>
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-[#9BB0C1] dark:text-[#6B8299] leading-snug mt-0.5">
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

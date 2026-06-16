"use client";

import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  emptyMessage?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = "", emptyMessage, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            {label}
          </label>
        )}
        {options.length === 0 && emptyMessage ? (
          <div className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/30 text-sm italic">
            {emptyMessage}
          </div>
        ) : (
          <select
            ref={ref}
            className={`w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white
              focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all appearance-none
              ${error ? "border-red-500/50" : ""}
              ${className}`}
            style={{ colorScheme: "dark" }}
            {...props}
          >
            <option value="" className="bg-zinc-950 text-zinc-400">Selecione...</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-zinc-950 text-white">
                {opt.label}
              </option>
            ))}
          </select>
        )}
        {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";

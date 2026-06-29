"use client";

import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  emptyMessage?: string;
  loading?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = "", emptyMessage, loading = false, disabled, ...props }, ref) => {
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
          <div className="relative">
            <select
              ref={ref}
              className={`w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white
                focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all appearance-none
                ${loading ? "opacity-60 cursor-wait" : ""}
                ${error ? "border-red-500/50" : ""}
                ${className}`}
              style={{ colorScheme: "dark" }}
              disabled={loading || disabled}
              {...props}
            >
              <option value="" className="bg-zinc-950 text-zinc-400">Selecione...</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-zinc-950 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="animate-spin h-4 w-4 text-white/30" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
          </div>
        )}
        {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";

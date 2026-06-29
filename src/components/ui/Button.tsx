"use client";

import { ButtonHTMLAttributes } from "react";

type ButtonSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  size?: ButtonSize;
}

export function Button({
  children,
  variant = "primary",
  loading = false,
  size = "md",
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const variants = {
    primary: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20",
    secondary: "bg-white/10 hover:bg-white/15 text-white border border-white/10",
    danger: "bg-red-600/80 hover:bg-red-600 text-white",
    ghost: "bg-transparent hover:bg-white/5 text-white/70 hover:text-white",
  };

  return (
    <button
      className={`${SIZE_CLASSES[size]} rounded-xl font-medium transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2
        ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

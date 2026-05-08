"use client";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function GlassCard({ children, className = "", onClick }: GlassCardProps) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      onClick={onClick}
      className={`bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-xl text-left ${className}`}
    >
      {children}
    </Component>
  );
}

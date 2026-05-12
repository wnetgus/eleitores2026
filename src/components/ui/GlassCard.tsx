"use client";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function GlassCard({ children, className = "", style, onClick }: GlassCardProps) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      onClick={onClick}
      style={style}
      className={`bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-xl text-left ${className}`}
    >
      {children}
    </Component>
  );
}

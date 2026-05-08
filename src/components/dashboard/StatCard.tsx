"use client";

import { useEffect, useState } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  delay?: number;
}

export function StatCard({ title, value, icon, trend, delay = 0 }: StatCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 shadow-xl
        transition-all duration-500 hover:border-white/[0.12] hover:bg-white/[0.05]
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-white/50 font-medium">{title}</p>
          <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
          {trend && (
            <div className="flex items-center gap-1">
              <span className={`text-xs font-medium ${trend.positive ? "text-emerald-400" : "text-red-400"}`}>
                {trend.positive ? "↑" : "↓"} {trend.value}
              </span>
              <span className="text-xs text-white/30">vs ontem</span>
            </div>
          )}
        </div>
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          {icon}
        </div>
      </div>
    </div>
  );
}

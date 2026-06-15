"use client";

import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";

const COLORS = ["#10b981", "#06b6d4", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

interface Props {
  data: { estado: string; total: number }[];
}

export function ApoiadoresPorEstado({ data }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <GlassCard className="p-5">
      <h3 className="text-white font-semibold mb-4">Apoiadores por Estado</h3>
      <div className="h-64 min-w-0">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="total" nameKey="estado" cx="50%" cy="50%" outerRadius={80} label>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, color: "#fff" }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </GlassCard>
  );
}

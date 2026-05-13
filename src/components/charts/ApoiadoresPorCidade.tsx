"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";

interface Props {
  data: { cidade: string; total: number }[];
}

export function ApoiadoresPorCidade({ data }: Props) {
  return (
    <GlassCard className="p-5">
      <h3 className="text-white font-semibold mb-4">Apoiadores por Cidade</h3>
      <div className="h-64 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <XAxis type="number" stroke="rgba(255,255,255,0.1)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} />
            <YAxis dataKey="cidade" type="category" stroke="rgba(255,255,255,0.1)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} width={100} />
            <Tooltip
              contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, color: "#fff" }}
            />
            <Bar dataKey="total" fill="#10b981" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}

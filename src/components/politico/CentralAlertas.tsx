"use client";

import { AlertaExecutivo, CardAlerta } from "./CardAlerta";

export type { AlertaExecutivo };

export function CentralAlertas({ alertas }: { alertas: AlertaExecutivo[] }) {
  if (alertas.length === 0) return null;

  const criticos      = alertas.filter((a) => a.tipo === "critico").length;
  const oportunidades = alertas.filter((a) => a.tipo === "oportunidade").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">🔔</span>
            <h3 className="text-white font-semibold">Central de Alertas</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/10">
              {alertas.length} {alertas.length === 1 ? "alerta" : "alertas"}
            </span>
          </div>
          <p className="text-xs text-white/30 mt-0.5 ml-7">
            Eventos recentes e pontos que exigem atenção do mandato.
          </p>
        </div>
        <div className="text-right shrink-0 space-y-0.5">
          {criticos > 0 && (
            <p className="text-xs text-red-400/70">{criticos} crítico{criticos !== 1 ? "s" : ""}</p>
          )}
          {oportunidades > 0 && (
            <p className="text-xs text-blue-400/60">{oportunidades} oportunidade{oportunidades !== 1 ? "s" : ""}</p>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {alertas.map((a, i) => (
          <CardAlerta key={i} alerta={a} />
        ))}
      </div>
    </div>
  );
}

"use client";

import { AgendaItem, CardAgenda } from "./CardAgenda";

export type { AgendaItem };

const GROUPS: {
  status: AgendaItem["status"];
  icon: string;
  label: string;
  badgeLabel?: string;
}[] = [
  { status: "hoje",        icon: "🔴", label: "HOJE"         },
  { status: "esta_semana", icon: "🟡", label: "ESTA SEMANA"  },
  { status: "concluida",   icon: "🟢", label: "CONCLUÍDAS",  badgeLabel: "FINALIZADA" },
];

export function AgendaExecutiva({ items, prioridadeMunicipio }: { items: AgendaItem[]; prioridadeMunicipio?: Record<string, number> }) {
  if (items.length === 0) return null;

  const criticas   = items.filter((i) => i.prioridade === "critica").length;
  const concluidas = items.filter((i) => i.status === "concluida").length;
  const estaSemana = items.filter((i) => i.status === "esta_semana").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">📅</span>
            <h3 className="text-white font-semibold">Agenda Executiva</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/10">
              {items.length} {items.length === 1 ? "ação" : "ações"}
            </span>
          </div>
          <p className="text-xs text-white/30 mt-0.5 ml-7">
            Prioridades políticas e ações recomendadas para o mandato.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {criticas > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              🔴 {criticas} crítica{criticas !== 1 ? "s" : ""}
            </span>
          )}
          {estaSemana > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              🟡 {estaSemana} esta semana
            </span>
          )}
          {concluidas > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ✅ {concluidas} concluída{concluidas !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Grupos */}
      {GROUPS.map((group) => {
        const groupItems = items.filter((i) => i.status === group.status);
        if (groupItems.length === 0) return null;
        const isHoje = group.status === "hoje";
        return (
          <div
            key={group.status}
            className={isHoje ? "p-3 rounded-2xl bg-red-950/20 border border-red-500/20" : ""}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm">{group.icon}</span>
              <p className="text-xs font-bold text-white/50 uppercase tracking-wider">{group.label}</p>
              <span className="text-xs text-white/20">({groupItems.length})</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {groupItems.map((item) => (
                <CardAgenda key={`${item.cidade}-${item.titulo}`} item={item} badgeLabel={group.badgeLabel} prioridadeMunicipio={prioridadeMunicipio} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

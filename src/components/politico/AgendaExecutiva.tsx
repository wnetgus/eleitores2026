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

export function AgendaExecutiva({ items }: { items: AgendaItem[] }) {
  if (items.length === 0) return null;

  const criticas  = items.filter((i) => i.prioridade === "critica").length;
  const concluidas = items.filter((i) => i.status === "concluida").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
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
        <div className="text-right shrink-0 space-y-0.5">
          {criticas > 0 && (
            <p className="text-xs text-red-400/70">{criticas} crítica{criticas !== 1 ? "s" : ""}</p>
          )}
          {concluidas > 0 && (
            <p className="text-xs text-emerald-400/60">{concluidas} concluída{concluidas !== 1 ? "s" : ""}</p>
          )}
        </div>
      </div>

      {/* Grupos */}
      {GROUPS.map((group) => {
        const groupItems = items.filter((i) => i.status === group.status);
        if (groupItems.length === 0) return null;
        return (
          <div key={group.status}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm">{group.icon}</span>
              <p className="text-xs font-bold text-white/50 uppercase tracking-wider">{group.label}</p>
              <span className="text-xs text-white/20">({groupItems.length})</span>
            </div>
            <div className="space-y-2">
              {groupItems.map((item) => (
                <CardAgenda key={`${item.cidade}-${item.titulo}`} item={item} badgeLabel={group.badgeLabel} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

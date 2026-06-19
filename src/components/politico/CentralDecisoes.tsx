"use client";

import { DecisaoPolitica, CardDecisao } from "./CardDecisao";

export type { DecisaoPolitica };

const STATUS_ORDER: DecisaoPolitica["status"][] = ["atrasada", "em_andamento", "planejada", "concluida"];

const GROUP_LABEL: Record<DecisaoPolitica["status"], { icon: string; label: string }> = {
  atrasada:     { icon: "🔴", label: "ATRASADAS"    },
  em_andamento: { icon: "🟡", label: "EM ANDAMENTO" },
  planejada:    { icon: "⚪", label: "PLANEJADAS"   },
  concluida:    { icon: "🟢", label: "CONCLUÍDAS"   },
};

type Props = { decisoes: DecisaoPolitica[]; prioridadeMunicipio?: Record<string, number> };

export function CentralDecisoes({ decisoes, prioridadeMunicipio }: Props) {
  if (decisoes.length === 0) return null;

  const total       = decisoes.length;
  const concluidas  = decisoes.filter((d) => d.status === "concluida").length;
  const atrasadas   = decisoes.filter((d) => d.status === "atrasada").length;
  const emAndamento = decisoes.filter((d) => d.status === "em_andamento").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">🧠</span>
            <h3 className="text-white font-semibold">Central de Decisões</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/10">
              {total} {total === 1 ? "decisão" : "decisões"}
            </span>
          </div>
          <p className="text-xs text-white/30 mt-0.5 ml-7">
            Memória política e acompanhamento estratégico do mandato.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {atrasadas > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              🔴 {atrasadas} atrasada{atrasadas !== 1 ? "s" : ""}
            </span>
          )}
          {emAndamento > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              🟡 {emAndamento} em andamento
            </span>
          )}
          {concluidas > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ✅ {concluidas} concluída{concluidas !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Grupos por status */}
      {STATUS_ORDER.map((status) => {
        const grupo = decisoes.filter((d) => d.status === status);
        if (grupo.length === 0) return null;
        const { icon, label } = GROUP_LABEL[status];
        return (
          <div key={status}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm">{icon}</span>
              <p className="text-xs font-bold text-white/50 uppercase tracking-wider">{label}</p>
              <span className="text-xs text-white/20">({grupo.length})</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {grupo.map((d) => (
                <CardDecisao key={`${d.cidade}-${d.titulo}`} d={d} prioridadeMunicipio={prioridadeMunicipio} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

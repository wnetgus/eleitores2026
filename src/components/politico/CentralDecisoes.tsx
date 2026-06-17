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

type Props = { decisoes: DecisaoPolitica[] };

export function CentralDecisoes({ decisoes }: Props) {
  if (decisoes.length === 0) return null;

  const total = decisoes.length;
  const atrasadas = decisoes.filter((d) => d.status === "concluida").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
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
        {atrasadas > 0 && (
          <span className="shrink-0 text-xs text-emerald-400/60">{atrasadas} concluída{atrasadas !== 1 ? "s" : ""}</span>
        )}
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
            <div className="space-y-2">
              {grupo.map((d) => (
                <CardDecisao key={`${d.cidade}-${d.titulo}`} d={d} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

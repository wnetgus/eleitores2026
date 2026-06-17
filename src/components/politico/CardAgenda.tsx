"use client";

export type AgendaItem = {
  cidade: string;
  titulo: string;
  descricao: string;
  responsavel: string;
  prioridade: "critica" | "alta" | "normal";
  status: "hoje" | "esta_semana" | "concluida";
};

const PRIORIDADE_CFG = {
  critica: { label: "CRÍTICA",  bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/20",     hoverBorder: "hover:border-red-500/60"     },
  alta:    { label: "ALTA",     bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/20",   hoverBorder: "hover:border-amber-500/60"   },
  normal:  { label: "NORMAL",   bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", hoverBorder: "hover:border-emerald-500/60" },
};

export function CardAgenda({ item, badgeLabel }: { item: AgendaItem; badgeLabel?: string }) {
  const cfg = PRIORIDADE_CFG[item.prioridade];
  return (
    <div className={`p-4 rounded-2xl bg-zinc-900 border ${cfg.border} ${cfg.hoverBorder} transition-all`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-white truncate">{item.titulo}</p>
            <span className="text-xs text-white/30 shrink-0">· {item.cidade}</span>
          </div>
          <p className="text-xs text-white/40 mb-2">{item.descricao}</p>
          <p className="text-xs text-white/25">Responsável: <span className="text-white/40">{item.responsavel}</span></p>
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
          {badgeLabel ?? cfg.label}
        </span>
      </div>
    </div>
  );
}

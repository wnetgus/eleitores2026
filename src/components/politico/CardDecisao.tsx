"use client";

export type DecisaoPolitica = {
  cidade: string;
  titulo: string;
  descricao: string;
  responsavel: string;
  criadoEm: string;
  prazoDias: number;
  status: "planejada" | "em_andamento" | "atrasada" | "concluida";
  historico: string[];
};

const STATUS_CONFIG = {
  planejada:    { label: "Planejada",    bg: "bg-zinc-500/10",    text: "text-zinc-400",    border: "border-zinc-500/20",    cardBorder: "border-zinc-500/15"    },
  em_andamento: { label: "Em andamento", bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/20",   cardBorder: "border-amber-500/20"   },
  atrasada:     { label: "Atrasada",     bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/20",     cardBorder: "border-red-500/20"     },
  concluida:    { label: "Concluída",    bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", cardBorder: "border-emerald-500/20" },
};

const TIMELINE_STEPS = ["Pendência criada", "Plano aprovado", "Execução", "Concluída"] as const;

const STATUS_TO_IDX: Record<DecisaoPolitica["status"], number> = {
  planejada:    0,
  em_andamento: 2,
  atrasada:     2,
  concluida:    4,
};

function Timeline({ status }: { status: DecisaoPolitica["status"] }) {
  const currentIdx = STATUS_TO_IDX[status];
  const isAllDone = status === "concluida";
  const isAtrasada = status === "atrasada";

  return (
    <div className="mt-3">
      {TIMELINE_STEPS.map((step, idx) => {
        const isDone = isAllDone || idx < currentIdx;
        const isCurrent = !isAllDone && idx === currentIdx;
        const isLast = idx === TIMELINE_STEPS.length - 1;

        const dotCls = isDone
          ? "bg-emerald-500 text-white"
          : isCurrent && isAtrasada
          ? "bg-red-500 text-white"
          : isCurrent
          ? "bg-amber-500 text-white"
          : "border border-white/15 bg-transparent";

        const textCls = isDone
          ? "text-emerald-400"
          : isCurrent && isAtrasada
          ? "text-red-400"
          : isCurrent
          ? "text-amber-400"
          : "text-white/20";

        return (
          <div key={step} className="flex items-start gap-2">
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold ${dotCls}`}>
                {isDone ? "✓" : ""}
              </div>
              {!isLast && <div className="w-px h-3.5 bg-white/[0.07]" />}
            </div>
            <p className={`text-[11px] leading-tight mt-0.5 ${textCls}`}>
              {step}{isDone ? " ✓" : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function CardDecisao({ d }: { d: DecisaoPolitica }) {
  const cfg = STATUS_CONFIG[d.status];

  return (
    <div className={`p-4 rounded-2xl bg-zinc-900 border ${cfg.cardBorder}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-white truncate">{d.titulo}</p>
            <span className="text-xs text-white/30 shrink-0">· {d.cidade}</span>
          </div>
          <p className="text-xs text-white/40">{d.descricao}</p>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
          {cfg.label}
        </span>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/30 mb-3">
        <span>Responsável: <span className="text-white/50">{d.responsavel}</span></span>
        <span>Criado em: <span className="text-white/50">{d.criadoEm}</span></span>
        <span>Prazo: <span className={d.status === "atrasada" ? "text-red-400/70" : "text-white/50"}>{d.prazoDias} dias</span></span>
      </div>

      {/* Body: timeline + histórico lado a lado */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">Progresso</p>
          <Timeline status={d.status} />
        </div>
        <div>
          <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">Histórico</p>
          <div className="space-y-1">
            {d.historico.map((ev, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className={`text-[9px] mt-1 shrink-0 ${i === d.historico.length - 1 && d.status !== "concluida" ? cfg.text : "text-white/20"}`}>●</span>
                <p className={`text-[11px] leading-tight ${i === d.historico.length - 1 && d.status !== "concluida" ? cfg.text + " font-medium" : "text-white/40"}`}>
                  {ev}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

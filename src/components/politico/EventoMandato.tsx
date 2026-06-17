"use client";

export type EventoMandato = {
  data: string;
  cidade: string;
  titulo: string;
  descricao: string;
  responsavel: string;
  tipo: "expansao" | "estrutura" | "recuperacao" | "meta";
};

const TIPO_CFG = {
  estrutura:   { label: "Estrutura",   dot: "bg-emerald-500", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  expansao:    { label: "Expansão",    dot: "bg-blue-500",    text: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20"    },
  recuperacao: { label: "Recuperação", dot: "bg-red-500",     text: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20"     },
  meta:        { label: "Meta",        dot: "bg-amber-500",   text: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20"   },
};

type Props = { evento: EventoMandato; isLast: boolean };

export function EventoMandatoCard({ evento, isLast }: Props) {
  const cfg = TIPO_CFG[evento.tipo];
  return (
    <div className="flex items-start gap-3">
      {/* Dot + linha */}
      <div className="flex flex-col items-center shrink-0 mt-1">
        <div className={`w-3 h-3 rounded-full shrink-0 ${cfg.dot}`} />
        {!isLast && <div className="w-px flex-1 min-h-8 bg-white/[0.07] mt-1" />}
      </div>

      {/* Conteúdo */}
      <div className={`flex-1 pb-5 ${isLast ? "" : ""}`}>
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">{evento.titulo}</p>
            <p className="text-xs text-white/30 mt-0.5">{evento.cidade} · {evento.data}</p>
          </div>
          <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
            {cfg.label}
          </span>
        </div>
        <p className="text-xs text-white/40 mt-1">{evento.descricao}</p>
        <p className="text-xs text-white/20 mt-1">Responsável: {evento.responsavel}</p>
      </div>
    </div>
  );
}

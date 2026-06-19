"use client";

import { useRouter } from "next/navigation";

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
  planejada:    { label: "Planejada",    bg: "bg-zinc-500/10",    text: "text-zinc-400",    border: "border-zinc-500/20",    cardBorder: "border-zinc-500/15",    pct: 10,  barCor: "bg-zinc-500"    },
  em_andamento: { label: "Em andamento", bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/20",   cardBorder: "border-amber-500/20",   pct: 50,  barCor: "bg-amber-500"   },
  atrasada:     { label: "Atrasada",     bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/20",     cardBorder: "border-red-500/20",     pct: 40,  barCor: "bg-red-500"     },
  concluida:    { label: "Concluída",    bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", cardBorder: "border-emerald-500/20", pct: 100, barCor: "bg-emerald-500" },
};

const ETAPAS = ["Detecção", "Assessoria", "Coord.", "Ativa"] as const;

const STATUS_TO_ETAPA: Record<DecisaoPolitica["status"], number> = {
  planejada:    0,
  em_andamento: 2,
  atrasada:     2,
  concluida:    4,
};

const PRIO_STYLE: Record<number, string> = {
  1: "text-red-400 bg-red-500/10 border-red-500/20",
  2: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  3: "text-white/35 bg-white/5 border-white/10",
};

const DECISAO_ACAO: Record<DecisaoPolitica["status"], { label: string; href: (cidade: string) => string } | null> = {
  planejada:    { label: "Criar Missão →",   href: (c) => `/missoes?acao=nova&tipo=criar_assessoria&cidade=${encodeURIComponent(c)}&prioridade=P1` },
  em_andamento: { label: "Ver Missões →",    href: (c) => `/missoes` },
  atrasada:     { label: "Missão Urgente →", href: (c) => `/missoes?acao=nova&tipo=reestruturar_regiao&cidade=${encodeURIComponent(c)}&prioridade=P1` },
  concluida:    null,
};

export function CardDecisao({ d, prioridadeMunicipio }: { d: DecisaoPolitica; prioridadeMunicipio?: Record<string, number> }) {
  const router = useRouter();
  const cfg = STATUS_CONFIG[d.status];
  const prio = prioridadeMunicipio?.[d.cidade];
  const isUrgente = d.prazoDias <= 7;
  const isMedio   = d.prazoDias > 7 && d.prazoDias <= 14;
  const prazoCls  = isUrgente ? "text-red-400 font-bold" : isMedio ? "text-amber-400 font-medium" : "text-white/40";
  const etapaAtual = STATUS_TO_ETAPA[d.status];

  return (
    <div className={`p-4 rounded-2xl bg-zinc-900 border ${cfg.cardBorder}`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-semibold text-white truncate">{d.titulo}</p>
            <span className="text-xs text-white/30 shrink-0">· {d.cidade}</span>
            {prio && (
              <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${PRIO_STYLE[prio]}`}>
                P{prio}
              </span>
            )}
          </div>
          <p className="text-xs text-white/40">{d.descricao}</p>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
          {cfg.label}
        </span>
      </div>

      {/* Meta strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mb-3">
        <span className="text-white/30">Responsável: <span className="text-white/50">{d.responsavel}</span></span>
        <span className="text-white/30">Início: <span className="text-white/50">{d.criadoEm}</span></span>
        <span className="text-white/30">Prazo: <span className={prazoCls}>{d.prazoDias} dias</span></span>
      </div>

      {/* Progress bar horizontal */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] text-white/25 uppercase tracking-wider">Progresso</p>
          <p className={`text-[10px] font-bold ${cfg.text}`}>{cfg.pct}%</p>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-1.5">
          <div className={`h-full rounded-full transition-all ${cfg.barCor}`} style={{ width: `${cfg.pct}%` }} />
        </div>
        <div className="flex justify-between">
          {ETAPAS.map((etapa, i) => {
            const done   = etapaAtual === 4 || i < etapaAtual;
            const active = etapaAtual < 4 && i === etapaAtual;
            return (
              <p key={etapa} className={`text-[9px] ${done ? "text-emerald-400/60" : active ? cfg.text : "text-white/15"}`}>
                {etapa}{done ? " ✓" : ""}
              </p>
            );
          })}
        </div>
      </div>

      {/* Histórico */}
      <div className="pt-3 border-t border-white/5">
        <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Últimas atualizações</p>
        <div className="space-y-1.5">
          {d.historico.map((ev, i) => {
            const isCurrent = i === d.historico.length - 1 && d.status !== "concluida";
            return (
              <div key={i} className="flex items-start gap-2">
                <span className={`text-[9px] mt-0.5 shrink-0 ${isCurrent ? cfg.text : "text-white/20"}`}>
                  {isCurrent ? "→" : "●"}
                </span>
                <p className={`text-[11px] leading-tight ${isCurrent ? cfg.text + " font-medium" : "text-white/40"}`}>
                  {ev}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ação */}
      {(() => {
        const acao = DECISAO_ACAO[d.status];
        if (!acao) return null;
        return (
          <div className="pt-2.5 border-t border-white/5 flex justify-end">
            <button
              onClick={() => router.push(acao.href(d.cidade))}
              className={`text-[11px] font-medium transition-all ${cfg.text} hover:opacity-80`}
            >
              {acao.label}
            </button>
          </div>
        );
      })()}

    </div>
  );
}

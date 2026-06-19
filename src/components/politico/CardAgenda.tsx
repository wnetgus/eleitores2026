"use client";

import { useRouter } from "next/navigation";

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

const PRIO_STYLE: Record<number, string> = {
  1: "text-red-400 bg-red-500/10 border-red-500/20",
  2: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  3: "text-white/35 bg-white/5 border-white/10",
};

function getAgendaHref(item: AgendaItem): string {
  const t = item.titulo.toLowerCase();
  const c = encodeURIComponent(item.cidade);
  if (t.includes("assessoria") || t.includes("designar")) return `/missoes?acao=nova&tipo=criar_assessoria&cidade=${c}&prioridade=P1`;
  if (t.includes("coordenação") || t.includes("coordenacao") || t.includes("reunir")) return `/missoes?acao=nova&tipo=criar_coordenacao&cidade=${c}&prioridade=P2`;
  if (t.includes("eleitor") || t.includes("base") || t.includes("recuperar")) return `/missoes?acao=nova&tipo=fortalecer_base&cidade=${c}&prioridade=P2`;
  return `/missoes`;
}

const AGENDA_ACAO_LABEL: Record<AgendaItem["status"], string | null> = {
  hoje:        "Executar agora →",
  esta_semana: "Planejar →",
  concluida:   null,
};

export function CardAgenda({ item, badgeLabel, prioridadeMunicipio }: { item: AgendaItem; badgeLabel?: string; prioridadeMunicipio?: Record<string, number> }) {
  const router = useRouter();
  const cfg  = PRIORIDADE_CFG[item.prioridade];
  const prio = prioridadeMunicipio?.[item.cidade];
  const acaoLabel = AGENDA_ACAO_LABEL[item.status];
  return (
    <div className={`p-4 rounded-2xl bg-zinc-900 border ${cfg.border} ${cfg.hoverBorder} transition-all`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-semibold text-white truncate">{item.titulo}</p>
            <span className="text-xs text-white/30 shrink-0">· {item.cidade}</span>
            {prio && (
              <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${PRIO_STYLE[prio]}`}>P{prio}</span>
            )}
          </div>
          <p className="text-xs text-white/40 mb-2">{item.descricao}</p>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-white/25">Responsável: <span className="text-white/40">{item.responsavel}</span></p>
            {acaoLabel && (
              <button
                onClick={() => router.push(getAgendaHref(item))}
                className={`text-[11px] font-medium transition-all ${cfg.text} hover:opacity-80`}
              >
                {acaoLabel}
              </button>
            )}
          </div>
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
          {badgeLabel ?? cfg.label}
        </span>
      </div>
    </div>
  );
}

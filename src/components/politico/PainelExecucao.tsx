"use client";

import { useRouter } from "next/navigation";
import { WorkflowStatus } from "@/lib/inteligencia";
import { BadgeWorkflow } from "./BadgeWorkflow";

export type ExecucaoItem = {
  cidade: string;
  status: "concluida" | "em_andamento" | "atrasada";
  responsavel: string;
  descricao: string;
  dias: number;
};

const TIMELINE_STEPS: { key: WorkflowStatus; label: string }[] = [
  { key: "detectada",          label: "Detectada" },
  { key: "assessor_designado", label: "Assessor"  },
  { key: "coordenacao_criada", label: "Coord."    },
  { key: "estrutura_ativa",    label: "Ativa"     },
];

const STATUS_TO_WORKFLOW: Record<ExecucaoItem["status"], WorkflowStatus> = {
  concluida:    "estrutura_ativa",
  em_andamento: "assessor_designado",
  atrasada:     "detectada",
};

const PROGRESSO: Record<ExecucaoItem["status"], { pct: number; cor: string; textCor: string }> = {
  concluida:    { pct: 100, cor: "bg-emerald-500", textCor: "text-emerald-400" },
  em_andamento: { pct: 50,  cor: "bg-amber-500",   textCor: "text-amber-400"  },
  atrasada:     { pct: 15,  cor: "bg-red-500",     textCor: "text-red-400"    },
};

const ACAO_REC: Record<ExecucaoItem["status"], string> = {
  concluida:    "Replicar modelo →",
  em_andamento: "Acompanhar implantação →",
  atrasada:     "Plano de recuperação →",
};

const ACAO_CLS: Record<ExecucaoItem["status"], string> = {
  concluida:    "text-emerald-400 hover:text-emerald-300",
  em_andamento: "text-amber-400   hover:text-amber-300",
  atrasada:     "text-red-400     hover:text-red-300",
};

const PRIO_STYLE: Record<number, string> = {
  1: "text-red-400 bg-red-500/10 border-red-500/20",
  2: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  3: "text-white/35 bg-white/5 border-white/10",
};

const GROUPS: {
  status: ExecucaoItem["status"];
  icon: string;
  label: string;
  badgeLabel: string;
  badgeWorkflow: WorkflowStatus;
}[] = [
  { status: "concluida",    icon: "🟢", label: "CONCLUÍDAS",   badgeLabel: "Estrutura Ativa", badgeWorkflow: "estrutura_ativa"    },
  { status: "em_andamento", icon: "🟡", label: "EM ANDAMENTO", badgeLabel: "Em Implantação",  badgeWorkflow: "assessor_designado" },
  { status: "atrasada",     icon: "🔴", label: "ATRASADAS",    badgeLabel: "Atrasada",        badgeWorkflow: "detectada"          },
];

function ProgressBar({ itemStatus }: { itemStatus: ExecucaoItem["status"] }) {
  const { pct, cor, textCor } = PROGRESSO[itemStatus];
  const currentIdx = TIMELINE_STEPS.findIndex((s) => s.key === STATUS_TO_WORKFLOW[itemStatus]);
  const isAllDone = itemStatus === "concluida";

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] text-white/25 uppercase tracking-wider">Progresso</p>
        <p className={`text-[10px] font-bold ${textCor}`}>{pct}%</p>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between mt-1.5">
        {TIMELINE_STEPS.map((step, i) => {
          const done   = isAllDone || i < currentIdx;
          const active = !isAllDone && i === currentIdx;
          return (
            <p key={step.key} className={`text-[10px] ${done || active ? textCor : "text-white/15"}`}>
              {step.label}{done ? " ✓" : ""}
            </p>
          );
        })}
      </div>
    </div>
  );
}

const ACAO_HREF: Record<ExecucaoItem["status"], (cidade: string) => string> = {
  concluida:    (c) => `/missoes?acao=nova&tipo=expandir_territorio&cidade=${encodeURIComponent(c)}&prioridade=P2`,
  em_andamento: (c) => `/missoes`,
  atrasada:     (c) => `/missoes?acao=nova&tipo=reestruturar_regiao&cidade=${encodeURIComponent(c)}&prioridade=P1`,
};

function ItemCard({ item, badgeLabel, badgeWorkflow, prioridadeMunicipio }: {
  item: ExecucaoItem;
  badgeLabel: string;
  badgeWorkflow: WorkflowStatus;
  prioridadeMunicipio?: Record<string, number>;
}) {
  const router = useRouter();
  const diasText = {
    concluida:    `Concluído há ${item.dias} dia${item.dias !== 1 ? "s" : ""}`,
    em_andamento: `Prazo: ${item.dias} dias`,
    atrasada:     `${item.dias} dias sem evolução`,
  }[item.status];

  const borderColor = {
    concluida:    "border-emerald-500/20",
    em_andamento: "border-amber-500/20",
    atrasada:     "border-red-500/20",
  }[item.status];

  const prio = prioridadeMunicipio?.[item.cidade];

  return (
    <div className={`p-4 rounded-2xl bg-zinc-900 border ${borderColor}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-white">{item.cidade}</p>
            {prio && (
              <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${PRIO_STYLE[prio]}`}>
                P{prio}
              </span>
            )}
          </div>
          <p className="text-xs text-white/40 mt-0.5">{item.descricao}</p>
        </div>
        <BadgeWorkflow status={badgeWorkflow} label={badgeLabel} />
      </div>
      <div className="flex items-center justify-between text-xs text-white/30 mb-1">
        <span>Responsável: <span className="text-white/50">{item.responsavel}</span></span>
        <span className={
          item.status === "atrasada"  ? "text-red-400/70"     :
          item.status === "concluida" ? "text-emerald-400/70" : "text-white/40"
        }>{diasText}</span>
      </div>
      <ProgressBar itemStatus={item.status} />
      <div className="mt-3 pt-2.5 border-t border-white/5 flex justify-end">
        <button
          onClick={() => router.push(ACAO_HREF[item.status](item.cidade))}
          className={`text-[11px] font-medium transition-all ${ACAO_CLS[item.status]}`}
        >
          {ACAO_REC[item.status]}
        </button>
      </div>
    </div>
  );
}

export function PainelExecucao({ items, prioridadeMunicipio }: { items: ExecucaoItem[]; prioridadeMunicipio?: Record<string, number> }) {
  if (items.length === 0) return null;

  const concluidas = items.filter((i) => i.status === "concluida").length;
  const atrasadas  = items.filter((i) => i.status === "atrasada").length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <h3 className="text-white font-semibold">Central de Acompanhamento</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/10">
            {items.length} {items.length === 1 ? "item" : "itens"}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {atrasadas > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              🔴 {atrasadas} atrasada{atrasadas !== 1 ? "s" : ""}
            </span>
          )}
          <span className="text-xs text-white/30">{concluidas}/{items.length} concluídas</span>
        </div>
      </div>

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
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
              {groupItems.map((item) => (
                <ItemCard
                  key={item.cidade}
                  item={item}
                  badgeLabel={group.badgeLabel}
                  badgeWorkflow={group.badgeWorkflow}
                  prioridadeMunicipio={prioridadeMunicipio}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

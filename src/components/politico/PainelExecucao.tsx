"use client";

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
  { key: "detectada",          label: "Detectada"          },
  { key: "assessor_designado", label: "Assessor Designado" },
  { key: "coordenacao_criada", label: "Coordenação Criada" },
  { key: "estrutura_ativa",    label: "Estrutura Ativa"    },
];

const STATUS_TO_WORKFLOW: Record<ExecucaoItem["status"], WorkflowStatus> = {
  concluida:    "estrutura_ativa",
  em_andamento: "assessor_designado",
  atrasada:     "detectada",
};

const GROUPS: {
  status: ExecucaoItem["status"];
  icon: string;
  label: string;
  badgeLabel: string;
  badgeWorkflow: WorkflowStatus;
}[] = [
  { status: "concluida",    icon: "🟢", label: "RESOLVIDAS",   badgeLabel: "Estrutura Ativa", badgeWorkflow: "estrutura_ativa"   },
  { status: "em_andamento", icon: "🟡", label: "EM ANDAMENTO", badgeLabel: "Em Implantação",  badgeWorkflow: "assessor_designado" },
  { status: "atrasada",     icon: "🔴", label: "ATRASADAS",    badgeLabel: "Atrasada",        badgeWorkflow: "detectada"          },
];

function Timeline({ itemStatus }: { itemStatus: ExecucaoItem["status"] }) {
  const currentIdx = TIMELINE_STEPS.findIndex((s) => s.key === STATUS_TO_WORKFLOW[itemStatus]);
  const isAllDone = itemStatus === "concluida";
  const isAtrasada = itemStatus === "atrasada";

  return (
    <div className="mt-3 space-y-0">
      {TIMELINE_STEPS.map((step, idx) => {
        const isDone = isAllDone || idx < currentIdx;
        const isCurrent = !isAllDone && idx === currentIdx;
        const isLast = idx === TIMELINE_STEPS.length - 1;

        const dotBg = isDone
          ? "bg-emerald-500"
          : isCurrent && isAtrasada
          ? "bg-red-500"
          : isCurrent
          ? "bg-amber-500"
          : "bg-transparent border border-white/15";

        const textCor = isDone
          ? "text-emerald-400"
          : isCurrent && isAtrasada
          ? "text-red-400"
          : isCurrent
          ? "text-amber-400"
          : "text-white/20";

        return (
          <div key={step.key} className="flex items-start gap-2">
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold text-white ${dotBg}`}>
                {isDone ? "✓" : ""}
              </div>
              {!isLast && <div className="w-px h-3.5 bg-white/[0.08]" />}
            </div>
            <p className={`text-[11px] leading-tight mt-0.5 ${textCor}`}>
              {step.label}{isDone ? " ✓" : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function ItemCard({ item, badgeLabel, badgeWorkflow }: { item: ExecucaoItem; badgeLabel: string; badgeWorkflow: WorkflowStatus }) {
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

  return (
    <div className={`p-4 rounded-2xl bg-zinc-900 border ${borderColor}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{item.cidade}</p>
          <p className="text-xs text-white/40 mt-0.5">{item.descricao}</p>
        </div>
        <BadgeWorkflow status={badgeWorkflow} label={badgeLabel} />
      </div>
      <div className="flex items-center justify-between text-xs text-white/30 mb-1">
        <span>Responsável: <span className="text-white/50">{item.responsavel}</span></span>
        <span className={item.status === "atrasada" ? "text-red-400/70" : item.status === "concluida" ? "text-emerald-400/70" : "text-white/40"}>{diasText}</span>
      </div>
      <Timeline itemStatus={item.status} />
    </div>
  );
}

export function PainelExecucao({ items }: { items: ExecucaoItem[] }) {
  const hasAny = items.length > 0;
  if (!hasAny) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-base">📋</span>
        <h3 className="text-white font-semibold">Central de Acompanhamento</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/10">
          {items.length} {items.length === 1 ? "item" : "itens"}
        </span>
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
            <div className="space-y-2">
              {groupItems.map((item) => (
                <ItemCard key={item.cidade} item={item} badgeLabel={group.badgeLabel} badgeWorkflow={group.badgeWorkflow} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

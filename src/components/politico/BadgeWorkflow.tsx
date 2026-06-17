import { WorkflowStatus, getWorkflowLabel } from "@/lib/inteligencia";

const THEME: Record<WorkflowStatus, { bg: string; text: string; border: string }> = {
  detectada:           { bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/20"     },
  em_andamento:        { bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/20"   },
  assessor_designado:  { bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/20"   },
  coordenacao_criada:  { bg: "bg-blue-500/10",    text: "text-blue-400",    border: "border-blue-500/20"    },
  estrutura_ativa:     { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  concluida:           { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  cancelada:           { bg: "bg-zinc-500/10",    text: "text-zinc-400",    border: "border-zinc-500/20"    },
};

type Props = { status: WorkflowStatus; label?: string };

export function BadgeWorkflow({ status, label }: Props) {
  const { bg, text, border } = THEME[status];
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${bg} ${text} ${border}`}>
      {label ?? getWorkflowLabel(status)}
    </span>
  );
}

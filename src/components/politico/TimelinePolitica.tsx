"use client";

import { DecisaoPolitica } from "./CardDecisao";

type StepState = "done" | "current" | "atrasada" | "future";

const STEPS = ["Pendência criada", "Plano aprovado", "Execução", "Concluída"] as const;

const STATUS_TO_IDX: Record<DecisaoPolitica["status"], number> = {
  planejada:    0,
  em_andamento: 2,
  atrasada:     2,
  concluida:    4,
};

function resolveState(idx: number, status: DecisaoPolitica["status"]): StepState {
  const currentIdx = STATUS_TO_IDX[status];
  if (status === "concluida") return "done";
  if (idx < currentIdx) return "done";
  if (idx === currentIdx) return status === "atrasada" ? "atrasada" : "current";
  return "future";
}

const DOT_CLS: Record<StepState, string> = {
  done:     "bg-emerald-500 text-white",
  current:  "bg-amber-500 text-white",
  atrasada: "bg-red-500 text-white",
  future:   "border border-white/15 bg-transparent",
};

const TEXT_CLS: Record<StepState, string> = {
  done:     "text-emerald-400",
  current:  "text-amber-400",
  atrasada: "text-red-400",
  future:   "text-white/20",
};

type Props = {
  status: DecisaoPolitica["status"];
  compact?: boolean;
};

export function TimelinePolitica({ status, compact = false }: Props) {
  return (
    <div className={compact ? "space-y-0" : "space-y-0"}>
      {STEPS.map((step, idx) => {
        const state = resolveState(idx, status);
        const isLast = idx === STEPS.length - 1;
        return (
          <div key={step} className="flex items-start gap-2">
            <div className="flex flex-col items-center shrink-0">
              <div className={`${compact ? "w-2.5 h-2.5 text-[6px]" : "w-3.5 h-3.5 text-[8px]"} rounded-full flex items-center justify-center font-bold ${DOT_CLS[state]}`}>
                {state === "done" ? "✓" : ""}
              </div>
              {!isLast && <div className={`w-px ${compact ? "h-3" : "h-4"} bg-white/[0.07]`} />}
            </div>
            <p className={`leading-tight mt-0.5 ${compact ? "text-[10px]" : "text-xs"} ${TEXT_CLS[state]}`}>
              {step}{state === "done" ? " ✓" : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}

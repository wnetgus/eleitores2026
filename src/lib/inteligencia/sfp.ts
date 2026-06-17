import { Eleitor } from "@/types";

const PESOS_APOIO = { forte: 3.0, medio: 1.5, fraco: 0.5, indeciso: 0.2 };

export type SFPResult = {
  score: number;
  label: string;
  cor: string;
  bg: string;
  dot: string;
  total: number;
};

export function calcularSFPSimples(eleitores: Eleitor[]): SFPResult | null {
  if (eleitores.length < 10) return null;

  let bruto = 0;
  for (const e of eleitores) {
    bruto += PESOS_APOIO[e.grauApoio as keyof typeof PESOS_APOIO] ?? 0.2;
  }

  const score = Math.round((bruto / eleitores.length) * 100) / 100;

  if (score >= 2.5) return { score, label: "Forte",           cor: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-400", total: eleitores.length };
  if (score >= 1.8) return { score, label: "Sólido",          cor: "text-amber-400",   bg: "bg-amber-500/10",   dot: "bg-amber-400",   total: eleitores.length };
  if (score >= 1.0) return { score, label: "Em Consolidação", cor: "text-orange-400",  bg: "bg-orange-500/10",  dot: "bg-orange-400",  total: eleitores.length };
  if (score >= 0.1) return { score, label: "Em Risco",        cor: "text-red-400",     bg: "bg-red-500/10",     dot: "bg-red-400",     total: eleitores.length };
  return                   { score, label: "Abandonado",      cor: "text-white/30",    bg: "bg-white/5",        dot: "bg-white/20",    total: eleitores.length };
}

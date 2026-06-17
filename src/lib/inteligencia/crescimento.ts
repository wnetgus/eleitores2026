import { Eleitor } from "@/types";
import { toDate } from "./datas";

export type ICResult = {
  atual: number;
  anterior: number;
  variacao: number;
  label: string;
  direcao: "acelerando" | "crescendo" | "estavel" | "retraindo" | "queda";
  cor: string;
  seta: string;
};

// LEGADO — janela 7/14 dias
export function calcularIC(eleitores: Eleitor[]): ICResult | null {
  if (eleitores.length === 0) return null;

  const agora = new Date();
  const ini7  = new Date(agora.getTime() -  7 * 86_400_000);
  const ini14 = new Date(agora.getTime() - 14 * 86_400_000);

  const atual    = eleitores.filter((e) => { const d = toDate(e.criadoEm); return d != null && d >= ini7; }).length;
  const anterior = eleitores.filter((e) => { const d = toDate(e.criadoEm); return d != null && d >= ini14 && d < ini7; }).length;

  if (atual === 0 && anterior === 0) return null;

  const variacao = anterior === 0
    ? (atual > 0 ? 100 : 0)
    : Math.round(((atual - anterior) / anterior) * 100);

  if (variacao > 25)   return { atual, anterior, variacao, label: `+${variacao}% vs semana`, direcao: "acelerando", cor: "text-emerald-400", seta: "↗" };
  if (variacao > 5)    return { atual, anterior, variacao, label: `+${variacao}% vs semana`, direcao: "crescendo",  cor: "text-emerald-400", seta: "↗" };
  if (variacao >= -5)  return { atual, anterior, variacao, label: "Estável",                 direcao: "estavel",    cor: "text-white/50",    seta: "→" };
  if (variacao >= -25) return { atual, anterior, variacao, label: `${variacao}% vs semana`,  direcao: "retraindo",  cor: "text-amber-400",   seta: "↘" };
  return                      { atual, anterior, variacao, label: `${variacao}% vs semana`,  direcao: "queda",      cor: "text-red-400",     seta: "⬇" };
}

export function calcularIC30d(eleitores: Eleitor[], agora: number = Date.now()): ICResult | null {
  if (eleitores.length === 0) return null;

  const atual    = eleitores.filter((e) => { const d = toDate(e.criadoEm); return d != null && d.getTime() > agora - 30 * 86_400_000; }).length;
  const anterior = eleitores.filter((e) => { const d = toDate(e.criadoEm); const t = d?.getTime() ?? 0; return t > agora - 60 * 86_400_000 && t <= agora - 30 * 86_400_000; }).length;

  if (atual === 0 && anterior === 0) return null;

  const variacao = anterior === 0
    ? (atual > 0 ? 100 : 0)
    : Math.round(((atual - anterior) / anterior) * 100);

  if (variacao > 25)   return { atual, anterior, variacao, label: `+${variacao}% vs 30d anterior`, direcao: "acelerando", cor: "text-emerald-400", seta: "↗" };
  if (variacao > 5)    return { atual, anterior, variacao, label: `+${variacao}% vs 30d anterior`, direcao: "crescendo",  cor: "text-emerald-400", seta: "↗" };
  if (variacao >= -5)  return { atual, anterior, variacao, label: "Estável",                        direcao: "estavel",    cor: "text-white/50",    seta: "→" };
  if (variacao >= -25) return { atual, anterior, variacao, label: `${variacao}% vs 30d anterior`,  direcao: "retraindo",  cor: "text-amber-400",   seta: "↘" };
  return                      { atual, anterior, variacao, label: `${variacao}% vs 30d anterior`,  direcao: "queda",      cor: "text-red-400",     seta: "⬇" };
}

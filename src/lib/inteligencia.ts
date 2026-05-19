import { Eleitor } from "@/types";

const PESOS_APOIO = { forte: 3.0, medio: 1.5, fraco: 0.5, indeciso: 0.2 };

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Saúde Operacional do Colaborador
// ---------------------------------------------------------------------------

export type SaudeStatus = {
  status: "ativo" | "atencao" | "parado" | "inativo" | "iniciando" | "sem_atividade";
  label: string;
  cor: string;
  bg: string;
  dot: string;
  dias: number;
};

export function calcularSaudeColaborador(ultimaAtividade?: any, criadoEm?: any): SaudeStatus {
  const agora = new Date();

  const criado = toDate(criadoEm);
  if (criado) {
    const diasCriado = Math.floor((agora.getTime() - criado.getTime()) / 86_400_000);
    if (diasCriado < 7) {
      return { status: "iniciando", label: "Iniciando", cor: "text-blue-400", bg: "bg-blue-500/10", dot: "bg-blue-400", dias: 0 };
    }
  }

  const ua = toDate(ultimaAtividade);
  if (!ua) {
    return { status: "sem_atividade", label: "Sem atividade", cor: "text-white/40", bg: "bg-white/5", dot: "bg-white/30", dias: 999 };
  }

  const dias = Math.floor((agora.getTime() - ua.getTime()) / 86_400_000);

  if (dias <= 2)  return { status: "ativo",   label: dias === 0 ? "Ativo hoje" : `Ativo (${dias}d)`,    cor: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-400", dias };
  if (dias <= 5)  return { status: "atencao", label: `Atenção (${dias}d)`,                              cor: "text-amber-400",   bg: "bg-amber-500/10",   dot: "bg-amber-400",   dias };
  if (dias <= 10) return { status: "parado",  label: `Parado (${dias}d)`,                               cor: "text-orange-400",  bg: "bg-orange-500/10",  dot: "bg-orange-400",  dias };
  return           { status: "inativo",  label: `Inativo (${dias}d)`,                                   cor: "text-red-400",     bg: "bg-red-500/10",     dot: "bg-red-400",     dias };
}

// ---------------------------------------------------------------------------
// Índice de Crescimento Semanal
// ---------------------------------------------------------------------------

export type ICResult = {
  atual: number;
  anterior: number;
  variacao: number;
  label: string;
  direcao: "acelerando" | "crescendo" | "estavel" | "retraindo" | "queda";
  cor: string;
  seta: string;
};

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

  if (variacao > 25)  return { atual, anterior, variacao, label: `+${variacao}% vs semana`, direcao: "acelerando", cor: "text-emerald-400", seta: "↗" };
  if (variacao > 5)   return { atual, anterior, variacao, label: `+${variacao}% vs semana`, direcao: "crescendo",  cor: "text-emerald-400", seta: "↗" };
  if (variacao >= -5) return { atual, anterior, variacao, label: "Estável",                 direcao: "estavel",    cor: "text-white/50",    seta: "→" };
  if (variacao >= -25)return { atual, anterior, variacao, label: `${variacao}% vs semana`,  direcao: "retraindo",  cor: "text-amber-400",   seta: "↘" };
  return                     { atual, anterior, variacao, label: `${variacao}% vs semana`,  direcao: "queda",      cor: "text-red-400",     seta: "⬇" };
}

// ---------------------------------------------------------------------------
// Score de Força Política Simples (SFP)
// ---------------------------------------------------------------------------

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

  if (score >= 2.5) return { score, label: "Forte",     cor: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-400", total: eleitores.length };
  if (score >= 1.8) return { score, label: "Sólido",    cor: "text-amber-400",   bg: "bg-amber-500/10",   dot: "bg-amber-400",   total: eleitores.length };
  if (score >= 1.0) return { score, label: "Fraco",     cor: "text-orange-400",  bg: "bg-orange-500/10",  dot: "bg-orange-400",  total: eleitores.length };
  if (score >= 0.1) return { score, label: "Em Risco",  cor: "text-red-400",     bg: "bg-red-500/10",     dot: "bg-red-400",     total: eleitores.length };
  return                   { score, label: "Abandonado",cor: "text-white/30",    bg: "bg-white/5",         dot: "bg-white/20",    total: eleitores.length };
}

// ---------------------------------------------------------------------------
// Progresso de Meta Eleitoral
// ---------------------------------------------------------------------------

export type MetaProgress = {
  percentual: number;
  label: string;
  cor: string;
  bg: string;
};

export function calcularProgressoMeta(totalCadastrado: number, metaEleitoral: number): MetaProgress {
  if (!metaEleitoral || metaEleitoral <= 0) {
    return { percentual: 0, label: "Meta inválida", cor: "text-white/30", bg: "bg-white/10" };
  }
  const percentual = Math.min(100, Math.round((totalCadastrado / metaEleitoral) * 100));
  if (percentual >= 90) return { percentual, label: `${percentual}% atingido`, cor: "text-emerald-400", bg: "bg-emerald-500" };
  if (percentual >= 60) return { percentual, label: `${percentual}% atingido`, cor: "text-amber-400",   bg: "bg-amber-500"   };
  if (percentual >= 30) return { percentual, label: `${percentual}% atingido`, cor: "text-orange-400",  bg: "bg-orange-500"  };
  return                       { percentual, label: `${percentual}% atingido`, cor: "text-red-400",     bg: "bg-red-500"     };
}

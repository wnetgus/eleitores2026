import { toDate } from "./datas";

export type SaudeStatus = {
  status: "ativo" | "atencao" | "parado" | "inativo" | "iniciando" | "sem_atividade";
  label: string;
  cor: string;
  bg: string;
  dot: string;
  dias: number;
};

export function calcularSaudeColaborador(ultimaAtividade?: unknown, criadoEm?: unknown): SaudeStatus {
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

  if (dias <= 2)  return { status: "ativo",    label: dias === 0 ? "Ativo hoje" : `Ativo (${dias}d)`, cor: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-400", dias };
  if (dias <= 5)  return { status: "atencao",  label: `Atenção (${dias}d)`,                           cor: "text-amber-400",   bg: "bg-amber-500/10",   dot: "bg-amber-400",   dias };
  if (dias <= 10) return { status: "parado",   label: `Parado (${dias}d)`,                            cor: "text-orange-400",  bg: "bg-orange-500/10",  dot: "bg-orange-400",  dias };
  return                 { status: "inativo",  label: `Inativo (${dias}d)`,                           cor: "text-red-400",     bg: "bg-red-500/10",     dot: "bg-red-400",     dias };
}

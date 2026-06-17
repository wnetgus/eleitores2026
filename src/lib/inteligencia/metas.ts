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

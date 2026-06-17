"use client";

export type AlertaExecutivo = {
  tipo: "critico" | "oportunidade" | "sucesso" | "atencao";
  titulo: string;
  descricao: string;
  cidade: string;
  responsavel: string;
  tempo: string;
  acao: string;
};

const TIPO_CFG = {
  critico:      { icon: "🔴", bg: "bg-red-950/40",     border: "border-red-500/30",     text: "text-red-400",     acaoCls: "bg-red-500/10 text-red-400 hover:bg-red-500/20"         },
  oportunidade: { icon: "⚡", bg: "bg-blue-950/40",    border: "border-blue-500/30",    text: "text-blue-400",    acaoCls: "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"       },
  sucesso:      { icon: "✅", bg: "bg-emerald-950/40", border: "border-emerald-500/30", text: "text-emerald-400", acaoCls: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" },
  atencao:      { icon: "🟡", bg: "bg-amber-950/40",   border: "border-amber-500/30",   text: "text-amber-400",   acaoCls: "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"    },
};

export function CardAlerta({ alerta }: { alerta: AlertaExecutivo }) {
  const cfg = TIPO_CFG[alerta.tipo];
  return (
    <div className={`p-4 rounded-2xl border ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0 mt-0.5">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <p className={`text-sm font-semibold ${cfg.text}`}>{alerta.titulo}</p>
            <span className="text-[10px] text-white/25 shrink-0">{alerta.tempo}</span>
          </div>
          <p className="text-xs text-white/50 mb-2">{alerta.descricao}</p>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3 text-xs text-white/25">
              <span>📍 {alerta.cidade}</span>
              <span>👤 {alerta.responsavel}</span>
            </div>
            <button className={`text-xs font-medium px-3 py-1 rounded-lg transition-all ${cfg.acaoCls}`}>
              {alerta.acao} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

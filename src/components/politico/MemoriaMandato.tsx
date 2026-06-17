"use client";

import { EventoMandato, EventoMandatoCard } from "./EventoMandato";

export type { EventoMandato };

export function MemoriaMandato({ eventos }: { eventos: EventoMandato[] }) {
  if (eventos.length === 0) return null;

  const ordenados = [...eventos].sort((a, b) => {
    const parse = (d: string) => {
      const [dia, mes, ano] = d.split("/").map(Number);
      return new Date(ano, mes - 1, dia).getTime();
    };
    return parse(b.data) - parse(a.data);
  });

  const primeiro = eventos.reduce((min, e) => {
    const parse = (d: string) => { const [dia, mes, ano] = d.split("/").map(Number); return new Date(ano, mes - 1, dia).getTime(); };
    return parse(e.data) < parse(min.data) ? e : min;
  }, eventos[0]);

  const ultimo = ordenados[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">🏛️</span>
            <h3 className="text-white font-semibold">Memória do Mandato</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/10">
              {eventos.length} {eventos.length === 1 ? "evento" : "eventos"}
            </span>
          </div>
          <p className="text-xs text-white/30 mt-0.5 ml-7">
            Histórico político e evolução estratégica da operação.
          </p>
        </div>
        <div className="text-right shrink-0 space-y-0.5">
          <p className="text-[10px] text-white/20">Primeiro registro: <span className="text-white/35">{primeiro.data}</span></p>
          <p className="text-[10px] text-white/20">Última atualização: <span className="text-white/35">{ultimo.data}</span></p>
        </div>
      </div>

      {/* Timeline */}
      <div className="pl-1">
        {ordenados.map((evento, idx) => (
          <EventoMandatoCard
            key={`${evento.data}-${evento.cidade}-${evento.titulo}`}
            evento={evento}
            isLast={idx === ordenados.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

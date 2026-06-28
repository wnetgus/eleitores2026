"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Archive, ExternalLink, X } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useNotificacoes } from "@/contexts/NotificacoesContext";
import { Notificacao, TIPO_CONFIG, PRIO_COR, NotifTipo, tempoRelativo } from "@/lib/notificacoes";

type Filtro = "todos" | "nao_lidas" | NotifTipo;

const FILTROS: { value: Filtro; label: string }[] = [
  { value: "todos",         label: "Todos" },
  { value: "nao_lidas",    label: "Não lidas" },
  { value: "determinacao", label: "Determinações" },
  { value: "missao",       label: "Missões" },
  { value: "alerta",       label: "Alertas" },
  { value: "prestacao",    label: "Prestações" },
  { value: "meta",         label: "Metas" },
  { value: "sistema",      label: "Sistema" },
];

function CardNotificacao({
  n,
  onLer,
  onArquivar,
  onAbrir,
}: {
  n: Notificacao;
  onLer: () => void;
  onArquivar: () => void;
  onAbrir?: () => void;
}) {
  const cfg = TIPO_CONFIG[n.tipo];
  const prioCor = PRIO_COR[n.prioridade];

  return (
    <div
      data-testid="card-notificacao"
      className={`relative p-4 rounded-2xl border transition-all
        ${n.lida
          ? "bg-white/2 border-white/5"
          : "bg-white/5 border-violet-500/15 shadow-sm shadow-violet-500/5"
        }`}
    >
      {/* Ponto não lida */}
      {!n.lida && (
        <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-violet-400" />
      )}

      <div className="flex items-start gap-3">
        {/* Ícone tipo */}
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 text-lg ${cfg.cor}`}>
          {cfg.icon}
        </div>

        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.cor}`}>
              {cfg.label}
            </span>
            <span className={`text-[10px] font-semibold ${prioCor}`}>
              {n.prioridade.toUpperCase()}
            </span>
            {n.remetenteNome && (
              <span className="text-[10px] text-white/25">· {n.remetenteNome}</span>
            )}
          </div>

          {/* Conteúdo */}
          <p className={`text-sm font-semibold mb-0.5 ${n.lida ? "text-white/60" : "text-white/90"}`}>
            {n.titulo}
          </p>
          <p className="text-xs text-white/35 leading-relaxed">{n.descricao}</p>

          {/* Rodapé */}
          <div className="flex items-center justify-between mt-3">
            <span className="text-[11px] text-white/20">
              {n.criadaEm ? tempoRelativo(n.criadaEm) : ""}
            </span>
            <div className="flex items-center gap-1">
              {n.link && (
                <button
                  data-testid="btn-abrir-origem"
                  onClick={onAbrir}
                  className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 px-2 py-1 rounded-lg hover:bg-violet-500/10 transition-all"
                >
                  <ExternalLink size={12} />
                  Abrir
                </button>
              )}
              {!n.lida && (
                <button
                  data-testid="btn-marcar-lida"
                  onClick={onLer}
                  className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 px-2 py-1 rounded-lg hover:bg-white/5 transition-all"
                >
                  <CheckCheck size={12} />
                  Lida
                </button>
              )}
              <button
                data-testid="btn-arquivar-notificacao"
                onClick={onArquivar}
                className="flex items-center gap-1 text-[11px] text-white/20 hover:text-white/40 px-2 py-1 rounded-lg hover:bg-white/5 transition-all"
              >
                <Archive size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotificacoesPage() {
  const router = useRouter();
  const { notificacoes, naoLidas, marcarLida, marcarTodasLidas, arquivar } = useNotificacoes();
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const lista = useMemo(() => {
    return notificacoes.filter((n) => {
      if (filtro === "todos") return true;
      if (filtro === "nao_lidas") return !n.lida;
      return n.tipo === filtro;
    });
  }, [notificacoes, filtro]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: notificacoes.length, nao_lidas: naoLidas };
    notificacoes.forEach((n) => { c[n.tipo] = (c[n.tipo] || 0) + 1; });
    return c;
  }, [notificacoes, naoLidas]);

  async function handleAbrir(n: Notificacao) {
    if (!n.lida && n.id) await marcarLida(n.id);
    if (n.link) router.push(n.link);
  }

  return (
    <div data-testid="pagina-notificacoes" className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <Bell size={18} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">Notificações</h1>
            <p className="text-white/30 text-xs">
              {naoLidas > 0 ? `${naoLidas} não ${naoLidas === 1 ? "lida" : "lidas"}` : "Tudo em dia"}
            </p>
          </div>
        </div>
        {naoLidas > 0 && (
          <button
            onClick={marcarTodasLidas}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 px-3 py-2 rounded-xl hover:bg-white/5 transition-all border border-white/5 hover:border-white/10"
          >
            <CheckCheck size={14} />
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FILTROS.map((f) => {
          const cnt = counts[f.value] || 0;
          if (f.value !== "todos" && f.value !== "nao_lidas" && cnt === 0) return null;
          return (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                ${filtro === f.value
                  ? "bg-violet-500/20 border-violet-500/40 text-violet-200"
                  : "bg-white/4 border-white/8 text-white/40 hover:text-white/60"
                }`}
            >
              {f.label}
              {cnt > 0 && (
                <span className={`text-[10px] px-1 rounded-full ${filtro === f.value ? "bg-violet-500/30 text-violet-200" : "bg-white/8 text-white/30"}`}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {lista.length === 0 ? (
        <GlassCard className="py-16 text-center">
          <Bell size={32} className="text-white/10 mx-auto mb-3" />
          <p className="text-white/25 font-medium">
            {filtro === "nao_lidas" ? "Tudo lido — nenhuma notificação pendente" : "Nenhuma notificação"}
          </p>
          {filtro === "todos" && (
            <p className="text-white/15 text-xs mt-1">Você está em dia</p>
          )}
          {filtro !== "todos" && (
            <button onClick={() => setFiltro("todos")} className="mt-3 text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 mx-auto">
              <X size={12} /> Limpar filtro
            </button>
          )}
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {lista.map((n) => (
            <CardNotificacao
              key={n.id}
              n={n}
              onLer={() => n.id && marcarLida(n.id)}
              onArquivar={() => n.id && arquivar(n.id)}
              onAbrir={() => handleAbrir(n)}
            />
          ))}
        </div>
      )}

      {notificacoes.length >= 50 && (
        <p className="text-center text-xs text-white/20">Exibindo as 50 notificações mais recentes</p>
      )}
    </div>
  );
}

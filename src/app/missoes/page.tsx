"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where, addDoc, updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Missao, MissaoTipo, MissaoStatus, AppUser } from "@/types";
import { getRoleConfig, isPolitico, isAssessorExecutivo, isSuperOrMaster, isAssessor } from "@/lib/permissions";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { registrarMemoriaAutomatica } from "@/lib/firestore";
import { Zap, Plus, X, CheckCircle, Clock, AlertTriangle, TrendingUp, Target, Flag, MapPin, User, ChevronRight, Shield } from "lucide-react";
import toast from "react-hot-toast";

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<MissaoTipo, { label: string; icon: string; cor: string }> = {
  criar_assessoria:    { label: "Criar Assessoria",      icon: "🏛️", cor: "text-red-400 bg-red-500/10 border-red-500/20"       },
  criar_coordenacao:   { label: "Criar Coordenação",     icon: "🎯", cor: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  fortalecer_base:     { label: "Fortalecer Base",       icon: "💪", cor: "text-blue-400 bg-blue-500/10 border-blue-500/20"       },
  expandir_territorio: { label: "Expandir Território",   icon: "🗺️", cor: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  reestruturar_regiao: { label: "Reestruturar Região",   icon: "⚙️", cor: "text-amber-400 bg-amber-500/10 border-amber-500/20"   },
};

const STATUS_CONFIG: Record<MissaoStatus, { label: string; cor: string; icone: string }> = {
  pendente:     { label: "Pendente",      cor: "text-white/40 bg-white/5 border-white/10",           icone: "⏳" },
  aceita:       { label: "Aceita",        cor: "text-blue-400 bg-blue-500/10 border-blue-500/20",    icone: "✅" },
  em_execucao:  { label: "Em Execução",   cor: "text-amber-400 bg-amber-500/10 border-amber-500/20", icone: "⚡" },
  concluida:    { label: "Concluída",     cor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icone: "🎯" },
  cancelada:    { label: "Cancelada",     cor: "text-red-400/60 bg-red-500/5 border-red-500/10",     icone: "✖️" },
};

const PRIO_STYLE: Record<string, string> = {
  P1: "text-red-400 bg-red-500/10 border-red-500/20",
  P2: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  P3: "text-white/35 bg-white/5 border-white/10",
};

const TITULO_AUTO: Record<MissaoTipo, (cidade: string) => string> = {
  criar_assessoria:    (c) => `Designar Assessoria — ${c}`,
  criar_coordenacao:   (c) => `Criar Coordenação — ${c}`,
  fortalecer_base:     (c) => `Fortalecer Base — ${c}`,
  expandir_territorio: (c) => `Expandir Território — ${c}`,
  reestruturar_regiao: (c) => `Reestruturar Região — ${c}`,
};

// ─── Card de Missão ───────────────────────────────────────────────────────────

function CardMissao({
  missao,
  onAcao,
  podeExecutar,
  atualizando,
}: {
  missao: Missao;
  onAcao?: (missao: Missao) => void;
  podeExecutar?: boolean;
  atualizando?: boolean;
}) {
  const tipo = TIPO_CONFIG[missao.tipo];
  const status = STATUS_CONFIG[missao.status];
  const prio = PRIO_STYLE[missao.prioridade];

  const proximaAcao =
    missao.status === "pendente"    ? { label: "Delegar →",       fn: onAcao } :
    missao.status === "aceita"      ? { label: "Concluir →",      fn: onAcao } :
    missao.status === "em_execucao" ? { label: "Concluir →",      fn: onAcao } :
    null;

  return (
    <div className="p-4 rounded-2xl bg-zinc-900 border border-white/5 hover:border-white/10 transition-all space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-base">{tipo.icon}</span>
            <p className="text-sm font-semibold text-white truncate">{missao.titulo}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${prio}`}>{missao.prioridade}</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${tipo.cor}`}>{tipo.label}</span>
            <span className="text-[10px] text-white/30">· {missao.cidade}</span>
          </div>
        </div>
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border ${status.cor}`}>
          {status.icone} {status.label}
        </span>
      </div>

      {/* Descrição */}
      {missao.descricao && (
        <p className="text-xs text-white/40 leading-relaxed">{missao.descricao}</p>
      )}

      {/* Meta */}
      <div className="flex items-center justify-between text-xs text-white/30">
        <div className="flex items-center gap-3 flex-wrap">
          {missao.criadoPorNome && (
            <span>Criada por: <span className="text-white/50">{missao.criadoPorNome}</span></span>
          )}
          {missao.responsavelNome && (
            <span>Responsável: <span className="text-white/50">{missao.responsavelNome}</span></span>
          )}
          {missao.prazo && (() => {
            const diasRestantes = Math.ceil((new Date(missao.prazo + "T00:00:00").getTime() - Date.now()) / 86400000);
            const atrasada = diasRestantes < 0;
            return (
              <span className={atrasada ? "text-red-400 font-medium" : diasRestantes <= 3 ? "text-amber-400" : "text-white/40"}>
                {atrasada ? `Atrasada · ${Math.abs(diasRestantes)}d` : `Prazo · ${diasRestantes}d (${new Date(missao.prazo + "T00:00:00").toLocaleDateString("pt-BR")})`}
              </span>
            );
          })()}
        </div>
        {missao.resultado && (
          <span className="text-emerald-400/70 text-[10px]">{missao.resultado}</span>
        )}
      </div>

      {/* Ação */}
      {podeExecutar && proximaAcao && (
        <div className="pt-2 border-t border-white/5 flex justify-end">
          <button
            onClick={() => !atualizando && proximaAcao.fn?.(missao)}
            disabled={atualizando}
            className="text-[11px] font-medium text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {atualizando ? "Atualizando..." : proximaAcao.label}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Modal de execução (assessor executivo) ───────────────────────────────────

function ModalExecucao({
  missao,
  assessores,
  onClose,
  onConcluir,
}: {
  missao: Missao;
  assessores: AppUser[];
  onClose: () => void;
  onConcluir: (resultado: string) => void;
}) {
  const [aba, setAba] = useState<"existente" | "novo">("existente");
  const [assessorSelecionado, setAssessorSelecionado] = useState("");
  const [nomeNovo, setNomeNovo] = useState("");
  const [emailNovo, setEmailNovo] = useState("");
  const [telefoneNovo, setTelefoneNovo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { userData } = useAuth();

  const assessoresDaCidade = assessores.filter((a) =>
    (a as any).cidade === missao.cidade ||
    (Array.isArray(a.cidades) && a.cidades.includes(missao.cidade)) ||
    (a as any).cidadePrincipal === missao.cidade
  );

  async function executar() {
    if (aba === "existente" && !assessorSelecionado) {
      toast.error("Selecione um assessor."); return;
    }
    if (aba === "novo" && !nomeNovo.trim()) {
      toast.error("Informe o nome do novo assessor."); return;
    }
    setSalvando(true);
    try {
      const campanhaId = userData?.campanhaId || userData?.gabineteId || "";

      const assessorRef = assessores.find((a) => a.uid === assessorSelecionado);
      const nomeDefinitivo = aba === "existente" ? (assessorRef?.nome ?? "") : nomeNovo.trim();
      const idDefinitivo   = aba === "existente" ? assessorSelecionado : "";

      if (missao.tipo === "criar_assessoria" || missao.tipo === "expandir_territorio") {
        const docAssessoria: Record<string, any> = {
          municipio:     missao.cidade,
          campanhaId,
          assessorId:    idDefinitivo,
          assessorNome:  nomeDefinitivo,
          status:        "ativa",
          criadoEm:      Timestamp.now(),
          criadoPor:     userData?.uid ?? "",
          criadoPorNome: userData?.nome ?? "",
        };
        if (aba === "novo") {
          if (emailNovo.trim())    docAssessoria.emailPendente    = emailNovo.trim();
          if (telefoneNovo.trim()) docAssessoria.telefonePendente = telefoneNovo.trim();
          docAssessoria.statusCadastro = "pendente_ativacao";
        }
        await addDoc(collection(db, "assessorias"), docAssessoria);
      } else if (missao.tipo === "criar_coordenacao" || missao.tipo === "reestruturar_regiao") {
        const docCoordenacao: Record<string, any> = {
          municipio:      missao.cidade,
          campanhaId,
          coordenadorId:  idDefinitivo,
          coordenadorNome: nomeDefinitivo,
          status:         "ativa",
          criadoEm:       Timestamp.now(),
          criadoPor:      userData?.uid ?? "",
          criadoPorNome:  userData?.nome ?? "",
        };
        if (aba === "novo") {
          if (emailNovo.trim())    docCoordenacao.emailPendente    = emailNovo.trim();
          if (telefoneNovo.trim()) docCoordenacao.telefonePendente = telefoneNovo.trim();
          docCoordenacao.statusCadastro = "pendente_ativacao";
        }
        await addDoc(collection(db, "coordenacoes"), docCoordenacao);
      }

      const resultado =
        aba === "existente"
          ? `Designado: ${assessores.find((a) => a.uid === assessorSelecionado)?.nome ?? assessorSelecionado}`
          : `Criado: ${nomeNovo.trim()}`;

      await registrarMemoriaAutomatica({
        campanhaId,
        tipo:           "expansao",
        titulo:         missao.titulo,
        descricao:      resultado,
        cidade:         missao.cidade,
        classificacao:  missao.prioridade,
        prioridade:     missao.prioridade === "P1" ? "alta" : missao.prioridade === "P2" ? "media" : "baixa",
        status:         "concluido",
        resultado,
        responsavelId:  userData?.uid,
        responsavelNome: userData?.nome,
        origem:         "manual",
      });

      onConcluir(resultado);
      toast.success("Missão concluída!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao executar missão.");
    } finally {
      setSalvando(false);
    }
  }

  const isCriacao = ["criar_assessoria", "expandir_territorio"].includes(missao.tipo);
  const entidade = isCriacao ? "Assessor" : "Coordenador";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Executar Missão</p>
            <p className="text-lg font-bold text-white">{missao.titulo}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${PRIO_STYLE[missao.prioridade]}`}>{missao.prioridade}</span>
              <span className="text-xs text-white/40">{missao.cidade}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        {/* Pergunta */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-sm text-white/70 mb-3">Existe {entidade.toLowerCase()} disponível para <span className="text-white font-medium">{missao.cidade}</span>?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setAba("existente")}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${aba === "existente" ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "bg-white/5 text-white/40 hover:bg-white/10"}`}
            >
              ✅ SIM — Selecionar
            </button>
            <button
              onClick={() => setAba("novo")}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${aba === "novo" ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "bg-white/5 text-white/40 hover:bg-white/10"}`}
            >
              ➕ NÃO — Criar Novo
            </button>
          </div>
        </div>

        {/* Aba: selecionar existente */}
        {aba === "existente" && (
          <div className="space-y-2">
            <p className="text-xs text-white/30 uppercase tracking-wider">Selecionar {entidade} existente</p>
            {assessoresDaCidade.length === 0 ? (
              <p className="text-xs text-white/30 py-3 text-center">Nenhum {entidade.toLowerCase()} encontrado para {missao.cidade}.</p>
            ) : (
              <div className="space-y-1.5">
                {assessoresDaCidade.map((a) => (
                  <button
                    key={a.uid}
                    onClick={() => setAssessorSelecionado(a.uid)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                      assessorSelecionado === a.uid
                        ? "bg-violet-500/15 border border-violet-500/30"
                        : "bg-zinc-900 border border-white/5 hover:border-white/10"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-sm">
                      {a.nome?.[0] ?? "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{a.nome}</p>
                      <p className="text-[10px] text-white/30">{a.email}</p>
                    </div>
                    {assessorSelecionado === a.uid && (
                      <CheckCircle size={16} className="ml-auto text-violet-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
            {assessoresDaCidade.length === 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-white/30 mt-2">Todos os assessores disponíveis:</p>
                {assessores.slice(0, 5).map((a) => (
                  <button
                    key={a.uid}
                    onClick={() => setAssessorSelecionado(a.uid)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                      assessorSelecionado === a.uid
                        ? "bg-violet-500/15 border border-violet-500/30"
                        : "bg-zinc-900 border border-white/5 hover:border-white/10"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-sm">
                      {a.nome?.[0] ?? "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{a.nome}</p>
                      <p className="text-[10px] text-white/30">{a.email}</p>
                    </div>
                    {assessorSelecionado === a.uid && (
                      <CheckCircle size={16} className="ml-auto text-violet-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Aba: criar novo */}
        {aba === "novo" && (
          <div className="space-y-3">
            <p className="text-xs text-white/30 uppercase tracking-wider">Novo {entidade} Regional</p>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-white/40 block mb-1">Nome *</label>
                <input
                  value={nomeNovo}
                  onChange={(e) => setNomeNovo(e.target.value)}
                  placeholder={`Nome do ${entidade.toLowerCase()}`}
                  className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50"
                  style={{ colorScheme: "dark" }}
                />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">E-mail</label>
                <input
                  value={emailNovo}
                  onChange={(e) => setEmailNovo(e.target.value)}
                  placeholder="email@exemplo.com"
                  type="email"
                  className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50"
                  style={{ colorScheme: "dark" }}
                />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">Telefone</label>
                <input
                  value={telefoneNovo}
                  onChange={(e) => setTelefoneNovo(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50"
                  style={{ colorScheme: "dark" }}
                />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">Cidade principal</label>
                <input
                  value={missao.cidade}
                  readOnly
                  className="w-full bg-zinc-800 border border-zinc-700 text-white/50 rounded-xl px-3 py-2.5 text-sm cursor-not-allowed"
                  style={{ colorScheme: "dark" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Botão confirmar */}
        <button
          onClick={executar}
          disabled={salvando || (aba === "existente" && !assessorSelecionado) || (aba === "novo" && !nomeNovo.trim())}
          className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {salvando ? "Executando..." : aba === "existente" ? "Designar e Concluir" : "Criar e Concluir"}
        </button>
      </div>
    </div>
  );
}

// ─── Modal de Delegação (assessor executivo) ───────────────────────────────────

function ModalDelegacao({
  missao,
  assessores,
  onClose,
  onDelegar,
}: {
  missao: Missao;
  assessores: AppUser[];
  onClose: () => void;
  onDelegar: (assessorId: string, assessorNome: string) => Promise<void>;
}) {
  const [assessorId, setAssessorId] = useState("");
  const [salvando, setSalvando] = useState(false);

  const assessoresDaCidade = assessores.filter(
    (a) =>
      (a as any).cidade === missao.cidade ||
      (Array.isArray(a.cidades) && a.cidades.includes(missao.cidade)) ||
      (a as any).cidadePrincipal === missao.cidade
  );
  const lista = assessoresDaCidade.length > 0 ? assessoresDaCidade : assessores.filter((a) => a.ativo !== false);

  async function confirmar() {
    if (!assessorId) { toast.error("Selecione um assessor regional."); return; }
    const assessor = assessores.find((a) => a.uid === assessorId);
    if (!assessor) return;
    setSalvando(true);
    try {
      await onDelegar(assessor.uid, assessor.nome);
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Delegar Missão</p>
            <p className="text-base font-bold text-white">{missao.titulo}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${PRIO_STYLE[missao.prioridade]}`}>{missao.prioridade}</span>
              <span className="text-xs text-white/40">{missao.cidade}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-white/40 block">Assessor Responsável</label>
          {lista.length === 0 ? (
            <p className="text-xs text-white/30 py-3 text-center">Nenhum assessor regional cadastrado.</p>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {lista.map((a) => (
                <button
                  key={a.uid}
                  onClick={() => setAssessorId(a.uid)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    assessorId === a.uid
                      ? "bg-violet-500/15 border-violet-500/30"
                      : "bg-white/3 border-white/5 hover:bg-white/8 hover:border-white/10"
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                    <User size={13} className="text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">{a.nome}</p>
                    <p className="text-[10px] text-white/30">
                      {a.cidadePrincipal || (Array.isArray(a.cidades) && a.cidades[0]) || "—"}
                    </p>
                  </div>
                  {assessorId === a.uid && (
                    <CheckCircle size={14} className="text-violet-400 ml-auto shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!assessorId || salvando}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {salvando ? "Delegando..." : "Delegar →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function MissoesPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [assessores, setAssessores] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalCriar, setModalCriar] = useState(false);
  const [modalExec, setModalExec] = useState<Missao | null>(null);
  const [modalDelegar, setModalDelegar] = useState<Missao | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<MissaoStatus | "todas">("todas");
  const [salvando, setSalvando] = useState(false);
  const [atualizandoId, setAtualizandoId] = useState<string | null>(null);

  const [form, setForm] = useState<{
    tipo: MissaoTipo;
    cidade: string;
    prioridade: "P1" | "P2" | "P3";
    descricao: string;
    prazo: string;
  }>({ tipo: "criar_assessoria", cidade: "", prioridade: "P1", descricao: "", prazo: "" });

  const canCreateMission  = isPolitico(userData) || isAssessorExecutivo(userData) || isSuperOrMaster(userData);

  const cidadesDaCampanha = useMemo(() => {
    const set = new Set<string>();
    assessores.forEach((a) => {
      if (a.cidadePrincipal) set.add(a.cidadePrincipal);
      if ((a as any).cidade) set.add((a as any).cidade);
      if (Array.isArray(a.cidades)) a.cidades.forEach((c: string) => set.add(c));
    });
    return Array.from(set).sort();
  }, [assessores]);
  const canExecuteMission = isAssessorExecutivo(userData) || isAssessor(userData) || isSuperOrMaster(userData);

  async function loadData() {
    if (!userData) return;
    setLoading(true);
    try {
      const campanhaId = userData.campanhaId || userData.gabineteId || "";
      // Assessor regional só vê missões delegadas a ele — executivo/político vê todas da campanha
      const q = isAssessor(userData) && !isAssessorExecutivo(userData) && userData?.uid
        ? (campanhaId
            ? query(collection(db, "missoes"), where("campanhaId", "==", campanhaId), where("responsavelId", "==", userData.uid))
            : query(collection(db, "missoes"), where("responsavelId", "==", userData.uid)))
        : (campanhaId
            ? query(collection(db, "missoes"), where("campanhaId", "==", campanhaId))
            : query(collection(db, "missoes")));
      const snap = await getDocs(q);
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Missao))
        .sort((a, b) => {
          const ta = (a.criadoEm as any)?.toMillis?.() ?? 0;
          const tb = (b.criadoEm as any)?.toMillis?.() ?? 0;
          return tb - ta;
        });
      setMissoes(sorted);

      if (canExecuteMission) {
        const aQ = campanhaId
          ? query(collection(db, "usuarios"), where("role", "==", "assessor"), where("campanhaId", "==", campanhaId))
          : query(collection(db, "usuarios"), where("role", "==", "assessor"));
        const aSnap = await getDocs(aQ);
        setAssessores(aSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!userData) return;
    if (!isPolitico(userData) && !isAssessorExecutivo(userData) && !isSuperOrMaster(userData) && !isAssessor(userData)) {
      router.push("/dashboard");
      return;
    }
    loadData();

    if (canCreateMission && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("acao") === "nova") {
        const tipo = params.get("tipo") as MissaoTipo | null;
        const cidade = params.get("cidade") || "";
        const prioridade = params.get("prioridade") as "P1" | "P2" | "P3" | null;
        const descricao = params.get("descricao") || "";
        setForm((f) => ({
          ...f,
          ...(tipo && Object.keys(TIPO_CONFIG).includes(tipo) ? { tipo } : {}),
          ...(cidade ? { cidade } : {}),
          ...(prioridade && ["P1", "P2", "P3"].includes(prioridade) ? { prioridade } : {}),
          ...(descricao ? { descricao } : {}),
        }));
        setModalCriar(true);
      }
    }
  }, [userData]);

  async function criarMissao() {
    if (!form.cidade.trim()) { toast.error("Informe o município."); return; }
    const campanhaId = userData?.campanhaId || userData?.gabineteId || "";
    if (!campanhaId) { toast.error("Erro: campanha não identificada. Recarregue a página."); return; }
    setSalvando(true);
    try {
      await addDoc(collection(db, "missoes"), {
        campanhaId,
        origem:        "deputado",
        tipo:          form.tipo,
        titulo:        TITULO_AUTO[form.tipo](form.cidade.trim()),
        ...(form.descricao.trim() ? { descricao: form.descricao.trim() } : {}),
        ...(form.prazo ? { prazo: form.prazo } : {}),
        cidade:        form.cidade.trim(),
        prioridade:    form.prioridade,
        status:        "pendente",
        criadoPorId:   userData?.uid ?? "",
        criadoPorNome: userData?.nome ?? "",
        criadoEm:      Timestamp.now(),
      });
      toast.success(isPolitico(userData) ? "Missão criada e delegada ao Assessor Executivo!" : "Missão criada! Delegue ao assessor regional a partir da lista.");
      setModalCriar(false);
      setForm({ tipo: "criar_assessoria", cidade: "", prioridade: "P1", descricao: "", prazo: "" });
      await loadData();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao criar missão.");
    } finally {
      setSalvando(false);
    }
  }

  async function delegarMissao(missao: Missao, assessorId: string, assessorNome: string) {
    if (!missao.id) return;
    setAtualizandoId(missao.id);
    try {
      await updateDoc(doc(db, "missoes", missao.id), {
        status:          "aceita",
        responsavelId:   assessorId,
        responsavelNome: assessorNome,
        delegadoPor:     userData?.uid ?? "",
        delegadoPorNome: userData?.nome ?? "",
        delegadoEm:      Timestamp.now(),
      });
      toast.success(`Missão delegada para ${assessorNome}!`);
      await loadData();
    } catch (e) {
      toast.error("Erro ao delegar missão.");
    } finally {
      setAtualizandoId(null);
    }
  }

  async function avancarStatus(missao: Missao) {
    if (!missao.id) return;
    if (missao.status === "pendente") {
      // Executivo/Admin abre modal de delegação — não avança sem responsável
      setModalDelegar(missao);
    } else if (missao.status === "aceita" || missao.status === "em_execucao") {
      // Abre modal de conclusão (cria assessoria/coordenacao + memória)
      setModalExec(missao);
    }
  }

  async function concluirMissao(missao: Missao, resultado: string) {
    if (!missao.id) return;
    try {
      await updateDoc(doc(db, "missoes", missao.id), {
        status:            "concluida",
        concluidoEm:       Timestamp.now(),
        concluidoPor:      userData?.uid ?? "",
        concluidoPorNome:  userData?.nome ?? "",
        resultado,
      });
      setModalExec(null);
      await loadData();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao concluir missão.");
    }
  }

  const missoesFiltradas = useMemo(() =>
    filtroStatus === "todas" ? missoes : missoes.filter((m) => m.status === filtroStatus),
    [missoes, filtroStatus]
  );

  const stats = useMemo(() => ({
    pendentes:    missoes.filter((m) => m.status === "pendente").length,
    emExecucao:   missoes.filter((m) => m.status === "em_execucao" || m.status === "aceita").length,
    concluidas:   missoes.filter((m) => m.status === "concluida").length,
    total:        missoes.length,
  }), [missoes]);

  if (!userData) return null;
  const config = getRoleConfig(userData);

  const FILTROS: { key: MissaoStatus | "todas"; label: string }[] = [
    { key: "todas",       label: "Todas"       },
    { key: "pendente",    label: "Pendentes"   },
    { key: "em_execucao", label: "Em Execução" },
    { key: "concluida",   label: "Concluídas"  },
  ];

  return (
    <div className="space-y-6 animate-in">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                <Zap size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  {canCreateMission ? "Missões do Mandato" : "Caixa de Missões"}
                </h1>
                <p className="text-xs text-white/30">
                  {canCreateMission
                    ? "Crie e delegue missões ao Assessor Executivo"
                    : "Missões recebidas do Deputado Federal"}
                </p>
              </div>
            </div>
          </div>
          {canCreateMission && (
            <button
              onClick={() => setModalCriar(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition-colors"
            >
              <Plus size={16} />
              Nova Missão
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Pendentes",    value: stats.pendentes,  icon: Clock,       cor: "text-white/40"   },
            { label: "Em Execução",  value: stats.emExecucao, icon: Zap,         cor: "text-amber-400"  },
            { label: "Concluídas",   value: stats.concluidas, icon: CheckCircle, cor: "text-emerald-400"},
            { label: "Total",        value: stats.total,      icon: Target,      cor: "text-violet-400" },
          ].map(({ label, value, icon: Icon, cor }) => (
            <GlassCard key={label} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-white/30 uppercase tracking-wider">{label}</p>
                <Icon size={14} className={cor} />
              </div>
              <p className={`text-2xl font-bold ${cor}`}>{value}</p>
            </GlassCard>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 flex-wrap">
          {FILTROS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFiltroStatus(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                filtroStatus === key
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "bg-white/5 text-white/40 hover:bg-white/10 border border-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 rounded-2xl bg-zinc-900 border border-white/5 space-y-3 animate-pulse">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/5 rounded w-3/4" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                  </div>
                  <div className="h-6 w-20 bg-white/5 rounded-full" />
                </div>
                <div className="h-3 bg-white/5 rounded w-full" />
                <div className="h-8 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        ) : missoesFiltradas.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-4xl">🎯</p>
            <p className="text-white/40 text-sm">
              {filtroStatus !== "todas"
                ? `Nenhuma missão com status "${STATUS_CONFIG[filtroStatus as MissaoStatus]?.label ?? filtroStatus}".`
                : canCreateMission
                  ? "Nenhuma missão criada. Use o botão acima para criar a primeira missão e delegar ao time."
                  : "Nenhuma missão delegada ainda. Aguardando criação pelo deputado."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {missoesFiltradas.map((m) => (
              <CardMissao
                key={m.id}
                missao={m}
                podeExecutar={canExecuteMission && m.status !== "concluida" && m.status !== "cancelada" && (isAssessorExecutivo(userData) || isSuperOrMaster(userData) || !m.responsavelId || m.responsavelId === userData?.uid)}
                onAcao={(missao) => avancarStatus(missao)}
                atualizando={atualizandoId === m.id}
              />
            ))}
          </div>
        )}
      {/* Modal: Criar Missão (Deputado) */}
      {modalCriar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setModalCriar(false)}>
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Nova Missão</p>
                <p className="text-lg font-bold text-white">
                  {isPolitico(userData) ? "Delegar ao Assessor Executivo" : isAssessorExecutivo(userData) ? "Delegar ao Assessor Regional" : "Nova Missão Territorial"}
                </p>
              </div>
              <button onClick={() => setModalCriar(false)} className="text-white/30 hover:text-white transition-colors"><X size={20} /></button>
            </div>

            <div className="space-y-3">
              {/* Tipo */}
              <div>
                <label className="text-xs text-white/40 block mb-1">Tipo de Missão</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as MissaoTipo }))}
                  className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/50"
                  style={{ colorScheme: "dark" }}
                >
                  {Object.entries(TIPO_CONFIG).map(([k, v]) => (
                    <option key={k} value={k} className="bg-zinc-950">{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>

              {/* Município */}
              <div>
                <label className="text-xs text-white/40 block mb-1">Município *</label>
                {cidadesDaCampanha.length > 0 ? (
                  <select
                    value={form.cidade}
                    onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/50"
                    style={{ colorScheme: "dark" }}
                  >
                    <option value="">Selecione o município</option>
                    {cidadesDaCampanha.map((c) => (
                      <option key={c} value={c} className="bg-zinc-950">{c}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form.cidade}
                    onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
                    placeholder="Ex: Petrolina"
                    className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50"
                    style={{ colorScheme: "dark" }}
                  />
                )}
              </div>

              {/* Prioridade */}
              <div>
                <label className="text-xs text-white/40 block mb-1">Prioridade</label>
                <div className="flex gap-2">
                  {(["P1", "P2", "P3"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setForm((f) => ({ ...f, prioridade: p }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${
                        form.prioridade === p ? PRIO_STYLE[p] : "bg-white/5 text-white/30 border-white/5"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prazo */}
              <div>
                <label className="text-xs text-white/40 block mb-1">Prazo (opcional)</label>
                <input
                  type="date"
                  value={form.prazo}
                  onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/50"
                  style={{ colorScheme: "dark" }}
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="text-xs text-white/40 block mb-1">Descrição (opcional)</label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  placeholder={isPolitico(userData) ? "Contexto e instruções para o Assessor Executivo..." : "Contexto e instruções para o Assessor Regional..."}
                  rows={3}
                  className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50 resize-none"
                  style={{ colorScheme: "dark" }}
                />
              </div>
            </div>

            {/* Preview do título */}
            {form.cidade.trim() && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Missão a ser criada</p>
                <p className="text-sm text-white font-medium">{TITULO_AUTO[form.tipo](form.cidade.trim())}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${PRIO_STYLE[form.prioridade]}`}>{form.prioridade}</span>
                  <span className="text-[10px] text-white/30">{isPolitico(userData) ? "→ Assessor Executivo" : "→ Assessor Regional"}</span>
                </div>
              </div>
            )}

            <button
              onClick={criarMissao}
              disabled={salvando || !form.cidade.trim()}
              className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {salvando ? "Criando..." : "Criar e Delegar Missão"}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Delegar Missão (Assessor Executivo) */}
      {modalDelegar && (
        <ModalDelegacao
          missao={modalDelegar}
          assessores={assessores}
          onClose={() => setModalDelegar(null)}
          onDelegar={(assessorId, assessorNome) => delegarMissao(modalDelegar, assessorId, assessorNome)}
        />
      )}

      {/* Modal: Concluir Missão (Assessor Executivo / Regional) */}
      {modalExec && (
        <ModalExecucao
          missao={modalExec}
          assessores={assessores}
          onClose={() => setModalExec(null)}
          onConcluir={(resultado) => concluirMissao(modalExec, resultado)}
        />
      )}
    </div>
  );
}

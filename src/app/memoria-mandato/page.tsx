"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { isPolitico, isPrefeito, isVereador, isAssessor, isAssessorExecutivo, isSuperOrMaster } from "@/lib/permissions";
import { MemoriaMandato } from "@/types";
import { serverTimestamp } from "firebase/firestore";
import { criarMemoriaMandato, buscarMemoriasMandato, atualizarMemoriaMandato, registrarPendenciaConcluida, registrarAlertaResolvido } from "@/lib/firestore";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { BookOpen, Plus, MapPin, Calendar, User, Tag, X, Filter, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { formatDate } from "@/lib/utils";

// ── Config visual ─────────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<NonNullable<MemoriaMandato["tipo"]>, { label: string; color: string; bg: string; border: string; dot: string; line: string }> = {
  decisao:  { label: "Decisão",   color: "text-blue-400",    bg: "bg-blue-500/15",    border: "border-blue-500/30",    dot: "bg-blue-500",    line: "bg-blue-500/10"    },
  pendencia:{ label: "Pendência", color: "text-amber-400",   bg: "bg-amber-500/15",   border: "border-amber-500/30",   dot: "bg-amber-500",   line: "bg-amber-500/10"   },
  alerta:   { label: "Alerta",    color: "text-red-400",     bg: "bg-red-500/15",     border: "border-red-500/30",     dot: "bg-red-500",     line: "bg-red-500/10"     },
  conquista:{ label: "Conquista", color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30", dot: "bg-emerald-500", line: "bg-emerald-500/10" },
  expansao: { label: "Expansão",  color: "text-purple-400",  bg: "bg-purple-500/15",  border: "border-purple-500/30",  dot: "bg-purple-500",  line: "bg-purple-500/10"  },
};

const PRIORIDADE_CONFIG: Record<NonNullable<MemoriaMandato["prioridade"]>, { label: string; color: string; bg: string }> = {
  alta:  { label: "Alta",  color: "text-red-400",   bg: "bg-red-500/15"   },
  media: { label: "Média", color: "text-amber-400", bg: "bg-amber-500/15" },
  baixa: { label: "Baixa", color: "text-slate-400", bg: "bg-slate-500/15" },
};

const STATUS_CONFIG: Record<NonNullable<MemoriaMandato["status"]>, { label: string; color: string; bg: string }> = {
  aberto:    { label: "Aberto",    color: "text-blue-400",    bg: "bg-blue-500/15"    },
  concluido: { label: "Concluído", color: "text-emerald-400", bg: "bg-emerald-500/15" },
  cancelado: { label: "Cancelado", color: "text-slate-400",   bg: "bg-slate-500/15"   },
};

const CLASS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  P1: { label: "P1 · Crítico",    color: "text-red-400",   bg: "bg-red-500/15"   },
  P2: { label: "P2 · Relevante",  color: "text-amber-400", bg: "bg-amber-500/15" },
  P3: { label: "P3 · Arquivo",    color: "text-slate-400", bg: "bg-slate-500/15" },
};

const BAR_COR: Record<NonNullable<MemoriaMandato["tipo"]>, string> = {
  conquista: "bg-emerald-500",
  decisao:   "bg-blue-500",
  expansao:  "bg-purple-500",
  pendencia: "bg-amber-500",
  alerta:    "bg-red-500",
};

// ── Form state ────────────────────────────────────────────────────────────────

const FORM_VAZIO = {
  tipo: "decisao" as MemoriaMandato["tipo"],
  titulo: "",
  descricao: "",
  prioridade: "media" as MemoriaMandato["prioridade"],
  status: "aberto" as MemoriaMandato["status"],
  cidade: "",
  classificacao: "" as MemoriaMandato["classificacao"] | "",
  responsavelNome: "",
  origem: "manual" as MemoriaMandato["origem"],
  motivo: "",
  resultado: "",
  impacto: "",
  tagsTexto: "",
};

// ── Página ────────────────────────────────────────────────────────────────────

export default function MemoriaMandatoPage() {
  const { userData } = useAuth();
  const router = useRouter();

  const [memorias, setMemorias] = useState<MemoriaMandato[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({ ...FORM_VAZIO });

  const [buscaTexto, setBuscaTexto] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroClass, setFiltroClass] = useState("");
  const [filtroCidade, setFiltroCidade] = useState("");

  const [modalConcluir, setModalConcluir] = useState<MemoriaMandato | null>(null);
  const [formConcluir, setFormConcluir] = useState({ resultado: "", impacto: "" });
  const [salvandoConcluir, setSalvandoConcluir] = useState(false);

  const campanhaId = userData?.campanhaId || userData?.gabineteId || "";
  const podeEscrever = userData ? (isPolitico(userData) || isPrefeito(userData) || isVereador(userData) || isAssessorExecutivo(userData) || isSuperOrMaster(userData)) : false;
  const filtrosAtivos = !!(buscaTexto || filtroTipo || filtroStatus || filtroClass || filtroCidade);

  useEffect(() => {
    if (!userData) return;
    if (!isPolitico(userData) && !isPrefeito(userData) && !isVereador(userData) && !isAssessorExecutivo(userData) && !isAssessor(userData) && !isSuperOrMaster(userData)) {
      router.push("/dashboard");
      return;
    }
    if (!campanhaId) { setLoading(false); return; }
    buscarMemoriasMandato(campanhaId)
      .then(setMemorias)
      .catch(() => toast.error("Erro ao carregar memórias", { duration: 4000 }))
      .finally(() => setLoading(false));
  }, [userData, campanhaId]);

  const cidadesDisponiveis = useMemo(() => {
    const set = new Set(memorias.map((m) => m.cidade).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [memorias]);

  const memoriasFiltradas = useMemo(() => {
    return memorias.filter((m) => {
      if (filtroTipo && m.tipo !== filtroTipo) return false;
      if (filtroStatus && m.status !== filtroStatus) return false;
      if (filtroClass && m.classificacao !== filtroClass) return false;
      if (filtroCidade && m.cidade !== filtroCidade) return false;
      if (buscaTexto) {
        const q = buscaTexto.toLowerCase();
        return (
          m.titulo.toLowerCase().includes(q) ||
          m.descricao.toLowerCase().includes(q) ||
          (m.cidade || "").toLowerCase().includes(q) ||
          (m.responsavelNome || "").toLowerCase().includes(q) ||
          (m.tags || []).some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [memorias, buscaTexto, filtroTipo, filtroStatus, filtroClass, filtroCidade]);

  const kpiConcluidos = memoriasFiltradas.filter((m) => m.status === "concluido").length;
  const kpiTaxa       = memorias.length > 0 ? Math.round((memorias.filter((m) => m.status === "concluido").length / memorias.length) * 100) : 0;
  const kpiUltimo     = memorias.length > 0 ? formatDate(memorias[0].criadoEm) : "—";

  const estrategiasVencedoras = useMemo(() => {
    return (["decisao", "pendencia", "alerta", "conquista", "expansao"] as const)
      .map((tipo) => {
        const doTipo = memorias.filter((m) => m.tipo === tipo);
        const sucessos = doTipo.filter((m) => m.status === "concluido").length;
        const quantidade = doTipo.length;
        return { tipo, quantidade, sucessos, taxaSucesso: quantidade > 0 ? Math.round((sucessos / quantidade) * 100) : 0 };
      })
      .filter((e) => e.quantidade > 0)
      .sort((a, b) => b.taxaSucesso - a.taxaSucesso);
  }, [memorias]);

  const sugestaoIA = useMemo((): { titulo: string; descricao: string; recomendacao: string; base: number; taxa: number } => {
    const total = memorias.length;
    if (total === 0) return { titulo: "Inicie sua história estratégica", descricao: "Nenhuma memória registrada ainda.", recomendacao: "Crie pelo menos 3 registros para ativar as sugestões inteligentes.", base: 0, taxa: 0 };
    const concluidos = memorias.filter((m) => m.status === "concluido").length;
    const taxa = Math.round((concluidos / total) * 100);
    const melhor = estrategiasVencedoras[0];
    if (melhor && melhor.taxaSucesso >= 50) {
      return {
        titulo: `Replicar padrão: ${TIPO_CONFIG[melhor.tipo].label.toUpperCase()}`,
        descricao: `Análise de ${total} registro${total !== 1 ? "s" : ""} indica que "${TIPO_CONFIG[melhor.tipo].label}" têm ${melhor.taxaSucesso}% de taxa de sucesso — o melhor padrão da campanha.`,
        recomendacao: `Priorize ações desse tipo nas regiões com menor cobertura. Padrão validado em ${melhor.sucessos} case${melhor.sucessos !== 1 ? "s" : ""}.`,
        base: total,
        taxa,
      };
    }
    const emAberto = memorias.filter((m) => m.status === "aberto").length;
    return {
      titulo: "Consolidar registros antes de expandir",
      descricao: `${emAberto} registro${emAberto !== 1 ? "s" : ""} em aberto e ${concluidos} concluído${concluidos !== 1 ? "s" : ""}. Taxa atual: ${taxa}%.`,
      recomendacao: emAberto > 0 ? `Resolva os ${emAberto} registro${emAberto !== 1 ? "s" : ""} em aberto para enriquecer a base de aprendizado.` : "Continue registrando para acumular histórico e ativar sugestões avançadas.",
      base: total,
      taxa,
    };
  }, [memorias, estrategiasVencedoras]);

  function limparFiltros() {
    setBuscaTexto("");
    setFiltroTipo("");
    setFiltroStatus("");
    setFiltroClass("");
    setFiltroCidade("");
  }

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleConcluir() {
    if (!modalConcluir?.id) return;
    setSalvandoConcluir(true);
    try {
      await atualizarMemoriaMandato(modalConcluir.id, {
        status: "concluido",
        ...(formConcluir.resultado.trim() && { resultado: formConcluir.resultado.trim() }),
        ...(formConcluir.impacto.trim() && { impacto: formConcluir.impacto.trim() }),
        resolvidoEm: serverTimestamp(),
      });
      if (modalConcluir.tipo === "pendencia") {
        await registrarPendenciaConcluida({
          campanhaId,
          titulo: modalConcluir.titulo,
          descricao: formConcluir.resultado.trim() || modalConcluir.descricao,
          ...(modalConcluir.cidade && { cidade: modalConcluir.cidade }),
          ...(formConcluir.resultado.trim() && { resultado: formConcluir.resultado.trim() }),
          ...(modalConcluir.responsavelId && { responsavelId: modalConcluir.responsavelId }),
          ...(modalConcluir.responsavelNome && { responsavelNome: modalConcluir.responsavelNome }),
        });
      } else if (modalConcluir.tipo === "alerta") {
        await registrarAlertaResolvido({
          campanhaId,
          titulo: modalConcluir.titulo,
          descricao: formConcluir.resultado.trim() || modalConcluir.descricao,
          ...(modalConcluir.cidade && { cidade: modalConcluir.cidade }),
          ...(modalConcluir.responsavelId && { responsavelId: modalConcluir.responsavelId }),
          ...(modalConcluir.responsavelNome && { responsavelNome: modalConcluir.responsavelNome }),
        });
      }
      setMemorias((prev) =>
        prev.map((m) =>
          m.id === modalConcluir.id
            ? {
                ...m,
                status: "concluido",
                ...(formConcluir.resultado.trim() && { resultado: formConcluir.resultado.trim() }),
                ...(formConcluir.impacto.trim() && { impacto: formConcluir.impacto.trim() }),
              }
            : m
        )
      );
      toast.success("Memória concluída");
      setModalConcluir(null);
      setFormConcluir({ resultado: "", impacto: "" });
    } catch {
      toast.error("Erro ao concluir memória", { duration: 4000 });
    } finally {
      setSalvandoConcluir(false);
    }
  }

  async function handleSalvar() {
    if (!form.titulo.trim()) { toast.error("Título obrigatório", { duration: 4000 }); return; }
    if (!form.descricao.trim()) { toast.error("Descrição obrigatória", { duration: 4000 }); return; }
    if (!campanhaId) { toast.error("Campanha não encontrada", { duration: 4000 }); return; }
    setSalvando(true);
    try {
      const payload: Omit<MemoriaMandato, "id" | "criadoEm" | "atualizadoEm" | "resolvidoEm"> = {
        campanhaId,
        tipo: form.tipo,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        prioridade: form.prioridade,
        status: form.status,
        origem: form.origem,
      };
      if (form.cidade.trim()) payload.cidade = form.cidade.trim();
      if (form.classificacao) payload.classificacao = form.classificacao as MemoriaMandato["classificacao"];
      if (form.responsavelNome.trim()) payload.responsavelNome = form.responsavelNome.trim();
      if (form.motivo.trim()) payload.motivo = form.motivo.trim();
      if (form.resultado.trim()) payload.resultado = form.resultado.trim();
      if (form.impacto.trim()) payload.impacto = form.impacto.trim();
      if (form.tagsTexto.trim()) {
        payload.tags = form.tagsTexto.split(",").map((t) => t.trim()).filter(Boolean);
      }
      await criarMemoriaMandato(payload);
      toast.success("Memória registrada");
      setModalAberto(false);
      setForm({ ...FORM_VAZIO });
      const atualizadas = await buscarMemoriasMandato(campanhaId);
      setMemorias(atualizadas);
    } catch {
      toast.error("Erro ao salvar memória", { duration: 4000 });
    } finally {
      setSalvando(false);
    }
  }

  if (!userData) return null;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <BookOpen size={22} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Memória do Mandato</h1>
            <p className="text-sm text-white/40 mt-0.5">
              {memorias.length > 0 ? `${memorias.length} registro${memorias.length !== 1 ? "s" : ""}` : "Nenhum registro ainda"}
            </p>
          </div>
        </div>
        {podeEscrever && (
          <button
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-sm font-medium transition-all"
          >
            <Plus size={16} />
            Nova Memória
          </button>
        )}
      </div>

      {/* Filtros */}
      <GlassCard className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-45">
            <Input
              placeholder="Buscar por título, cidade, tag…"
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-30">
            <Select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              options={Object.entries(TIPO_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            />
          </div>
          <div className="flex-1 min-w-30">
            <Select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            />
          </div>
          <div className="flex-1 min-w-24">
            <Select
              value={filtroClass}
              onChange={(e) => setFiltroClass(e.target.value)}
              options={Object.keys(CLASS_CONFIG).map((v) => ({ value: v, label: v }))}
            />
          </div>
          {cidadesDisponiveis.length > 0 && (
            <div className="flex-1 min-w-30">
              <Select
                value={filtroCidade}
                onChange={(e) => setFiltroCidade(e.target.value)}
                options={cidadesDisponiveis.map((c) => ({ value: c, label: c }))}
              />
            </div>
          )}
          {filtrosAtivos && (
            <button
              onClick={limparFiltros}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white text-xs transition-all"
            >
              <X size={13} /> Limpar
            </button>
          )}
        </div>
        {filtrosAtivos && (
          <p className="text-xs text-white/30 mt-2">
            <Filter size={11} className="inline mr-1" />
            {memoriasFiltradas.length} de {memorias.length} resultado{memorias.length !== 1 ? "s" : ""}
          </p>
        )}
      </GlassCard>

      {/* KPIs */}
      {!loading && memorias.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-white/3 border border-white/6 text-center">
            <p className="text-2xl font-bold text-white">{memoriasFiltradas.length}</p>
            <p className="text-xs text-white/40 mt-0.5">Eventos</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-center">
            <p className="text-2xl font-bold text-emerald-400">{kpiConcluidos}</p>
            <p className="text-xs text-white/40 mt-0.5">Concluídos</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-center">
            <p className="text-2xl font-bold text-amber-400">{kpiTaxa}%</p>
            <p className="text-xs text-white/40 mt-0.5">Taxa de Sucesso</p>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/15 text-center flex flex-col items-center justify-center min-h-17">
            <p className="text-sm font-semibold text-purple-400 leading-snug">{kpiUltimo}</p>
            <p className="text-xs text-white/40 mt-0.5">Última Atual.</p>
          </div>
        </div>
      )}

      {/* APRENDIZADO ESTRATÉGICO */}
      {!loading && memorias.length >= 3 && estrategiasVencedoras.length > 0 && (
        <GlassCard className="p-5 border-amber-500/20">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🧠</span>
              <h2 className="text-white font-bold text-base">Aprendizado Estratégico</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Motor Ativo
            </span>
          </div>

          {/* Grid 2-col */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Col A — Estratégias Vencedoras */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm">🏆</span>
                <h3 className="text-white/80 font-semibold text-sm">Estratégias Vencedoras</h3>
                <span className="text-[10px] text-white/25 ml-1">por taxa de conclusão</span>
              </div>
              <div className="space-y-3">
                {estrategiasVencedoras.map((e) => {
                  const t = TIPO_CONFIG[e.tipo];
                  const cor = BAR_COR[e.tipo];
                  return (
                    <div key={e.tipo}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${cor} shrink-0`} />
                          <span className={`text-xs font-medium ${t.color}`}>{t.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-white/25">{e.sucessos}/{e.quantidade}</span>
                          <span className={`text-xs font-bold tabular-nums ${t.color}`}>{e.taxaSucesso}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${cor}`} style={{ width: `${e.taxaSucesso}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-white/20 mt-4 pt-3 border-t border-white/5">
                {estrategiasVencedoras.length} tipo{estrategiasVencedoras.length !== 1 ? "s" : ""} · {memorias.filter((m) => m.status === "concluido").length} concluído{memorias.filter((m) => m.status === "concluido").length !== 1 ? "s" : ""} de {memorias.length} registros
              </p>
            </div>

            {/* Col B — Recomendação IA */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm">🤖</span>
                <h3 className="text-white/80 font-semibold text-sm">Recomendação IA</h3>
              </div>
              <div className="flex flex-col gap-3 flex-1">
                <div>
                  <p className="text-[10px] text-amber-400/60 uppercase tracking-wider mb-1">Insight estratégico</p>
                  <p className="text-white font-bold text-sm leading-snug">{sugestaoIA.titulo}</p>
                </div>
                <p className="text-white/50 text-xs leading-relaxed">{sugestaoIA.descricao}</p>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-[10px] text-amber-400/70 uppercase tracking-wider mb-1.5">Recomendação</p>
                  <p className="text-amber-200 text-xs leading-relaxed">{sugestaoIA.recomendacao}</p>
                </div>
                <div className="flex items-center gap-4 pt-3 border-t border-white/5 mt-auto">
                  <div>
                    <p className="text-[10px] text-white/25 mb-0.5">Base histórica</p>
                    <p className="text-xs font-semibold text-white/60">{sugestaoIA.base} registro{sugestaoIA.base !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="w-px h-6 bg-white/10" />
                  <div>
                    <p className="text-[10px] text-white/25 mb-0.5">Efetividade</p>
                    <p className="text-xs font-bold text-amber-400">{sugestaoIA.taxa}%</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </GlassCard>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 animate-pulse lg:block">
              <div className="flex flex-col items-center lg:hidden">
                <div className="w-3 h-3 rounded-full bg-white/10 mt-1.5" />
                <div className="w-px flex-1 bg-white/5 mt-2" />
              </div>
              <div className="flex-1 bg-white/3 border border-white/6 rounded-2xl p-4 mb-4 lg:mb-0 h-24" />
            </div>
          ))}
        </div>
      ) : memoriasFiltradas.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <BookOpen size={36} className="text-white/15 mx-auto mb-4" />
          <p className="text-white/40 text-sm font-medium">
            {filtrosAtivos ? "Nenhum registro encontrado com os filtros atuais" : "Nenhum registro na memória do mandato"}
          </p>
          {!filtrosAtivos && podeEscrever && (
            <button
              onClick={() => setModalAberto(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 text-sm mx-auto hover:bg-amber-500/25 transition-all"
            >
              <Plus size={14} /> Criar primeiro registro
            </button>
          )}
        </GlassCard>
      ) : (
        <>
          {/* MOBILE — timeline vertical */}
          <div className="lg:hidden">
            {memoriasFiltradas.map((m, idx) => {
              const t = TIPO_CONFIG[m.tipo];
              const p = PRIORIDADE_CONFIG[m.prioridade];
              const s = STATUS_CONFIG[m.status];
              const c = m.classificacao ? CLASS_CONFIG[m.classificacao] : null;
              const isLast = idx === memoriasFiltradas.length - 1;
              return (
                <div key={m.id || idx} className="flex gap-4 mb-5">
                  <div className="flex flex-col items-center pt-1.5 shrink-0">
                    <div className={`w-3.5 h-3.5 rounded-full ${t.dot} ring-2 ring-black/60 shrink-0`} />
                    {!isLast && <div className={`w-px flex-1 ${t.line} mt-2`} />}
                  </div>
                  <div className={`flex-1 bg-white/3 border ${t.border} rounded-2xl p-4 hover:bg-white/5 transition-all`}>
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${t.color} ${t.bg} border ${t.border}`}>{t.label}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${p.color} ${p.bg}`}>{p.label}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${s.color} ${s.bg}`}>{s.label}</span>
                      {c && <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${c.color} ${c.bg}`}>{c.label}</span>}
                      {podeEscrever && m.status === "aberto" && (
                        <button onClick={() => { setModalConcluir(m); setFormConcluir({ resultado: m.resultado || "", impacto: m.impacto || "" }); }} className="ml-auto flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-xs font-medium transition-all shrink-0">
                          <CheckCircle size={11} /> Concluir
                        </button>
                      )}
                    </div>
                    <h3 className="text-white font-semibold text-sm mb-1">{m.titulo}</h3>
                    <p className="text-white/55 text-xs leading-relaxed mb-3">{m.descricao}</p>
                    {(m.motivo || m.resultado || m.impacto) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                        {m.motivo && <div className="bg-white/3 rounded-lg p-2"><p className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">Motivo</p><p className="text-white/60 text-xs">{m.motivo}</p></div>}
                        {m.resultado && <div className="bg-white/3 rounded-lg p-2"><p className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">Resultado</p><p className="text-white/60 text-xs">{m.resultado}</p></div>}
                        {m.impacto && <div className="bg-white/3 rounded-lg p-2"><p className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">Impacto</p><p className="text-white/60 text-xs">{m.impacto}</p></div>}
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 mt-2.5">
                      <div className="bg-white/3 rounded-lg p-2"><p className="text-[9px] text-white/25 uppercase tracking-wider mb-0.5 flex items-center gap-1"><MapPin size={9} /> Cidade</p><p className="text-xs text-white/60 font-medium truncate">{m.cidade || "—"}</p></div>
                      <div className="bg-white/3 rounded-lg p-2"><p className="text-[9px] text-white/25 uppercase tracking-wider mb-0.5 flex items-center gap-1"><User size={9} /> Responsável</p><p className="text-xs text-white/60 font-medium truncate">{m.responsavelNome || "—"}</p></div>
                      <div className="bg-white/3 rounded-lg p-2"><p className="text-[9px] text-white/25 uppercase tracking-wider mb-0.5 flex items-center gap-1"><Calendar size={9} /> Data</p><p className="text-xs text-white/60 font-medium">{m.criadoEm ? formatDate(m.criadoEm) : "—"}</p></div>
                    </div>
                    {m.tags && m.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5 pt-2.5 border-t border-white/5">
                        {m.tags.map((tag) => <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-white/40 text-[10px] border border-white/7"><Tag size={9} /> {tag}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP — grid executivo 2 colunas */}
          <div className="hidden lg:grid lg:grid-cols-2 gap-5">
            {memoriasFiltradas.map((m, idx) => {
              const t = TIPO_CONFIG[m.tipo];
              const p = PRIORIDADE_CONFIG[m.prioridade];
              const s = STATUS_CONFIG[m.status];
              const c = m.classificacao ? CLASS_CONFIG[m.classificacao] : null;
              return (
                <div key={`desk-${m.id || idx}`} className={`bg-white/3 border ${t.border} rounded-2xl p-4 hover:bg-white/5 transition-all flex flex-col`}>
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${t.color} ${t.bg} border ${t.border}`}>{t.label}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${p.color} ${p.bg}`}>{p.label}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${s.color} ${s.bg}`}>{s.label}</span>
                    {c && <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${c.color} ${c.bg}`}>{c.label}</span>}
                    {podeEscrever && m.status === "aberto" && (
                      <button onClick={() => { setModalConcluir(m); setFormConcluir({ resultado: m.resultado || "", impacto: m.impacto || "" }); }} className="ml-auto flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-xs font-medium transition-all shrink-0">
                        <CheckCircle size={11} /> Concluir
                      </button>
                    )}
                  </div>
                  <h3 className="text-white font-semibold text-sm mb-1">{m.titulo}</h3>
                  <p className="text-white/55 text-xs leading-relaxed mb-3">{m.descricao}</p>
                  {(m.motivo || m.resultado || m.impacto) && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {m.motivo && <div className="bg-white/3 rounded-lg p-2"><p className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">Motivo</p><p className="text-white/60 text-xs">{m.motivo}</p></div>}
                      {m.resultado && <div className="bg-white/3 rounded-lg p-2"><p className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">Resultado</p><p className="text-white/60 text-xs">{m.resultado}</p></div>}
                      {m.impacto && <div className="bg-white/3 rounded-lg p-2"><p className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">Impacto</p><p className="text-white/60 text-xs">{m.impacto}</p></div>}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 mt-auto pt-2.5">
                    <div className="bg-white/3 rounded-lg p-2"><p className="text-[9px] text-white/25 uppercase tracking-wider mb-0.5 flex items-center gap-1"><MapPin size={9} /> Cidade</p><p className="text-xs text-white/60 font-medium truncate">{m.cidade || "—"}</p></div>
                    <div className="bg-white/3 rounded-lg p-2"><p className="text-[9px] text-white/25 uppercase tracking-wider mb-0.5 flex items-center gap-1"><User size={9} /> Responsável</p><p className="text-xs text-white/60 font-medium truncate">{m.responsavelNome || "—"}</p></div>
                    <div className="bg-white/3 rounded-lg p-2"><p className="text-[9px] text-white/25 uppercase tracking-wider mb-0.5 flex items-center gap-1"><Calendar size={9} /> Data</p><p className="text-xs text-white/60 font-medium">{m.criadoEm ? formatDate(m.criadoEm) : "—"}</p></div>
                  </div>
                  {m.tags && m.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5 pt-2.5 border-t border-white/5">
                      {m.tags.map((tag) => <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-white/40 text-[10px] border border-white/7"><Tag size={9} /> {tag}</span>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal Concluir Memória */}
      <Modal open={!!modalConcluir} onClose={() => { setModalConcluir(null); setFormConcluir({ resultado: "", impacto: "" }); }} title="Concluir Memória">
        {modalConcluir && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-white/3 border border-white/6">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">{TIPO_CONFIG[modalConcluir.tipo].label}</p>
              <p className="text-sm text-white/80 font-medium leading-snug">{modalConcluir.titulo}</p>
            </div>
            <Input
              label="Resultado"
              value={formConcluir.resultado}
              onChange={(e) => setFormConcluir((f) => ({ ...f, resultado: e.target.value }))}
              placeholder="O que foi alcançado?"
            />
            <Input
              label="Impacto"
              value={formConcluir.impacto}
              onChange={(e) => setFormConcluir((f) => ({ ...f, impacto: e.target.value }))}
              placeholder="Qual o impacto gerado?"
            />
            <div className="flex gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => { setModalConcluir(null); setFormConcluir({ resultado: "", impacto: "" }); }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConcluir}
                disabled={salvandoConcluir}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {salvandoConcluir ? "Salvando…" : "Confirmar Conclusão"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Nova Memória */}
      <Modal open={modalAberto} onClose={() => { setModalAberto(false); setForm({ ...FORM_VAZIO }); }} title="Nova Memória do Mandato">
        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tipo *"
              value={form.tipo}
              onChange={(e) => set("tipo", e.target.value)}
              options={Object.entries(TIPO_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            />
            <Select
              label="Prioridade *"
              value={form.prioridade}
              onChange={(e) => set("prioridade", e.target.value)}
              options={Object.entries(PRIORIDADE_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            />
          </div>
          <Input
            label="Título *"
            value={form.titulo}
            onChange={(e) => set("titulo", e.target.value)}
            placeholder="Ex: Decisão sobre ampliação da base em Recife"
          />
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Descrição *</label>
            <textarea
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              rows={3}
              placeholder="Descreva o contexto e detalhes relevantes…"
              className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Cidade"
              value={form.cidade}
              onChange={(e) => set("cidade", e.target.value)}
              placeholder="Ex: Recife"
            />
            <Select
              label="Classificação"
              value={form.classificacao || ""}
              onChange={(e) => set("classificacao", e.target.value)}
              options={Object.entries(CLASS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            />
            <Input
              label="Responsável"
              value={form.responsavelNome}
              onChange={(e) => set("responsavelNome", e.target.value)}
              placeholder="Nome do responsável"
            />
          </div>
          <Input
            label="Motivo"
            value={form.motivo}
            onChange={(e) => set("motivo", e.target.value)}
            placeholder="Causa ou justificativa"
          />
          <Input
            label="Resultado"
            value={form.resultado}
            onChange={(e) => set("resultado", e.target.value)}
            placeholder="Resultado obtido (se já concluído)"
          />
          <Input
            label="Impacto"
            value={form.impacto}
            onChange={(e) => set("impacto", e.target.value)}
            placeholder="Impacto esperado ou realizado"
          />
          <Input
            label="Tags (separadas por vírgula)"
            value={form.tagsTexto}
            onChange={(e) => set("tagsTexto", e.target.value)}
            placeholder="Ex: eleições, recife, expansão"
          />
        </div>

        <div className="flex gap-3 mt-4 pt-4 border-t border-white/10">
          <button
            onClick={() => { setModalAberto(false); setForm({ ...FORM_VAZIO }); }}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-sm transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando || !form.titulo.trim() || !form.descricao.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {salvando ? "Salvando…" : "Registrar Memória"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

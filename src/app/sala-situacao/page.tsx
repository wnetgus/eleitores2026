"use client";

import { useEffect, useState, useMemo } from "react";
import {
  collection, getDocs, query, where,
  orderBy, addDoc, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { isPolitico } from "@/lib/permissions";
import { AppUser, Eleitor, Missao } from "@/types";
import { parseDate } from "@/lib/utils";
import { buscarEleitoresPorGabinetes } from "@/lib/firestore";
import toast from "react-hot-toast";
import { criarNotificacao } from "@/lib/notificacoes";
import Link from "next/link";
import {
  Shield, AlertTriangle, TrendingUp, TrendingDown,
  Minus, Zap, Crown, Target, ChevronRight, RefreshCw,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CidadeStats {
  nome: string;
  total: number;
  fortes: number;
  indecisos: number;
  novos30d: number;
  novos30_60d: number;
  pctForte: number;
  crescimento30d: number;
  tendencia: "subindo" | "estavel" | "caindo";
  assessorNome: string;
  semAssessor: boolean;
  alertas: string[];
  sinal: "critico" | "atencao" | "oportunidade" | "crescimento" | "ok";
  irtLocal: number;
}

// ─── Carga de eleitores (mesmo padrão do dashboard/page.tsx) ─────────────────
// Usa orderBy("criadoEm", "desc") para corresponder ao índice composto existente.
// Também carrega eleitores de gabinetes filhos via buscarEleitoresPorGabinetes.

async function carregarEleitoresPolitico(campanhaId: string): Promise<Eleitor[]> {
  const [diretos, filhosSnap] = await Promise.all([
    getDocs(query(collection(db, "eleitores"), where("campanhaId", "==", campanhaId), orderBy("criadoEm", "desc"))),
    getDocs(query(collection(db, "campanhas"), where("parentGabineteId", "==", campanhaId))),
  ]);
  const diretosData = diretos.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor));
  const filhosIds = filhosSnap.docs.map((d) => d.id);
  const filhosData = filhosIds.length > 0 ? await buscarEleitoresPorGabinetes(filhosIds) : [];
  return [...diretosData, ...filhosData];
}

// ─── Sub-componentes visuais ──────────────────────────────────────────────────

function TendenciaIcon({ t }: { t: CidadeStats["tendencia"] }) {
  if (t === "subindo") return <TrendingUp size={14} className="text-emerald-400 shrink-0" />;
  if (t === "caindo")  return <TrendingDown size={14} className="text-red-400 shrink-0" />;
  return <Minus size={14} className="text-white/25 shrink-0" />;
}

function SinalBadge({ sinal }: { sinal: CidadeStats["sinal"] }) {
  const cfg: Record<CidadeStats["sinal"], { label: string; cls: string }> = {
    critico:      { label: "CRÍTICO",      cls: "bg-red-500/20 text-red-300 border-red-500/30" },
    atencao:      { label: "ATENÇÃO",      cls: "bg-amber-500/15 text-amber-300 border-amber-500/25" },
    oportunidade: { label: "OPORTUNIDADE", cls: "bg-blue-500/15 text-blue-300 border-blue-500/25" },
    crescimento:  { label: "CRESCENDO",    cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" },
    ok:           { label: "OK",           cls: "bg-white/5 text-white/30 border-white/10" },
  };
  const { label, cls } = cfg[sinal];
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider border ${cls}`}>
      {label}
    </span>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SalaDeSituacao() {
  const { userData } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [ultimaAtt, setUltimaAtt] = useState<Date | null>(null);
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [assessores, setAssessores] = useState<AppUser[]>([]);
  const [coordenadores, setCoordenadores] = useState<AppUser[]>([]);
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [ae, setAe] = useState<AppUser | null>(null);

  // Modal de determinação
  const [modalDet, setModalDet] = useState<{
    cidade: string;
    assunto: string;
    prioridade: "Alta" | "Media" | "Baixa";
  } | null>(null);
  const [detForm, setDetForm] = useState({ descricao: "", prazo: 7 });
  const [detEnviando, setDetEnviando] = useState(false);

  const campanhaId = userData?.campanhaId || userData?.gabineteId || "";
  const agora = Date.now();

  // ─── Carga de dados ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userData) return;
    if (!isPolitico(userData)) { router.push("/dashboard"); return; }
    if (!campanhaId) { setLoading(false); return; }

    async function load() {
      setLoading(true);
      try {
        const [eletRes, assessRes, coordRes, missRes, aeRes] = await Promise.allSettled([
          carregarEleitoresPolitico(campanhaId),
          getDocs(query(collection(db, "usuarios"), where("role", "==", "assessor"), where("campanhaId", "==", campanhaId))),
          getDocs(query(collection(db, "usuarios"), where("role", "==", "coordenador"), where("campanhaId", "==", campanhaId))),
          getDocs(query(collection(db, "missoes"), where("campanhaId", "==", campanhaId))),
          getDocs(query(collection(db, "usuarios"), where("role", "==", "assessor_executivo"), where("campanhaId", "==", campanhaId))),
        ]);

        if (eletRes.status === "fulfilled") setEleitores(eletRes.value);
        if (assessRes.status === "fulfilled") setAssessores(assessRes.value.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
        if (coordRes.status === "fulfilled") setCoordenadores(coordRes.value.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
        if (missRes.status === "fulfilled") setMissoes(missRes.value.docs.map((d) => ({ id: d.id, ...d.data() } as Missao)));
        if (aeRes.status === "fulfilled" && aeRes.value.size > 0) {
          const d = aeRes.value.docs[0];
          setAe({ uid: d.id, ...d.data() } as AppUser);
        }

        setUltimaAtt(new Date());
      } catch (e) {
        console.error("SalaDeSituacao:", e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [campanhaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Missões atrasadas ────────────────────────────────────────────────────────

  const missoesAtrasadas = useMemo(() =>
    missoes.filter((m) => {
      if (m.status === "concluida" || m.status === "cancelada") return false;
      if (m.prazo) return new Date(m.prazo + "T23:59:59") < new Date();
      const t = (m.criadoEm as any)?.toMillis?.() ?? 0;
      return t > 0 && agora - t > 7 * 86400000;
    }),
    [missoes, agora]
  );

  // ─── Mapa assessor por cidade ──────────────────────────────────────────────

  const assessorPorCidade = useMemo(() => {
    const map = new Map<string, AppUser>();
    assessores.forEach((a) => {
      const cidades: string[] = (a as any).cidades ?? (a.cidadePrincipal ? [a.cidadePrincipal] : []);
      cidades.forEach((c) => map.set(c, a));
    });
    return map;
  }, [assessores]);

  // ─── Última atividade por coordenador ─────────────────────────────────────

  const coordUltimaAtiv = useMemo(() => {
    const map = new Map<string, number>();
    eleitores.forEach((e) => {
      if (!e.coordenadorId) return;
      const t = parseDate(e.criadoEm).getTime();
      if (!map.has(e.coordenadorId) || t > map.get(e.coordenadorId)!) map.set(e.coordenadorId, t);
    });
    return map;
  }, [eleitores]);

  // ─── Stats por cidade ─────────────────────────────────────────────────────

  const cidadesStats = useMemo((): CidadeStats[] => {
    const MS30 = 30 * 86400000;
    const MS60 = 60 * 86400000;

    const map = new Map<string, Eleitor[]>();
    eleitores.forEach((e) => {
      if (!e.cidade) return;
      if (!map.has(e.cidade)) map.set(e.cidade, []);
      map.get(e.cidade)!.push(e);
    });

    return Array.from(map.entries()).map(([nome, eleit]) => {
      const total        = eleit.length;
      const fortes       = eleit.filter((e) => e.grauApoio === "forte").length;
      const indecisos    = eleit.filter((e) => e.grauApoio === "indeciso").length;
      const novos30d     = eleit.filter((e) => parseDate(e.criadoEm).getTime() > agora - MS30).length;
      const novos30_60d  = eleit.filter((e) => { const t = parseDate(e.criadoEm).getTime(); return t > agora - MS60 && t <= agora - MS30; }).length;
      const pctForte     = total > 0 ? Math.round((fortes / total) * 100) : 0;
      const crescimento30d = novos30_60d > 0 ? Math.round(((novos30d - novos30_60d) / novos30_60d) * 100) : novos30d > 0 ? 100 : 0;
      const tendencia: CidadeStats["tendencia"] = crescimento30d > 10 ? "subindo" : crescimento30d < -10 ? "caindo" : "estavel";

      const assessor   = assessorPorCidade.get(nome);
      const semAssessor = !assessor;
      const missoesAtrCidade = missoesAtrasadas.filter((m) => m.cidade === nome).length;

      const alertas: string[] = [];
      if (tendencia === "caindo")    alertas.push(`Base em queda ${Math.abs(crescimento30d)}%`);
      if (pctForte < 15)             alertas.push(`Base forte baixa (${pctForte}%)`);
      if (indecisos > 15)            alertas.push(`${indecisos} indecisos — potencial conversão`);
      if (semAssessor)               alertas.push("Sem assessor designado");
      if (missoesAtrCidade > 0)      alertas.push(`${missoesAtrCidade} ${missoesAtrCidade > 1 ? "missões atrasadas" : "missão atrasada"}`);

      let sinal: CidadeStats["sinal"] = "ok";
      if (semAssessor || (tendencia === "caindo" && pctForte < 15)) sinal = "critico";
      else if (tendencia === "caindo" || pctForte < 20 || missoesAtrCidade > 0) sinal = "atencao";
      else if (indecisos > 15 && pctForte < 35) sinal = "oportunidade";
      else if (tendencia === "subindo" && pctForte >= 20) sinal = "crescimento";

      const irtLocal = Math.min(100,
        (tendencia === "caindo" ? 30 : 0) +
        (semAssessor ? 20 : 0) +
        (missoesAtrCidade > 0 ? 20 : 0) +
        Math.max(0, 20 - pctForte)
      );

      return { nome, total, fortes, indecisos, novos30d, novos30_60d, pctForte, crescimento30d, tendencia, assessorNome: assessor?.nome ?? "Sem assessor", semAssessor, alertas, sinal, irtLocal };
    });
  }, [eleitores, assessorPorCidade, missoesAtrasadas, agora]);

  // ─── IRT global ───────────────────────────────────────────────────────────

  const irtGlobal = useMemo(() => {
    const n = cidadesStats.length;
    if (n === 0) return 0;
    const pctQueda     = cidadesStats.filter((c) => c.tendencia === "caindo").length / n;
    const pctInativos  = coordenadores.length > 0
      ? coordenadores.filter((c) => { const l = coordUltimaAtiv.get(c.uid); return !l || agora - l > 14 * 86400000; }).length / coordenadores.length
      : 0;
    const pctAtrasadas = missoes.length > 0 ? missoesAtrasadas.length / missoes.length : 0;
    const mediaBase    = cidadesStats.reduce((s, c) => s + c.pctForte, 0) / n / 100;
    const pctSemCob    = cidadesStats.filter((c) => c.semAssessor).length / n;
    return Math.min(100, Math.round((0.30 * pctQueda + 0.20 * pctInativos + 0.20 * pctAtrasadas + 0.15 * (1 - mediaBase) + 0.15 * pctSemCob) * 100));
  }, [cidadesStats, coordenadores, coordUltimaAtiv, missoes, missoesAtrasadas, agora]);

  const irtLabel = irtGlobal < 30 ? "Baixo Risco" : irtGlobal < 60 ? "Atenção" : "Crítico";
  const irtColor = irtGlobal < 30 ? "text-emerald-400" : irtGlobal < 60 ? "text-amber-400" : "text-red-400";
  const irtBorder = irtGlobal < 30 ? "border-emerald-500/20" : irtGlobal < 60 ? "border-amber-500/20" : "border-red-500/20";
  const irtBar   = irtGlobal < 30 ? "bg-emerald-500" : irtGlobal < 60 ? "bg-amber-500" : "bg-red-500";

  // ─── Listas filtradas ─────────────────────────────────────────────────────

  const cidadesRisco = useMemo(() =>
    cidadesStats.filter((c) => c.sinal === "critico" || c.sinal === "atencao").sort((a, b) => b.irtLocal - a.irtLocal),
    [cidadesStats]
  );
  const cidadesOport = useMemo(() =>
    cidadesStats.filter((c) => c.sinal === "oportunidade" || c.sinal === "crescimento").sort((a, b) => b.indecisos - a.indecisos),
    [cidadesStats]
  );
  const coordInativos = useMemo(() =>
    coordenadores.filter((c) => { const l = coordUltimaAtiv.get(c.uid); return !l || agora - l > 14 * 86400000; }),
    [coordenadores, coordUltimaAtiv, agora]
  );

  const totalAlertas = cidadesRisco.filter((c) => c.sinal === "critico").length + coordInativos.length + missoesAtrasadas.length;

  // ─── Geração automática de alertas (dedup por chave diária) ──────────────
  useEffect(() => {
    if (!userData?.uid || !campanhaId || loading) return;
    const hoje = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    cidadesRisco.filter((c) => c.sinal === "critico").forEach((c) => {
      criarNotificacao({
        campanhaId,
        usuarioId:  userData.uid!,
        tipo:       "alerta",
        titulo:     "Alerta Territorial",
        descricao:  `IRT elevado em ${c.nome} · ${c.alertas[0] || "Território em risco crítico"}`,
        link:       "/sala-situacao",
        prioridade: "critica",
        chave:      `alerta-${c.nome.replace(/\s/g, "")}-${hoje}`,
      }).catch((e) => console.error("notif alerta:", e));
    });

    missoesAtrasadas.forEach((m) => {
      if (!m.responsavelId && !m.criadoPorId) return;
      const diasAtraso = m.prazo
        ? Math.ceil((Date.now() - new Date(m.prazo + "T23:59:59").getTime()) / 86400000)
        : 0;
      criarNotificacao({
        campanhaId,
        usuarioId:  (m.responsavelId || m.criadoPorId || "") as string,
        tipo:       "missao",
        titulo:     "Missão atrasada",
        descricao:  `${m.titulo}${diasAtraso > 0 ? ` · ${diasAtraso} dia${diasAtraso !== 1 ? "s" : ""} de atraso` : ""}`,
        link:       "/missoes",
        prioridade: diasAtraso > 7 ? "critica" : "alta",
        chave:      `missao-atrasada-${m.id}-${hoje}`,
        origem:     m.id,
        origemTipo: "missao",
      }).catch((e) => console.error("notif missão atrasada:", e));
    });
  }, [cidadesRisco, missoesAtrasadas, userData?.uid, campanhaId, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Handler enviar determinação ──────────────────────────────────────────

  async function handleEnviarDeterminacao() {
    if (!userData || !modalDet) return;
    if (!ae) {
      toast.error("Nenhum Assessor Executivo encontrado neste gabinete. Verifique o cadastro do AE.");
      return;
    }
    setDetEnviando(true);
    try {
      const detRef = await addDoc(collection(db, "determinacoes"), {
        campanhaId,
        criadoPorId:      userData.uid,
        criadoPorNome:    userData.nome,
        destinatarioId:   ae.uid,
        destinatarioNome: ae.nome,
        destinatarioRole: "assessor_executivo",
        municipios:       [modalDet.cidade],
        assunto:          modalDet.assunto,
        prioridade:       modalDet.prioridade,
        prazo:            Timestamp.fromDate(new Date(agora + detForm.prazo * 86400000)),
        descricao:        detForm.descricao,
        status:           "pendente",
        criadoEm:         Timestamp.now(),
        atualizadoEm:     Timestamp.now(),
        origem:           "sala_situacao",
      });
      toast.success("Determinação enviada ao Assessor Executivo");
      setModalDet(null);
      setDetForm({ descricao: "", prazo: 7 });
      // Notificação para o AE — best-effort (determinação já foi salva)
      criarNotificacao({
        campanhaId,
        usuarioId:     ae.uid,
        tipo:          "determinacao",
        titulo:        `Nova determinação: ${modalDet.assunto}`,
        descricao:     `${userData.nome} enviou uma determinação com prioridade ${modalDet.prioridade}`,
        link:          "/dashboard",
        prioridade:    modalDet.prioridade === "Alta" ? "alta" : modalDet.prioridade === "Media" ? "media" : "baixa",
        remetenteNome: userData.nome,
        origemTipo:    "determinacao",
        origem:        detRef.id,
        chave:         `det-${detRef.id}-ae`,
      }).catch((e) => console.error("Notif determinação:", e));
    } catch (e) {
      console.error(e);
      toast.error("Erro ao enviar determinação");
    } finally {
      setDetEnviando(false);
    }
  }

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (!userData || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-violet-500/40 border-t-violet-500 rounded-full animate-spin mx-auto" />
          <p className="text-white/30 text-sm">Carregando Sala de Situação...</p>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const btnDeterminar = (cidade: string, assunto: string, prioridade: "Alta" | "Media" | "Baixa", variant: "violet" | "emerald" = "violet") => (
    <button
      data-testid="btn-determinar-territorio"
      onClick={() => setModalDet({ cidade, assunto, prioridade })}
      className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors border ${
        variant === "violet"
          ? "bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 border-violet-500/20"
          : "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border-emerald-500/20"
      }`}
    >
      Determinar
    </button>
  );

  return (
    <div data-testid="pagina-sala-situacao" className="space-y-6 pb-10">

      {/* CABEÇALHO */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} className="text-violet-400" />
            <h1 className="text-xl font-bold text-white">Sala de Situação</h1>
          </div>
          <p className="text-sm text-white/35">Visão estratégica do território — onde agir agora</p>
        </div>
        {ultimaAtt && (
          <span className="text-[10px] text-white/20 flex items-center gap-1 mt-1">
            <RefreshCw size={10} />
            {ultimaAtt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* A. PULSO EXECUTIVO — 5 KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Alertas Críticos",      valor: totalAlertas,              cor: totalAlertas > 0 ? "text-red-400" : "text-white/40" },
          { label: "Municípios em Risco",   valor: cidadesRisco.length,       cor: cidadesRisco.length > 0 ? "text-amber-400" : "text-white/40" },
          { label: "Municípios Crescendo",  valor: cidadesOport.length,       cor: cidadesOport.length > 0 ? "text-emerald-400" : "text-white/40" },
          { label: "Missões Atrasadas",     valor: missoesAtrasadas.length,   cor: missoesAtrasadas.length > 0 ? "text-red-400" : "text-white/40" },
          { label: "Coord. Inativos",       valor: coordInativos.length,      cor: coordInativos.length > 0 ? "text-amber-400" : "text-white/40" },
        ].map(({ label, valor, cor }) => (
          <GlassCard key={label} className="p-3 text-center">
            <p className={`text-2xl font-bold ${cor}`}>{valor}</p>
            <p className="text-[10px] text-white/30 mt-0.5 leading-tight">{label}</p>
          </GlassCard>
        ))}
      </div>

      {/* IRT */}
      <GlassCard className={`p-4 border ${irtBorder}`}>
        <div data-testid="kpi-irt" className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Índice de Risco Territorial</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${irtColor}`}>{irtGlobal}</span>
              <span className="text-white/25 text-sm">/100</span>
              <span className={`text-sm font-semibold ${irtColor}`}>{irtLabel}</span>
            </div>
          </div>
          <div className="text-right space-y-px shrink-0">
            {[
              ["Queda territorial", "30%"],
              ["Coord. inativos",   "20%"],
              ["Missões vencidas",  "20%"],
              ["Base fraca",        "15%"],
              ["Sem cobertura",     "15%"],
            ].map(([k, v]) => (
              <p key={k} className="text-[9px] text-white/20">
                {k} <span className="text-white/35">{v}</span>
              </p>
            ))}
          </div>
        </div>
        <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${irtBar}`} style={{ width: `${irtGlobal}%` }} />
        </div>
      </GlassCard>

      {/* B. TERRITÓRIOS EM RISCO — sempre visível */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={15} className="text-amber-400" />
          <h2 className="text-white font-semibold">Territórios em Risco</h2>
          {cidadesRisco.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20">{cidadesRisco.length}</span>
          )}
        </div>
        {cidadesRisco.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-white/25 text-sm">Nenhum território em situação de risco</p>
            <p className="text-white/15 text-xs mt-1">Todos os municípios estão dentro dos parâmetros normais</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cidadesRisco.map((c) => (
              <div data-testid="card-territorio-risco" key={c.nome} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5 hover:border-white/10 transition-colors">
                <TendenciaIcon t={c.tendencia} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-white/85 font-medium">{c.nome}</p>
                    <SinalBadge sinal={c.sinal} />
                  </div>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    {c.assessorNome} · {c.total} eleitores · {c.pctForte}% forte
                  </p>
                  {c.alertas[0] && (
                    <p className="text-[11px] text-amber-400/70 mt-0.5">{c.alertas[0]}</p>
                  )}
                </div>
                {btnDeterminar(
                  c.nome,
                  c.tendencia === "caindo" ? "Recuperar Base Territorial" : c.semAssessor ? "Criar Cobertura Territorial" : "Fortalecer Presença Local",
                  c.sinal === "critico" ? "Alta" : "Media"
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* C. OPORTUNIDADES — sempre visível */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={15} className="text-emerald-400" />
          <h2 className="text-white font-semibold">Oportunidades de Expansão</h2>
          {cidadesOport.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">{cidadesOport.length}</span>
          )}
        </div>
        {cidadesOport.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-white/25 text-sm">Nenhuma oportunidade de expansão identificada</p>
            <p className="text-white/15 text-xs mt-1">Monitore indecisos e crescimento para detectar potencial</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cidadesOport.map((c) => (
              <div key={c.nome} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5 hover:border-white/10 transition-colors">
                <TrendingUp size={14} className="text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-white/85 font-medium">{c.nome}</p>
                    <SinalBadge sinal={c.sinal} />
                  </div>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    {c.assessorNome} · {c.novos30d} novos/30d
                    {c.crescimento30d > 0 ? ` · +${c.crescimento30d}%` : ""}
                    {c.indecisos > 0 ? ` · ${c.indecisos} indecisos` : ""}
                  </p>
                </div>
                {btnDeterminar(
                  c.nome,
                  c.indecisos > 0 ? "Converter Indecisos" : "Expandir Território",
                  "Media",
                  "emerald"
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* D. ALERTAS OPERACIONAIS */}
      {(coordInativos.length > 0 || missoesAtrasadas.length > 0) && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={15} className="text-red-400" />
            <h2 className="text-white font-semibold">Alertas Operacionais</h2>
          </div>
          <div className="space-y-2">
            {coordInativos.map((c) => {
              const last = coordUltimaAtiv.get(c.uid);
              const dias = last ? Math.floor((agora - last) / 86400000) : null;
              return (
                <div key={c.uid} className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/70">{c.nome} <span className="text-white/30 text-[11px]">Coordenador</span></p>
                    <p className="text-[11px] text-amber-400/70">
                      {dias !== null ? `${dias} dias sem novo cadastro` : "Sem registro de cadastro"}
                    </p>
                  </div>
                </div>
              );
            })}
            {missoesAtrasadas.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-white/70 truncate">{(m as any).titulo || m.tipo}</p>
                    <p className="text-[11px] text-red-400/70">{m.cidade} · missão atrasada</p>
                  </div>
                </div>
                <Link
                  href="/missoes"
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-300 text-[11px] hover:bg-red-500/20 transition-colors border border-red-500/20"
                >
                  Ver
                </Link>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* E. ATALHO CENTRAL DE DETERMINAÇÕES */}
      <Link href="/dashboard" className="block group">
        <GlassCard className="p-4 border border-violet-500/15 hover:border-violet-500/40 transition-all hover:bg-violet-500/5 cursor-pointer">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0 group-hover:bg-violet-500/25 transition-colors">
                <Crown size={16} className="text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors">
                  Central de Determinações →
                </p>
                <p className="text-[11px] text-white/30">Ver e acompanhar todas as ordens emitidas</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-white/20 group-hover:text-violet-400 transition-colors" />
          </div>
        </GlassCard>
      </Link>

      {/* MODAL DE DETERMINAÇÃO */}
      {modalDet && (
        <div data-testid="modal-determinacao-sala" className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setModalDet(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                <Target size={18} className="text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-white/30 uppercase tracking-wider">Determinar Providência</p>
                <p className="text-base font-bold text-white">{modalDet.cidade}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Assunto</p>
                <div className="px-3 py-2.5 bg-violet-500/5 border border-violet-500/20 rounded-xl text-sm text-white/80">
                  {modalDet.assunto}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Prioridade</p>
                  <div className={`px-3 py-2 rounded-xl text-sm font-semibold text-center border ${
                    modalDet.prioridade === "Alta"  ? "bg-red-500/10 text-red-300 border-red-500/20" :
                    modalDet.prioridade === "Media" ? "bg-amber-500/10 text-amber-300 border-amber-500/20" :
                                                      "bg-white/5 text-white/40 border-white/10"
                  }`}>
                    {modalDet.prioridade}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1.5">Prazo (dias)</label>
                  <input
                    type="number" min={1} max={30}
                    value={detForm.prazo}
                    onChange={(e) => setDetForm((f) => ({ ...f, prazo: Number(e.target.value) }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              </div>
              {ae ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-white/3 rounded-xl border border-white/5">
                  <Crown size={12} className="text-violet-400/70" />
                  <p className="text-[11px] text-white/45">Para: <span className="text-white/65">{ae.nome}</span> <span className="text-white/25">— Assessor Executivo</span></p>
                </div>
              ) : (
                <p className="text-[11px] text-red-400/70 px-1">Assessor Executivo não encontrado na campanha.</p>
              )}
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1.5">Observação (opcional)</label>
                <textarea
                  rows={2}
                  value={detForm.descricao}
                  onChange={(e) => setDetForm((f) => ({ ...f, descricao: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 placeholder-white/20 resize-none"
                  placeholder="Contexto adicional para o Assessor Executivo..."
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                data-testid="btn-enviar-determinacao-sala"
                onClick={handleEnviarDeterminacao}
                disabled={detEnviando || !ae}
                className="flex-1 py-3 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {detEnviando ? "Enviando..." : !ae ? "AE não encontrado" : "Enviar Determinação"}
              </button>
              <button
                onClick={() => { setModalDet(null); setDetForm({ descricao: "", prazo: 7 }); }}
                className="px-5 py-3 rounded-xl bg-white/5 text-white/40 text-sm hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

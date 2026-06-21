"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where, getDoc, doc, limit, orderBy, startAfter, type DocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppUser, Missao } from "@/types";
import { Eleitor } from "@/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { parseDate } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Crown, Zap, Bell,
  BarChart3, ChevronRight, MapPin, Clock, CheckCircle,
  Shield, AlertTriangle,
} from "lucide-react";

interface Props {
  userData: AppUser;
}

interface AssessorStats {
  uid: string;
  nome: string;
  cidadePrincipal: string;
  cidades: string[];
  eleitores: number;
  coordenadores: number;
  colaboradores: number;
  crescimento30d: number;
  novosEleitores7d: number;
  performance: number;
  diagnostico: string;
  ativo: boolean;
}

async function loadAllEleitores(campanhaId: string): Promise<Eleitor[]> {
  const PAGE = 500;
  const todos: Eleitor[] = [];
  let cursor: DocumentSnapshot | undefined;
  while (true) {
    const q = cursor
      ? query(collection(db, "eleitores"), where("campanhaId", "==", campanhaId), orderBy("criadoEm"), startAfter(cursor), limit(PAGE))
      : query(collection(db, "eleitores"), where("campanhaId", "==", campanhaId), orderBy("criadoEm"), limit(PAGE));
    const snap = await getDocs(q);
    todos.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor)));
    if (snap.size < PAGE) break;
    cursor = snap.docs[snap.docs.length - 1];
  }
  return todos;
}

export function DashboardExecutivo({ userData }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [assessores, setAssessores] = useState<AppUser[]>([]);
  const [coordenadores, setCoordenadores] = useState<AppUser[]>([]);
  const [colaboradores, setColaboradores] = useState<AppUser[]>([]);
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState(0);
  const [gabineteNome, setGabineteNome] = useState("");

  const campanhaId = userData.campanhaId || userData.gabineteId || "";

  useEffect(() => {
    if (!campanhaId) { setLoading(false); return; }
    loadAll();
    // Revalida ao voltar para esta aba — dados nunca ficam obsoletos
    const onVisible = () => { if (document.visibilityState === "visible") loadAll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [campanhaId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [assessSnap, coordSnap, colabSnap, eletSnap, missoesSnap, solSnap, gabSnap] =
        await Promise.allSettled([
          getDocs(query(collection(db, "usuarios"), where("role", "==", "assessor"), where("campanhaId", "==", campanhaId))),
          getDocs(query(collection(db, "usuarios"), where("role", "==", "coordenador"), where("campanhaId", "==", campanhaId))),
          getDocs(query(collection(db, "usuarios"), where("role", "==", "colaborador"), where("campanhaId", "==", campanhaId))),
          loadAllEleitores(campanhaId),
          getDocs(query(collection(db, "missoes"), where("campanhaId", "==", campanhaId))),
          getDocs(query(collection(db, "usuarios"), where("role", "==", "colaborador"), where("campanhaId", "==", campanhaId), where("status", "==", "pendente"))),
          getDoc(doc(db, "campanhas", campanhaId)),
        ]);

      if (assessSnap.status === "fulfilled") {
        const lista = assessSnap.value.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser));
        setAssessores(lista);
        // Redirecionar para onboarding se executivo sem assessores (primeira vez)
        if (lista.length === 0 && typeof window !== "undefined" && !localStorage.getItem("onboarding_completo")) {
          router.push("/onboarding");
          setLoading(false);
          return;
        }
      }
      if (coordSnap.status === "fulfilled")
        setCoordenadores(coordSnap.value.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
      if (colabSnap.status === "fulfilled")
        setColaboradores(colabSnap.value.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
      if (eletSnap.status === "fulfilled")
        setEleitores(eletSnap.value);
      if (missoesSnap.status === "fulfilled")
        setMissoes(missoesSnap.value.docs.map((d) => ({ id: d.id, ...d.data() } as Missao)));
      if (solSnap.status === "fulfilled")
        setSolicitacoesPendentes(solSnap.value.size);
      if (gabSnap.status === "fulfilled" && gabSnap.value.exists())
        setGabineteNome(gabSnap.value.data()?.nome || "");
    } catch (e) {
      console.error("DashboardExecutivo.loadAll:", e);
    } finally {
      setLoading(false);
    }
  }

  // ── KPIs de Missões ──────────────────────────────────────────────────────────

  const missaoStats = useMemo(() => {
    const agora = Date.now();
    const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;
    const pendentes   = missoes.filter((m) => m.status === "pendente").length;
    const emExecucao  = missoes.filter((m) => m.status === "em_execucao" || m.status === "aceita").length;
    const concluidas  = missoes.filter((m) => m.status === "concluida").length;
    const atrasadas   = missoes.filter((m) => {
      if (m.status === "concluida" || m.status === "cancelada") return false;
      if (m.prazo) return new Date(m.prazo + "T23:59:59") < new Date();
      const t = (m.criadoEm as any)?.toMillis?.() ?? 0;
      return t > 0 && agora - t > SETE_DIAS;
    }).length;
    return { pendentes, emExecucao, concluidas, atrasadas };
  }, [missoes]);

  // ── Municípios sem assessor ───────────────────────────────────────────────────

  const cidadesSemAssessor = useMemo(() => {
    const comEleitores = new Set(eleitores.map((e) => e.cidade).filter(Boolean) as string[]);
    const cobertas = new Set(
      assessores.flatMap((a) =>
        a.cidades ?? (a.cidadePrincipal ? [a.cidadePrincipal] : [])
      )
    );
    return Array.from(comEleitores).filter((c) => !cobertas.has(c));
  }, [eleitores, assessores]);

  // ── Ranking de Assessores ─────────────────────────────────────────────────────

  const assessorStats = useMemo((): AssessorStats[] => {
    const agora = Date.now();
    return assessores.map((a) => {
      const meusCoords = coordenadores.filter((c) => c.assessorId === a.uid);
      const coordIds   = new Set(meusCoords.map((c) => c.uid));
      const meusColabs = colaboradores.filter((c) => c.coordenadorId && coordIds.has(c.coordenadorId));
      const colabIds   = new Set(meusColabs.map((c) => c.uid));
      const meusEleit  = eleitores.filter(
        (e) =>
          (e.colaboradorId && colabIds.has(e.colaboradorId)) ||
          (e.coordenadorId && coordIds.has(e.coordenadorId))
      );

      const recentes30 = meusEleit.filter(
        (e) => parseDate(e.criadoEm).getTime() > agora - 30 * 86400000
      ).length;
      const novosEleitores7d = meusEleit.filter(
        (e) => parseDate(e.criadoEm).getTime() > agora - 7 * 86400000
      ).length;
      const prev30 = meusEleit.filter((e) => {
        const t = parseDate(e.criadoEm).getTime();
        return t > agora - 60 * 86400000 && t <= agora - 30 * 86400000;
      }).length;
      const crescimento30d =
        prev30 > 0 ? Math.round(((recentes30 - prev30) / prev30) * 100)
        : recentes30 > 0 ? 100 : 0;

      // Score 0-100
      let perf = 0;
      if (meusEleit.length > 0)  perf += 40;
      if (meusCoords.length > 0) perf += 20;
      if (recentes30 > 0)        perf += 25;
      if (crescimento30d > 0)    perf += 15;

      const diagnostico =
        meusEleit.length === 0 && meusCoords.length === 0 ? "Sem estrutura" :
        recentes30 === 0 && meusEleit.length > 0           ? "Inativo (30d)" :
        crescimento30d < -20                               ? "Queda significativa" :
        meusCoords.length === 0                            ? "Sem coordenadores" :
        "Operacional";

      const cidades = a.cidades ?? (a.cidadePrincipal ? [a.cidadePrincipal] : []);
      return {
        uid: a.uid,
        nome: a.nome,
        cidadePrincipal: a.cidadePrincipal || cidades[0] || "—",
        cidades,
        eleitores: meusEleit.length,
        coordenadores: meusCoords.length,
        colaboradores: meusColabs.length,
        crescimento30d,
        novosEleitores7d,
        performance: Math.min(perf, 100),
        diagnostico,
        ativo: a.ativo !== false,
      };
    }).sort((a, b) => b.performance - a.performance);
  }, [assessores, coordenadores, colaboradores, eleitores]);

  // ── Alertas ───────────────────────────────────────────────────────────────────

  const alertas = useMemo(() => {
    const list: { nivel: "critico" | "atencao" | "ok"; msg: string; link?: string }[] = [];

    if (cidadesSemAssessor.length > 0)
      list.push({
        nivel: "critico",
        msg: `${cidadesSemAssessor.slice(0, 3).join(", ")}${cidadesSemAssessor.length > 3 ? ` +${cidadesSemAssessor.length - 3}` : ""} — sem assessoria regional`,
        link: "/assessores",
      });

    if (missaoStats.atrasadas > 0)
      list.push({
        nivel: "critico",
        msg: `${missaoStats.atrasadas} missão(ões) com mais de 7 dias sem conclusão`,
        link: "/missoes",
      });

    const coordsSemColab = coordenadores.filter(
      (c) => !colaboradores.some((col) => col.coordenadorId === c.uid)
    );
    if (coordsSemColab.length > 0)
      list.push({
        nivel: "atencao",
        msg: `${coordsSemColab.length} coordenador(es) sem mobilizadores`,
        link: "/coordenadores",
      });

    if (solicitacoesPendentes > 0)
      list.push({
        nivel: "atencao",
        msg: `${solicitacoesPendentes} mobilizador(es) aguardando aprovação`,
        link: "/solicitacoes",
      });

    const inativos = assessores.filter((a) => a.ativo === false);
    if (inativos.length > 0)
      list.push({
        nivel: "atencao",
        msg: `${inativos.length} assessor(es) regional(is) desativado(s)`,
        link: "/assessores",
      });

    // Assessores comportamentalmente inativos (ativos mas sem cadastros há 30d)
    const inativosPorComportamento = assessorStats.filter(
      (s) => s.ativo && s.diagnostico === "Inativo (30d)" && s.eleitores > 0
    );
    if (inativosPorComportamento.length > 0)
      list.push({
        nivel: "atencao",
        msg: `${inativosPorComportamento.length} assessor(es) sem cadastros nos últimos 30 dias`,
        link: "/assessores",
      });

    // Queda eleitoral global
    const agora = Date.now();
    const recentes30 = eleitores.filter((e) => parseDate(e.criadoEm).getTime() > agora - 30 * 86400000).length;
    const prev30     = eleitores.filter((e) => { const t = parseDate(e.criadoEm).getTime(); return t > agora - 60 * 86400000 && t <= agora - 30 * 86400000; }).length;
    if (prev30 > 0 && recentes30 < prev30 * 0.9)
      list.push({
        nivel: "critico",
        msg: `Queda de ${Math.round(((prev30 - recentes30) / prev30) * 100)}% nos cadastros nos últimos 30 dias`,
        link: "/relatorios",
      });

    if (list.length === 0 && assessores.length > 0)
      list.push({ nivel: "ok", msg: "Todos os territórios com cobertura ativa" });

    // Ordenar: crítico primeiro, depois atenção, depois ok
    list.sort((a, b) => {
      const ordem = { critico: 0, atencao: 1, ok: 2 };
      return ordem[a.nivel] - ordem[b.nivel];
    });

    return list;
  }, [cidadesSemAssessor, missaoStats, coordenadores, colaboradores, solicitacoesPendentes, assessores, assessorStats, eleitores]);

  // ── Loading Skeleton ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-10 w-72 bg-white/5 rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0,1,2,3].map((i) => <div key={i} className="h-24 bg-white/5 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0,1,2,3].map((i) => <div key={i} className="h-20 bg-white/5 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <div className="h-64 bg-white/5 rounded-2xl" />
          <div className="h-64 bg-white/5 rounded-2xl xl:col-span-2" />
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const assessoresAtivos  = assessores.filter((a) => a.ativo !== false).length;
  const coordenadoresAtiv = coordenadores.filter((c) => c.ativo !== false).length;
  const colaboradoresAtiv = colaboradores.filter((c) => c.ativo !== false && c.status !== "pendente").length;

  return (
    <div className="space-y-6 animate-in">

          {/* ── Cabeçalho ── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Crown size={16} className="text-violet-400" />
                <span className="text-[11px] font-semibold text-violet-400 uppercase tracking-wider">
                  Assessor Executivo
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white">{userData.nome}</h1>
              {gabineteNome && (
                <p className="text-sm text-white/40 mt-0.5">{gabineteNome}</p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link
                href="/missoes"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold hover:bg-violet-500/20 transition-all"
              >
                <Zap size={13} /> Ver Missões
              </Link>
              <Link
                href="/mapa-politico"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs font-medium hover:bg-white/8 transition-all"
              >
                <MapPin size={13} /> Mapa Territorial
              </Link>
            </div>
          </div>

          {/* ── Fila de Decisão ── */}
          {(() => {
            const decisoes = [
              solicitacoesPendentes > 0 && {
                urgente: true,
                icone: "📋",
                label: `${solicitacoesPendentes} aprovação${solicitacoesPendentes > 1 ? "ões" : ""} pendente${solicitacoesPendentes > 1 ? "s" : ""}`,
                sub: "Mobilizadores aguardando ativação",
                href: "/solicitacoes",
              },
              missaoStats.atrasadas > 0 && {
                urgente: true,
                icone: "⚡",
                label: `${missaoStats.atrasadas} missão${missaoStats.atrasadas > 1 ? "ões" : ""} atrasada${missaoStats.atrasadas > 1 ? "s" : ""}`,
                sub: "Mais de 7 dias sem conclusão",
                href: "/missoes",
              },
              cidadesSemAssessor.length > 0 && {
                urgente: false,
                icone: "📍",
                label: `${cidadesSemAssessor.length} município${cidadesSemAssessor.length > 1 ? "s" : ""} sem assessoria`,
                sub: cidadesSemAssessor.slice(0, 2).join(", ") + (cidadesSemAssessor.length > 2 ? ` +${cidadesSemAssessor.length - 2}` : ""),
                href: "/assessores",
              },
              missaoStats.pendentes > 0 && {
                urgente: false,
                icone: "🎯",
                label: `${missaoStats.pendentes} missão${missaoStats.pendentes > 1 ? "ões" : ""} aguardando início`,
                sub: "Pendentes de aceite pelos assessores",
                href: "/missoes",
              },
            ].filter(Boolean) as { urgente: boolean; icone: string; label: string; sub: string; href: string }[];

            if (decisoes.length === 0) return null;
            return (
              <section>
                <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest mb-3">
                  O QUE FAZER AGORA — {decisoes.length} item{decisoes.length > 1 ? "s" : ""}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {decisoes.map((d, i) => (
                    <Link
                      key={i}
                      href={d.href}
                      className={`flex items-start gap-3 p-4 rounded-2xl border transition-all hover:brightness-110 ${
                        d.urgente
                          ? "bg-red-500/8 border-red-500/25 hover:bg-red-500/12"
                          : "bg-amber-500/6 border-amber-500/20 hover:bg-amber-500/10"
                      }`}
                    >
                      <span className="text-xl shrink-0">{d.icone}</span>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold leading-snug ${d.urgente ? "text-red-300" : "text-amber-300"}`}>
                          {d.label}
                        </p>
                        <p className="text-[10px] text-white/30 mt-0.5 truncate">{d.sub}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })()}

          {/* ── Equipe do Gabinete ── */}
          <section>
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest mb-3">
              EQUIPE DO GABINETE
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatBox
                label="Assessores"
                value={assessoresAtivos}
                total={assessores.length}
                icon="🏛️"
                cor="violet"
                href="/assessores"
              />
              <StatBox
                label="Coordenadores"
                value={coordenadoresAtiv}
                total={coordenadores.length}
                icon="🎯"
                cor="blue"
                href="/coordenadores"
              />
              <StatBox
                label="Mobilizadores"
                value={colaboradoresAtiv}
                total={colaboradores.length}
                icon="⚡"
                cor="emerald"
                href="/colaboradores"
              />
              <StatBox
                label="Eleitores"
                value={eleitores.length}
                icon="🗳️"
                cor="amber"
                href="/eleitores"
              />
            </div>
          </section>

          {/* ── Missões ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">
                MISSÕES
              </p>
              <Link
                href="/missoes"
                className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
              >
                Ver todas <ChevronRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MissaoStat label="Pendentes"    value={missaoStats.pendentes}  cor="white"   urgente={missaoStats.pendentes > 0} />
              <MissaoStat label="Em Execução"  value={missaoStats.emExecucao} cor="amber"   />
              <MissaoStat label="Atrasadas"    value={missaoStats.atrasadas}  cor="red"     urgente={missaoStats.atrasadas > 0} />
              <MissaoStat label="Concluídas"   value={missaoStats.concluidas} cor="emerald" />
            </div>
          </section>

          {/* ── Alertas + Ranking ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">

            {/* Alertas */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Bell size={15} className="text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Alertas do Gabinete</h3>
                {alertas.filter((a) => a.nivel === "critico").length > 0 && (
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/20">
                    {alertas.filter((a) => a.nivel === "critico").length} CRÍTICO(S)
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {alertas.map((alerta, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-xl border ${
                      alerta.nivel === "critico"
                        ? "bg-red-500/8 border-red-500/20"
                        : alerta.nivel === "atencao"
                        ? "bg-amber-500/8 border-amber-500/20"
                        : "bg-emerald-500/8 border-emerald-500/20"
                    }`}
                  >
                    <span className="text-sm mt-0.5 shrink-0">
                      {alerta.nivel === "critico" ? "🔴" : alerta.nivel === "atencao" ? "🟡" : "🟢"}
                    </span>
                    <p
                      className={`text-xs flex-1 leading-relaxed ${
                        alerta.nivel === "critico"
                          ? "text-red-300"
                          : alerta.nivel === "atencao"
                          ? "text-amber-300"
                          : "text-emerald-300"
                      }`}
                    >
                      {alerta.msg}
                    </p>
                    {alerta.link && (
                      <Link
                        href={alerta.link}
                        className="shrink-0 text-[10px] font-semibold text-white/60 hover:text-white transition-colors underline underline-offset-2"
                      >
                        Ver →
                      </Link>
                    )}
                  </div>
                ))}
                {alertas.length === 0 && (
                  <p className="text-xs text-white/25 text-center py-6">Nenhum alerta ativo</p>
                )}
              </div>
            </GlassCard>

            {/* Ranking de Assessores */}
            <GlassCard className="xl:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={15} className="text-violet-400" />
                <h3 className="text-sm font-semibold text-white">Desempenho dos Assessores</h3>
                <Link
                  href="/assessores"
                  className="ml-auto text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Gerenciar →
                </Link>
              </div>
              {assessorStats.length === 0 ? (
                <div className="text-center py-6">
                  <Shield size={32} className="mx-auto text-white/10 mb-2" />
                  <p className="text-xs text-white/25">Nenhum assessor regional cadastrado</p>
                  <Link
                    href="/assessores"
                    className="inline-flex items-center gap-1 mt-3 text-xs text-violet-400 hover:text-violet-300"
                  >
                    <Zap size={12} /> Criar assessor regional →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3 pr-1">
                  {assessorStats.map((a, i) => (
                    <div key={a.uid} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-white/15 w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{a.nome}</p>
                            {!a.ativo && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 shrink-0">
                                inativo
                              </span>
                            )}
                            {a.diagnostico === "Inativo (30d)" && a.ativo && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 shrink-0">
                                parado
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-2 shrink-0">
                            {a.crescimento30d !== 0 && (
                              <span className={`text-[10px] font-semibold ${a.crescimento30d > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {a.crescimento30d > 0 ? "+" : ""}{a.crescimento30d}%
                              </span>
                            )}
                            <span className="text-xs font-bold text-white/50">{a.performance}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1.5 mb-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-500 ${
                              a.performance >= 75 ? "bg-emerald-500" :
                              a.performance >= 40 ? "bg-amber-500" :
                              "bg-red-500"
                            }`}
                            style={{ width: `${a.performance}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-[10px] text-white/25">{a.eleitores} eleit.</span>
                          <span className={`text-[10px] font-semibold ${a.novosEleitores7d > 0 ? "text-emerald-400/80" : "text-white/20"}`}>
                            {a.novosEleitores7d > 0 ? `+${a.novosEleitores7d} esta semana` : "0 esta semana"}
                          </span>
                          <span className="text-[10px] text-white/20">{a.cidadePrincipal}</span>
                          {a.diagnostico !== "Operacional" && a.diagnostico !== "Inativo (30d)" && (
                            <span className="text-[10px] text-amber-400/70">{a.diagnostico}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          {/* ── Atenção: Solicitações + Municípios Descobertos ── */}
          {(solicitacoesPendentes > 0 || cidadesSemAssessor.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {solicitacoesPendentes > 0 && (
                <GlassCard>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock size={15} className="text-blue-400" />
                    <h3 className="text-sm font-semibold text-white">Solicitações Pendentes</h3>
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/20">
                      {solicitacoesPendentes}
                    </span>
                  </div>
                  <p className="text-xs text-white/35 mb-4 leading-relaxed">
                    Mobilizadores aguardando aprovação para ativação na plataforma.
                  </p>
                  <Link
                    href="/solicitacoes"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/15 transition-all"
                  >
                    <CheckCircle size={13} /> Revisar Solicitações →
                  </Link>
                </GlassCard>
              )}

              {cidadesSemAssessor.length > 0 && (
                <GlassCard>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={15} className="text-red-400" />
                    <h3 className="text-sm font-semibold text-white">Municípios sem Assessor</h3>
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/20">
                      {cidadesSemAssessor.length}
                    </span>
                  </div>
                  <div className="space-y-2 mb-4 max-h-[180px] overflow-y-auto pr-1">
                    {cidadesSemAssessor.slice(0, 8).map((c) => {
                      const count = eleitores.filter((e) => e.cidade === c).length;
                      return (
                        <div key={c} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-red-500/5 border border-red-500/10">
                          <span className="text-xs font-semibold text-red-300">{c}</span>
                          <span className="text-[10px] text-white/35">{count} eleit. descobertos</span>
                        </div>
                      );
                    })}
                    {cidadesSemAssessor.length > 8 && (
                      <p className="text-[10px] text-white/25 text-center">+{cidadesSemAssessor.length - 8} municípios</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href="/missoes"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/15 transition-all"
                    >
                      <Zap size={12} /> Criar Missão
                    </Link>
                    <Link
                      href="/mapa-politico"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs font-semibold hover:text-white hover:bg-white/8 transition-all"
                    >
                      <MapPin size={12} /> Ver no Mapa
                    </Link>
                  </div>
                </GlassCard>
              )}
            </div>
          )}

          {/* ── Ações Rápidas ── */}
          <section>
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest mb-3">
              AÇÕES RÁPIDAS
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <QuickAction href="/missoes"       icon="⚡" label="Missões"              cor="violet" badge={missaoStats.atrasadas > 0 ? missaoStats.atrasadas : undefined} />
              <QuickAction href="/assessores"    icon="🏛️" label="Assessores"           cor="blue"   />
              <QuickAction href="/solicitacoes"  icon="📋" label="Aprovações"           cor="emerald" badge={solicitacoesPendentes} />
              <QuickAction href="/mapa-politico" icon="🗺️" label="Força Territorial"    cor="amber"  />
              <QuickAction href="/relatorios"    icon="📊" label="Relatórios"           cor="blue"   />
              <QuickAction href="/metas"         icon="🎯" label="Metas"                cor="violet" />
              <QuickAction href="/memoria-mandato" icon="📖" label="Memória"            cor="emerald" />
              <QuickAction href="/coordenadores" icon="🎖️" label="Coordenadores"        cor="amber"  />
            </div>
          </section>

    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function StatBox({
  label, value, total, icon, cor, href,
}: {
  label: string; value: number; total?: number; icon: string; cor: string; href?: string;
}) {
  const colorMap: Record<string, string> = {
    violet:  "bg-violet-500/10 border-violet-500/20",
    blue:    "bg-blue-500/10 border-blue-500/20",
    emerald: "bg-emerald-500/10 border-emerald-500/20",
    amber:   "bg-amber-500/10 border-amber-500/20",
  };
  const cls = colorMap[cor] ?? "bg-white/5 border-white/10";

  const inner = (
    <div className={`p-4 rounded-2xl border ${cls} hover:brightness-110 transition-all h-full`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xl">{icon}</span>
        {total !== undefined && total !== value && (
          <span className="text-[10px] text-white/20">{value}/{total}</span>
        )}
      </div>
      <p className="text-2xl font-bold text-white">{value.toLocaleString("pt-BR")}</p>
      <p className="text-xs text-white/40 mt-0.5">{label}</p>
    </div>
  );

  return href ? <Link href={href} className="block">{inner}</Link> : <div>{inner}</div>;
}

function MissaoStat({
  label, value, cor, urgente,
}: {
  label: string; value: number; cor: string; urgente?: boolean;
}) {
  const colorMap: Record<string, string> = {
    white:   "text-white/50",
    amber:   "text-amber-400",
    red:     "text-red-400",
    emerald: "text-emerald-400",
  };
  const textCls = colorMap[cor] ?? "text-white/50";

  return (
    <div className={`p-4 rounded-2xl bg-white/3 border ${urgente && value > 0 ? "border-white/15 bg-white/5" : "border-white/5"}`}>
      <p className={`text-2xl font-bold ${textCls}`}>{value}</p>
      <p className="text-xs text-white/30 mt-0.5">{label}</p>
      {urgente && value > 0 && (
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 animate-pulse ${cor === "red" ? "bg-red-500" : "bg-white/40"}`} />
      )}
    </div>
  );
}

function QuickAction({
  href, icon, label, cor, badge,
}: {
  href: string; icon: string; label: string; cor: string; badge?: number;
}) {
  const hoverMap: Record<string, string> = {
    violet:  "hover:bg-violet-500/10 hover:border-violet-500/20",
    blue:    "hover:bg-blue-500/10 hover:border-blue-500/20",
    emerald: "hover:bg-emerald-500/10 hover:border-emerald-500/20",
    amber:   "hover:bg-amber-500/10 hover:border-amber-500/20",
  };
  const hover = hoverMap[cor] ?? "hover:bg-white/8";

  return (
    <Link
      href={href}
      className={`relative p-4 rounded-2xl bg-white/3 border border-white/5 ${hover} transition-all group`}
    >
      {badge != null && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 text-[10px] font-bold w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      <span className="text-xl block mb-2">{icon}</span>
      <p className="text-xs text-white/50 group-hover:text-white/80 transition-colors leading-tight">
        {label}
      </p>
    </Link>
  );
}

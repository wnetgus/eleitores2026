"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { Eleitor, AppUser } from "@/types";
import { estados } from "@/lib/estados-cidades";
import { GlassCard } from "@/components/ui/GlassCard";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { formatDate, parseDate } from "@/lib/utils";
import { FileSpreadsheet, FileText, Filter, Search, TrendingUp, MapPin, Zap, X } from "lucide-react";
import { isPolitico, isAssessor, isAssessorOuExecutivo, isCoordenador } from "@/lib/permissions";
import { exportExcelPremium, exportPDFPremium } from "@/lib/reports";
import toast from "react-hot-toast";
import { calcularSFPSimples } from "@/lib/inteligencia";

const grauOptions = [
  { value: "", label: "Todos" },
  { value: "forte", label: "Forte" },
  { value: "medio", label: "Médio" },
  { value: "fraco", label: "Fraco" },
  { value: "indeciso", label: "Indeciso" },
];
const estadoOptions = [
  { value: "", label: "Todos" },
  ...estados.map((e) => ({ value: e.sigla, label: `${e.sigla} - ${e.nome}` })),
];

export default function RelatoriosPage() {
  const { userData } = useAuth();
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [filtered, setFiltered] = useState<Eleitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ estado: "", cidade: "", bairro: "", grauApoio: "", dataInicio: "", dataFim: "", search: "", colaboradorId: "" });
  const [grauPill, setGrauPill] = useState<"" | "forte" | "medio" | "fraco" | "indeciso" | "recente">("");
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [modalData, setModalData] = useState<{
    cidade: string; total: number; fortes: number; fracos: number; indecisos: number;
    recentes: number; prev30: number; forca: number; tendencia: number;
    sfp: ReturnType<typeof calcularSFPSimples>;
    assessor: AppUser | null;
    situacao: { emoji: string; label: string; cor: string; recomendacoes: string[] };
  } | null>(null);

  useEffect(() => {
    if (!userData) return;
    async function load() {
      try {
        const gabId = userData?.campanhaId || userData?.gabineteId;
        const constraints: any[] = [orderBy("criadoEm", "desc")];
        if (isCoordenador(userData)) {
          constraints.unshift(where("coordenadorId", "==", userData!.uid));
        } else {
          if (gabId) constraints.unshift(where("campanhaId", "==", gabId));
        }
        const q = query(collection(db, "eleitores"), ...constraints);
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor));
        setEleitores(data);
        setFiltered(data);
        if (isPolitico(userData) && gabId) {
          const [uSnap1, uSnap2] = await Promise.all([
            getDocs(query(collection(db, "usuarios"), where("campanhaId", "==", gabId))),
            getDocs(query(collection(db, "usuarios"), where("gabineteId", "==", gabId))),
          ]);
          const uMap = new Map<string, AppUser>();
          [...uSnap1.docs, ...uSnap2.docs].forEach(d => uMap.set(d.id, { uid: d.id, ...d.data() } as AppUser));
          setUsuarios([...uMap.values()]);
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    load();
  }, [userData]);

  const cidadesOpcoes = useMemo(() => {
    const base = filtros.estado ? eleitores.filter((e) => e.estado === filtros.estado) : eleitores;
    return [...new Set(base.map((e) => e.cidade).filter(Boolean))].sort();
  }, [eleitores, filtros.estado]);

  const bairrosOpcoes = useMemo(() => {
    const base = filtros.cidade
      ? eleitores.filter((e) => e.cidade === filtros.cidade)
      : filtros.estado ? eleitores.filter((e) => e.estado === filtros.estado) : eleitores;
    return [...new Set(base.map((e) => e.bairro).filter(Boolean))].sort();
  }, [eleitores, filtros.estado, filtros.cidade]);

  const colaboradoresOpcoes = useMemo(() => {
    if (!userData || !isCoordenador(userData)) return [];
    const seen = new Map<string, string>();
    for (const e of eleitores) {
      if (e.colaboradorId && !seen.has(e.colaboradorId)) seen.set(e.colaboradorId, e.colaboradorNome);
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [eleitores, userData]);

  const bairrosUnicos = useMemo(() => {
    if (!userData || !isCoordenador(userData)) return [] as string[];
    return [...new Set(eleitores.map((e) => e.bairro).filter(Boolean))] as string[];
  }, [eleitores, userData]);

  const coordTerritorioData = useMemo(() => {
    if (!userData || !isCoordenador(userData) || filtered.length === 0) return null;
    const agora30d = Date.now() - 30 * 86400000;
    const bairroMap = filtered.reduce<Record<string, { total: number; fortes: number; recentes: number }>>((acc, e) => {
      const key = e.bairro || e.cidade;
      if (!acc[key]) acc[key] = { total: 0, fortes: 0, recentes: 0 };
      acc[key].total++;
      if (e.grauApoio === "forte") acc[key].fortes++;
      if (parseDate(e.criadoEm).getTime() > agora30d) acc[key].recentes++;
      return acc;
    }, {});
    const bairrosArray = Object.entries(bairroMap)
      .map(([bairro, s]) => ({ bairro, ...s, pct: s.total > 0 ? Math.round((s.fortes / s.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
    const concentracao = bairrosArray.length > 0 ? Math.round((bairrosArray[0].total / filtered.length) * 100) : 0;
    const topBairro = bairrosArray[0] ?? null;
    return { bairrosArray, concentrado: concentracao >= 90, topBairro };
  }, [filtered, userData]);

  useEffect(() => {
    let result = [...eleitores];
    if (filtros.estado) result = result.filter((e) => e.estado === filtros.estado);
    if (filtros.cidade) result = result.filter((e) => e.cidade === filtros.cidade);
    if (filtros.bairro) result = result.filter((e) => e.bairro === filtros.bairro);
    if (filtros.colaboradorId) result = result.filter((e) => e.colaboradorId === filtros.colaboradorId);
    if (filtros.grauApoio) result = result.filter((e) => e.grauApoio === filtros.grauApoio);
    if (filtros.search) { const s = filtros.search.toLowerCase(); result = result.filter((e) => e.nomeCompleto.toLowerCase().includes(s) || e.cidade.toLowerCase().includes(s)); }
    if (filtros.dataInicio) { const inicio = new Date(filtros.dataInicio); result = result.filter((e) => parseDate(e.criadoEm) >= inicio); }
    if (filtros.dataFim) { const fim = new Date(filtros.dataFim); fim.setHours(23, 59, 59); result = result.filter((e) => parseDate(e.criadoEm) <= fim); }
    setFiltered(result);
  }, [filtros, eleitores]);

  async function exportExcelPremiumAction() {
    try {
      const res = await fetch("/api/exportar-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eleitores: filtered, titulo: userData?.gabineteNome || "Relatório" }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "relatorio-eleitores.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel premium exportado!");
    } catch (e) { toast.error("Erro ao exportar Excel"); }
  }
  function exportPDFPremiumAction() {
    try {
      exportPDFPremium(filtered, userData?.gabineteNome || "Relatório");
      toast.success("PDF premium exportado!");
    } catch (e) { toast.error("Erro ao exportar PDF"); }
  }

  const radarTerritorial = useMemo(() => {
    if (!userData || !isAssessorOuExecutivo(userData) || filtered.length === 0) return null;
    const agora30d = Date.now() - 30 * 86400000;
    const mapa: Record<string, { label: string; total: number; fortes: number; fracos: number; indecisos: number; recentes: number }> = {};
    for (const e of filtered) {
      const key = `${e.bairro || ""}||${e.cidade}`;
      const label = e.bairro ? `${e.bairro} · ${e.cidade}` : e.cidade;
      if (!mapa[key]) mapa[key] = { label, total: 0, fortes: 0, fracos: 0, indecisos: 0, recentes: 0 };
      mapa[key].total++;
      if (e.grauApoio === "forte")    mapa[key].fortes++;
      if (e.grauApoio === "fraco")    mapa[key].fracos++;
      if (e.grauApoio === "indeciso") mapa[key].indecisos++;
      if (parseDate(e.criadoEm).getTime() > agora30d) mapa[key].recentes++;
    }
    const stats = Object.values(mapa);
    const crescendo     = stats.filter((b) => b.recentes > 0).sort((a, b) => b.recentes - a.recentes).slice(0, 5);
    const estagnados    = stats.filter((b) => b.total > 2 && b.recentes === 0).sort((a, b) => b.total - a.total).slice(0, 5);
    const oportunidades = stats.filter((b) => b.total > 0 && b.indecisos / b.total >= 0.20).sort((a, b) => b.indecisos - a.indecisos).slice(0, 5);
    const atencao       = stats.filter((b) => b.total > 0 && b.fracos / b.total >= 0.25).sort((a, b) => (b.fracos / b.total) - (a.fracos / a.total)).slice(0, 5);
    const frases: string[] = [];
    if (crescendo.length > 0) {
      const labels = crescendo.slice(0, 2).map((t) => t.label).join(" e ");
      const mais = crescendo.length > 2 ? ` e mais ${crescendo.length - 2}` : "";
      frases.push(`${labels}${mais} ${crescendo.length === 1 ? "apresentou" : "apresentaram"} crescimento recente.`);
    }
    if (estagnados.length > 0) {
      const labels = estagnados.slice(0, 2).map((t) => t.label).join(" e ");
      frases.push(`${labels} ${estagnados.length === 1 ? "permanece" : "permanecem"} sem atividade há mais de 30 dias.`);
    }
    if (oportunidades.length > 0) {
      const top = oportunidades[0];
      frases.push(`Principal oportunidade em ${top.label}: ${Math.round((top.indecisos / top.total) * 100)}% de indecisos.`);
    }
    if (atencao.length > 0) {
      const top = atencao[0];
      frases.push(`Atenção em ${top.label}: ${Math.round((top.fracos / top.total) * 100)}% de rejeição registrada.`);
    }
    return { crescendo, estagnados, oportunidades, atencao, briefing: frases };
  }, [filtered, userData]);

  if (loading) return <div className="flex justify-center py-20"><svg className="animate-spin h-8 w-8 text-emerald-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;

  // Deputado federal: Central de Decisão Política
  if (userData && isPolitico(userData)) {
    const agora = Date.now();
    const indecisos = eleitores.filter((e) => e.grauApoio === "indeciso").length;

    const assessores = usuarios.filter(u => u.role === "assessor");
    const assessorPorCidade = new Map<string, AppUser>();
    for (const a of assessores) {
      for (const c of (a.cidades ?? (a.cidadePrincipal ? [a.cidadePrincipal] : []))) {
        if (!assessorPorCidade.has(c)) assessorPorCidade.set(c, a);
      }
    }

    const cidadeStats = Object.entries(
      eleitores.reduce<Record<string, { total: number; fortes: number; fracos: number; indecisos: number; recentes: number; prev30: number }>>((acc, e) => {
        if (!acc[e.cidade]) acc[e.cidade] = { total: 0, fortes: 0, fracos: 0, indecisos: 0, recentes: 0, prev30: 0 };
        acc[e.cidade].total++;
        if (e.grauApoio === "forte")    acc[e.cidade].fortes++;
        if (e.grauApoio === "fraco")    acc[e.cidade].fracos++;
        if (e.grauApoio === "indeciso") acc[e.cidade].indecisos++;
        const t = parseDate(e.criadoEm).getTime();
        if (t > agora - 30 * 86400000)      acc[e.cidade].recentes++;
        else if (t > agora - 60 * 86400000) acc[e.cidade].prev30++;
        return acc;
      }, {})
    ).map(([cidade, s]) => {
      const el = eleitores.filter(e => e.cidade === cidade);
      return {
        cidade, ...s,
        forca:     s.total > 0 ? Math.round((s.fortes / s.total) * 100) : 0,
        tendencia: s.prev30 > 0 ? Math.round(((s.recentes - s.prev30) / s.prev30) * 100) : s.recentes > 0 ? 100 : 0,
        sfp:       calcularSFPSimples(el),
        assessor:  assessorPorCidade.get(cidade) ?? null,
      };
    }).sort((a, b) => b.total - a.total);

    const todasCidades = new Set([
      ...cidadeStats.map(c => c.cidade),
      ...assessores.flatMap(a => a.cidades ?? (a.cidadePrincipal ? [a.cidadePrincipal] : [])),
    ]);
    const totalCidades  = todasCidades.size;
    const cidadesComAssessor = [...todasCidades].filter(c => assessorPorCidade.has(c)).length;

    const municipiosExpansao = cidadeStats.filter(c =>
      c.tendencia > 20 && c.sfp?.label !== "Em Risco" && c.sfp?.label !== "Abandonado" && c.total > 0
    ).length;

    const municipiosRisco = cidadeStats.filter(c =>
      c.total > 0 && (c.forca < 10 || c.sfp?.label === "Em Risco" || c.sfp?.label === "Abandonado" || c.tendencia < 0)
    ).length;

    function getSituacao(c: { forca: number; tendencia: number; indecisos: number; total: number; sfp: ReturnType<typeof calcularSFPSimples>; assessor: AppUser | null }): { emoji: string; label: string; cor: string; recomendacoes: string[] } {
      if (!c.assessor)
        return { emoji: "⚫", label: "Sem Cobertura",          cor: "text-white/40",     recomendacoes: ["Designar assessoria regional", "Iniciar mapeamento territorial"] };
      if (c.forca < 10 || c.sfp?.label === "Em Risco" || c.sfp?.label === "Abandonado" || c.tendencia < -30)
        return { emoji: "🔴", label: "Intervenção Necessária", cor: "text-red-400",      recomendacoes: ["Reunir assessoria regional", "Reforçar coordenação", "Criar meta de recuperação"] };
      if (c.forca < 20)
        return { emoji: "🔴", label: "Base Fragilizada",       cor: "text-red-400",      recomendacoes: ["Reforçar coordenação", "Mapear causas da queda"] };
      if (c.forca >= 40 && c.tendencia >= 0)
        return { emoji: "🟢", label: "Domínio Consolidado",    cor: "text-emerald-400",  recomendacoes: ["Expandir bairros estratégicos", "Manter engajamento da base"] };
      if (c.tendencia > 20)
        return { emoji: "🟢", label: "Crescimento Forte",      cor: "text-emerald-400",  recomendacoes: ["Intensificar conversão dos indecisos", "Ampliar coordenação"] };
      return   { emoji: "🟡", label: "Potencial de Conversão", cor: "text-amber-400",    recomendacoes: ["Campanha de conversão direcionada", "Reforçar presença local"] };
    }

    function getPotencial(c: { indecisos: number; forca: number; tendencia: number }): { label: string; cor: string } {
      if (c.indecisos > 30 && c.forca >= 25 && c.tendencia > 20) return { label: "🟢 MUITO ALTO POTENCIAL", cor: "text-emerald-400" };
      if (c.indecisos > 15 && c.forca >= 20)                      return { label: "🟢 ALTO POTENCIAL",       cor: "text-emerald-400" };
      return                                                               { label: "🟡 POTENCIAL MODERADO",  cor: "text-amber-400"   };
    }

    const criticas      = cidadeStats.filter(c => c.total > 0 && (c.forca < 10 || c.sfp?.label === "Em Risco" || c.sfp?.label === "Abandonado"));
    const oportunidades = cidadeStats.filter(c => c.total > 0 && c.indecisos > 0 && c.indecisos / c.total > 0.2);

    const recsPrioridade   = cidadeStats.filter(c => c.total > 0 && (c.forca < 10 || c.tendencia < -30)).slice(0, 3);
    const recsOportunidade = cidadeStats.filter(c => c.indecisos > 15 && c.forca >= 20).slice(0, 3);
    const recsExpansao     = cidadeStats.filter(c => !c.assessor).slice(0, 2);

    return (
      <div className="space-y-6 animate-in">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Inteligência Política</h1>
            <p className="text-white/50 text-sm mt-1">
              Centro de decisão estratégica · {cidadeStats.length} {cidadeStats.length === 1 ? "território mapeado" : "territórios mapeados"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportExcelPremiumAction}><FileSpreadsheet size={16} /> Excel</Button>
            <Button variant="secondary" onClick={exportPDFPremiumAction}><FileText size={16} /> PDF</Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <GlassCard className="p-4 text-center">
            <p className={`text-3xl font-bold ${municipiosExpansao > 0 ? "text-emerald-400" : "text-white/30"}`}>{municipiosExpansao}</p>
            <p className="text-xs text-white/40 mt-1">Municípios em Expansão</p>
            <p className="text-[10px] text-emerald-400/40 mt-1">crescimento &gt;20%</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className={`text-3xl font-bold ${municipiosRisco > 0 ? "text-red-400" : "text-white/30"}`}>{municipiosRisco}</p>
            <p className="text-xs text-white/40 mt-1">Municípios em Risco</p>
            <p className="text-[10px] text-red-400/40 mt-1">base fraca ou queda</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-400">{indecisos.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-white/40 mt-1">Eleitores Conversíveis</p>
            <p className="text-[10px] text-blue-400/40 mt-1">indecisos na base</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-400">
              {cidadesComAssessor}<span className="text-base text-white/30">/{totalCidades}</span>
            </p>
            <p className="text-xs text-white/40 mt-1">Cobertura Estratégica</p>
            <p className="text-[10px] text-amber-400/40 mt-1">municípios com assessor</p>
          </GlassCard>
        </div>

        {/* Áreas Críticas + Oportunidades */}
        {(criticas.length > 0 || oportunidades.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {criticas.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">🔴</span>
                  <h2 className="text-white font-semibold text-sm">Áreas Críticas</h2>
                  <span className="text-xs text-red-400/60 ml-auto">{criticas.length} {criticas.length === 1 ? "município" : "municípios"}</span>
                </div>
                <div className="space-y-3">
                  {criticas.slice(0, 4).map(c => {
                    const sit = getSituacao(c);
                    return (
                      <div key={c.cidade} className="p-4 rounded-xl bg-red-500/[0.05] border border-red-500/15 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-white font-semibold">{c.cidade}</p>
                            <p className={`text-xs font-medium mt-0.5 ${sit.cor}`}>{sit.emoji} {sit.label}</p>
                          </div>
                          {c.assessor && (
                            <div className="text-right shrink-0">
                              <p className="text-[10px] text-white/25">Assessor(a)</p>
                              <p className="text-xs text-white/55 font-medium">{c.assessor.nome.split(" ")[0]}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs">
                          <span className={c.forca < 10 ? "text-red-400" : "text-amber-400"}>{c.forca}% forte</span>
                          {c.indecisos > 0 && <span className="text-blue-400/70">{c.indecisos} indecisos</span>}
                          {c.tendencia !== 0 && (
                            <span className={c.tendencia < 0 ? "text-red-400" : "text-emerald-400"}>
                              {c.tendencia > 0 ? "+" : ""}{c.tendencia}% crescimento
                            </span>
                          )}
                        </div>
                        <div className="pt-2 border-t border-red-500/10 space-y-1">
                          <p className="text-[10px] text-white/25 uppercase tracking-wider">Ação recomendada</p>
                          {sit.recomendacoes.map(r => (
                            <p key={r} className="text-xs text-red-400/70">→ {r}</p>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {oportunidades.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={14} className="text-blue-400" />
                  <h2 className="text-white font-semibold text-sm">Oportunidades Eleitorais</h2>
                  <span className="text-xs text-blue-400/60 ml-auto">{oportunidades.length} {oportunidades.length === 1 ? "município" : "municípios"}</span>
                </div>
                <div className="space-y-3">
                  {oportunidades.slice(0, 4).map(c => {
                    const pot = getPotencial(c);
                    return (
                      <div key={c.cidade} className="p-4 rounded-xl bg-blue-500/[0.05] border border-blue-500/15 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-white font-semibold">{c.cidade}</p>
                            <p className={`text-xs font-semibold mt-0.5 ${pot.cor}`}>{pot.label}</p>
                          </div>
                          <p className="text-2xl font-bold text-blue-400 shrink-0">{c.indecisos}</p>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs">
                          <span className="text-white/45">{c.indecisos} indecisos</span>
                          <span className={c.forca >= 30 ? "text-emerald-400" : "text-amber-400"}>{c.forca}% forte</span>
                          {c.tendencia !== 0 && (
                            <span className={c.tendencia > 0 ? "text-emerald-400" : "text-red-400"}>
                              {c.tendencia > 0 ? "+" : ""}{c.tendencia}% crescimento
                            </span>
                          )}
                        </div>
                        <div className="pt-2 border-t border-blue-500/10 space-y-1">
                          <p className="text-[10px] text-white/25 uppercase tracking-wider">Ação</p>
                          <p className="text-xs text-blue-400/70">→ Intensificar conversão dos indecisos</p>
                          {c.tendencia > 0 && <p className="text-xs text-blue-400/70">→ Campanha segmentada por bairro</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ranking Territorial */}
        {cidadeStats.length > 0 && (
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={16} className="text-violet-400" />
              <h3 className="text-white font-semibold">Ranking Territorial</h3>
              <span className="text-xs text-white/30 ml-auto">{cidadeStats.length} territórios mapeados</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 border-b border-white/[0.06]">
                    <th className="text-left py-3 px-2 font-medium">Território</th>
                    <th className="text-right py-3 px-2 font-medium">Base</th>
                    <th className="text-right py-3 px-2 font-medium">Fortes</th>
                    <th className="text-right py-3 px-2 font-medium">Indecisos</th>
                    <th className="text-right py-3 px-2 font-medium">30d</th>
                    <th className="text-right py-3 px-2 font-medium">Tendência</th>
                    <th className="text-left py-3 px-2 font-medium">Força política</th>
                    <th className="text-left py-3 px-2 font-medium">Situação</th>
                    <th className="py-3 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {cidadeStats.map((c) => {
                    const sit = getSituacao(c);
                    return (
                      <tr key={c.cidade} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-2 text-white/80 font-medium">{c.cidade}</td>
                        <td className="py-3 px-2 text-white/60 text-right">{c.total}</td>
                        <td className="py-3 px-2 text-emerald-400 text-right">{c.fortes}</td>
                        <td className="py-3 px-2 text-blue-400 text-right">{c.indecisos}</td>
                        <td className="py-3 px-2 text-right">
                          <span className={`text-xs ${c.recentes > 0 ? "text-emerald-400" : "text-white/30"}`}>
                            {c.recentes > 0 ? `+${c.recentes}` : "—"}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={`text-xs font-medium ${c.tendencia > 0 ? "text-emerald-400" : c.tendencia < 0 ? "text-red-400" : "text-white/30"}`}>
                            {c.tendencia > 0 ? `+${c.tendencia}%` : c.tendencia < 0 ? `${c.tendencia}%` : "—"}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-white/[0.04] rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${c.forca >= 40 ? "bg-emerald-500" : c.forca >= 20 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${c.forca}%` }}
                              />
                            </div>
                            <span className={`text-xs ${c.forca >= 40 ? "text-emerald-400" : c.forca >= 20 ? "text-amber-400" : "text-red-400"}`}>
                              {c.forca}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`text-xs font-medium whitespace-nowrap ${sit.cor}`}>
                            {sit.emoji} {sit.label}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <button
                            onClick={() => setModalData({ ...c, situacao: sit })}
                            className="text-xs text-white/25 hover:text-violet-400 transition-colors whitespace-nowrap"
                          >
                            Ver análise →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}

        {/* Recomendações Estratégicas */}
        {(recsPrioridade.length > 0 || recsOportunidade.length > 0 || recsExpansao.length > 0) && (
          <div>
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span>⭐</span><span>Recomendações Estratégicas</span>
            </h2>
            <div className="space-y-3">
              {recsPrioridade.map(c => {
                const sit = getSituacao(c);
                return (
                  <div key={`p-${c.cidade}`} className="p-4 rounded-xl bg-red-500/[0.05] border border-red-500/20">
                    <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3">🔴 PRIORIDADE MÁXIMA</p>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <p className="text-white font-semibold truncate">{c.cidade}</p>
                        {c.assessor && <p className="text-xs text-white/35">Assessor(a): <span className="text-white/55">{c.assessor.nome.split(" ")[0]}</span></p>}
                        <div className="flex gap-3 text-xs">
                          <span className="text-red-400">{c.forca}% forte</span>
                          {c.tendencia < 0 && <span className="text-red-400/70">{c.tendencia}% crescimento</span>}
                        </div>
                      </div>
                      <div className="space-y-1 shrink-0 text-right">
                        {sit.recomendacoes.map(r => (
                          <p key={r} className="text-xs text-red-400/60">→ {r}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              {recsOportunidade.map(c => (
                <div key={`o-${c.cidade}`} className="p-4 rounded-xl bg-amber-500/[0.05] border border-amber-500/20">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3">🟡 OPORTUNIDADE</p>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <p className="text-white font-semibold truncate">{c.cidade}</p>
                      <div className="flex gap-3 text-xs">
                        <span className="text-blue-400">{c.indecisos} indecisos</span>
                        <span className="text-emerald-400">{c.forca}% forte</span>
                      </div>
                    </div>
                    <div className="space-y-1 shrink-0 text-right">
                      <p className="text-xs text-amber-400/60">→ Campanha de conversão</p>
                      <p className="text-xs text-amber-400/60">→ Reforçar presença local</p>
                    </div>
                  </div>
                </div>
              ))}
              {recsExpansao.map(c => (
                <div key={`e-${c.cidade}`} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.07]">
                  <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">⚫ EXPANSÃO</p>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <p className="text-white font-semibold truncate">{c.cidade}</p>
                      <p className="text-xs text-white/30">{c.total} apoiadores · sem assessoria</p>
                    </div>
                    <div className="space-y-1 shrink-0 text-right">
                      <p className="text-xs text-white/35">→ Designar assessoria regional</p>
                      <p className="text-xs text-white/35">→ Iniciar mapeamento territorial</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal de análise territorial */}
        {modalData && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setModalData(null)}
          >
            <div
              className="w-full max-w-md bg-[#0f1117] border border-white/[0.10] rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wider mb-1 ${modalData.situacao.cor}`}>
                      {modalData.situacao.emoji} {modalData.situacao.label}
                    </p>
                    <h3 className="text-xl font-bold text-white">{modalData.cidade}</h3>
                  </div>
                  <button onClick={() => setModalData(null)} className="text-white/30 hover:text-white/70 transition-colors mt-0.5 shrink-0">
                    <X size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-3 rounded-xl bg-white/[0.03]">
                    <p className="text-xl font-bold text-white">{modalData.total}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">apoiadores</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-white/[0.03]">
                    <p className="text-xl font-bold text-emerald-400">{modalData.fortes}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">fortes</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-white/[0.03]">
                    <p className="text-xl font-bold text-blue-400">{modalData.indecisos}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">indecisos</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs px-1">
                  <span className={`font-medium ${modalData.tendencia > 0 ? "text-emerald-400" : modalData.tendencia < 0 ? "text-red-400" : "text-white/30"}`}>
                    {modalData.tendencia > 0 ? `+${modalData.tendencia}%` : modalData.tendencia < 0 ? `${modalData.tendencia}%` : "—"} crescimento 30d
                  </span>
                  <span className="text-white/20">·</span>
                  <span className={modalData.forca >= 40 ? "text-emerald-400" : modalData.forca >= 20 ? "text-amber-400" : "text-red-400"}>
                    {modalData.forca}% forte
                  </span>
                </div>

                {modalData.assessor && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03]">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {modalData.assessor.nome.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm text-white/75 font-medium">{modalData.assessor.nome}</p>
                      <p className="text-[10px] text-white/30">Assessor(a) regional</p>
                    </div>
                  </div>
                )}

                <div className="pt-1 border-t border-white/[0.06] space-y-2">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider">Recomendações</p>
                  {modalData.situacao.recomendacoes.map(r => (
                    <div key={r} className="flex items-center gap-2.5 text-xs text-white/55">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        modalData.situacao.cor === "text-emerald-400" ? "bg-emerald-400" :
                        modalData.situacao.cor === "text-amber-400"  ? "bg-amber-400"   :
                        modalData.situacao.cor === "text-red-400"    ? "bg-red-400"     : "bg-white/30"
                      }`} />
                      {r}
                    </div>
                  ))}
                </div>

                <div className="pt-1 border-t border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Próximas Ações</p>
                    <span className="text-[9px] text-white/15 italic">Fase 2</span>
                  </div>
                  {["Reunir assessor", "Criar meta territorial", "Reforçar coordenação", "Expandir município"].map(acao => (
                    <label key={acao} className="flex items-center gap-2.5 text-xs text-white/35 cursor-not-allowed select-none">
                      <input type="checkbox" disabled className="opacity-20 cursor-not-allowed" />
                      {acao}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{isAssessorOuExecutivo(userData) ? "Radar Territorial" : "Relatórios"}</h1>
          <p className="text-white/50 text-sm mt-1">{isAssessorOuExecutivo(userData) ? `Inteligência regional · ${filtered.length} apoiadores na base` : "Filtre e exporte seus dados"}</p>
        </div>
        <div className="flex items-center gap-2"><Button variant="secondary" onClick={exportExcelPremiumAction}><FileSpreadsheet size={16} /> Excel Premium</Button><Button variant="secondary" onClick={exportPDFPremiumAction}><FileText size={16} /> PDF Premium</Button></div>
      </div>
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><Filter size={18} className="text-emerald-400" /><h3 className="text-white font-semibold">Filtros</h3></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {!isAssessor(userData) && !isCoordenador(userData) && (
            <Select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value, cidade: "", bairro: "" })} options={estadoOptions} label="Estado" />
          )}
          {!isCoordenador(userData) && (
            <Select
              label="Cidade"
              value={filtros.cidade}
              onChange={(e) => setFiltros({ ...filtros, cidade: e.target.value, bairro: "" })}
              options={[{ value: "", label: "Todas as cidades" }, ...cidadesOpcoes.map((c) => ({ value: c, label: c }))]}
              disabled={cidadesOpcoes.length === 0}
            />
          )}
          {!isCoordenador(userData) && (
            <Select
              label="Bairro"
              value={filtros.bairro}
              onChange={(e) => setFiltros({ ...filtros, bairro: e.target.value })}
              options={[{ value: "", label: "Todos os bairros" }, ...bairrosOpcoes.map((b) => ({ value: b, label: b }))]}
              disabled={bairrosOpcoes.length === 0}
            />
          )}
          {isCoordenador(userData) && bairrosUnicos.length > 1 && (
            <Select
              label="Bairro"
              value={filtros.bairro}
              onChange={(e) => setFiltros({ ...filtros, bairro: e.target.value })}
              options={[{ value: "", label: "Todos os bairros" }, ...bairrosUnicos.map((b) => ({ value: b, label: b }))]}
            />
          )}
          {isCoordenador(userData) && (
            <Select
              label="Colaborador"
              value={filtros.colaboradorId}
              onChange={(e) => setFiltros({ ...filtros, colaboradorId: e.target.value })}
              options={[{ value: "", label: "Todos" }, ...colaboradoresOpcoes]}
              disabled={colaboradoresOpcoes.length === 0}
            />
          )}
          <Select value={filtros.grauApoio} onChange={(e) => setFiltros({ ...filtros, grauApoio: e.target.value })} options={grauOptions} label="Grau de Apoio" />
          <div><label className="block text-sm font-medium text-white/70 mb-1.5">Data Início</label><input type="date" value={filtros.dataInicio} onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1.5">Data Fim</label><input type="date" value={filtros.dataFim} onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1.5">Busca</label><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" /><input type="text" value={filtros.search} onChange={(e) => setFiltros({ ...filtros, search: e.target.value })} placeholder="Nome do eleitor..." className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" /></div></div>
        </div>
        <div className="mt-4 text-sm text-white/40">{filtered.length} de {eleitores.length} registros encontrados</div>
      </GlassCard>

      {/* Radar Territorial — assessor */}
      {radarTerritorial && (
        <>
          {radarTerritorial.briefing.length > 0 && (
            <GlassCard className="p-4 border-violet-500/10">
              <p className="text-[11px] text-violet-300/50 uppercase tracking-wide mb-2 font-medium">Briefing Regional</p>
              <p className="text-white/70 text-sm leading-relaxed">{radarTerritorial.briefing.join(" ")}</p>
            </GlassCard>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <GlassCard className="p-4 border-emerald-500/10">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={13} className="text-emerald-400" />
                <h3 className="text-emerald-400 font-semibold text-sm">Crescimento</h3>
                {radarTerritorial.crescendo.length > 0 && <span className="ml-auto text-xs text-emerald-400/40">{radarTerritorial.crescendo.length}</span>}
              </div>
              {radarTerritorial.crescendo.length > 0 ? (
                <div className="space-y-2">
                  {radarTerritorial.crescendo.map((t) => (
                    <div key={t.label} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-white/65 truncate">{t.label}</span>
                      <span className="text-xs text-emerald-400 shrink-0">+{t.recentes}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/25 italic">Sem crescimento recente</p>
              )}
            </GlassCard>

            <GlassCard className="p-4 border-amber-500/10">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm leading-none">⚠</span>
                <h3 className="text-amber-400 font-semibold text-sm">Estagnados</h3>
                {radarTerritorial.estagnados.length > 0 && <span className="ml-auto text-xs text-amber-400/40">{radarTerritorial.estagnados.length}</span>}
              </div>
              {radarTerritorial.estagnados.length > 0 ? (
                <div className="space-y-2">
                  {radarTerritorial.estagnados.map((t) => (
                    <div key={t.label} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-white/65 truncate">{t.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-white/30">{t.total}</span>
                        <a href={`https://wa.me/?text=${encodeURIComponent(`⚠ Território estagnado: ${t.label} — ${t.total} apoiadores sem atividade há 30 dias.`)}`} target="_blank" rel="noopener noreferrer" className="text-green-400/30 hover:text-green-400 transition-colors leading-none">📲</a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/25 italic">Todos os territórios ativos</p>
              )}
            </GlassCard>

            <GlassCard className="p-4 border-blue-500/10">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={13} className="text-blue-400" />
                <h3 className="text-blue-400 font-semibold text-sm">Oportunidades</h3>
                {radarTerritorial.oportunidades.length > 0 && <span className="ml-auto text-xs text-blue-400/40">{radarTerritorial.oportunidades.length}</span>}
              </div>
              {radarTerritorial.oportunidades.length > 0 ? (
                <div className="space-y-2">
                  {radarTerritorial.oportunidades.map((t) => (
                    <div key={t.label} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-white/65 truncate">{t.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-blue-400">{Math.round((t.indecisos / t.total) * 100)}%</span>
                        <a href={`https://wa.me/?text=${encodeURIComponent(`🎯 Oportunidade: ${t.label} — ${t.indecisos} indecisos (${Math.round((t.indecisos / t.total) * 100)}%). Intensificar abordagem.`)}`} target="_blank" rel="noopener noreferrer" className="text-green-400/30 hover:text-green-400 transition-colors leading-none">📲</a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/25 italic">Sem concentração de indecisos</p>
              )}
            </GlassCard>

            <GlassCard className="p-4 border-red-500/10">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm leading-none">🚨</span>
                <h3 className="text-red-400 font-semibold text-sm">Atenção</h3>
                {radarTerritorial.atencao.length > 0 && <span className="ml-auto text-xs text-red-400/40">{radarTerritorial.atencao.length}</span>}
              </div>
              {radarTerritorial.atencao.length > 0 ? (
                <div className="space-y-2">
                  {radarTerritorial.atencao.map((t) => (
                    <div key={t.label} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-white/65 truncate">{t.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-red-400">{Math.round((t.fracos / t.total) * 100)}%</span>
                        <a href={`https://wa.me/?text=${encodeURIComponent(`🚨 Área de atenção: ${t.label} — ${Math.round((t.fracos / t.total) * 100)}% de rejeição. Avaliar estratégia.`)}`} target="_blank" rel="noopener noreferrer" className="text-green-400/30 hover:text-green-400 transition-colors leading-none">📲</a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/25 italic">Sem alta rejeição registrada</p>
              )}
            </GlassCard>
          </div>
        </>
      )}

      {/* VISÃO TERRITORIAL */}
      {filtered.length > 0 && isCoordenador(userData) && coordTerritorioData && (
        coordTerritorioData.concentrado ? (
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={14} className="text-emerald-400" />
              <span className="text-sm font-semibold text-white">Meu Território</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 space-y-2">
                <p className="text-xl font-bold text-white">
                  {coordTerritorioData.topBairro!.bairro}
                  {userData?.cidade ? ` · ${userData.cidade}` : ""}
                </p>
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-white/50 text-sm">{filtered.length} eleitores</span>
                  <span className={`text-sm font-semibold ${coordTerritorioData.topBairro!.pct >= 40 ? "text-emerald-400" : coordTerritorioData.topBairro!.pct >= 20 ? "text-amber-400" : "text-red-400"}`}>
                    {coordTerritorioData.topBairro!.pct}% fortes
                  </span>
                  {coordTerritorioData.topBairro!.recentes > 0 && (
                    <span className="text-emerald-400/70 text-sm">+{coordTerritorioData.topBairro!.recentes} nos últimos 30d</span>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                <div className="w-32 bg-white/[0.04] rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${coordTerritorioData.topBairro!.pct >= 40 ? "bg-emerald-500" : coordTerritorioData.topBairro!.pct >= 20 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${coordTerritorioData.topBairro!.pct}%` }}
                  />
                </div>
              </div>
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={14} className="text-emerald-400" />
              <span className="text-sm font-semibold text-white">Distribuição Territorial</span>
              <span className="text-xs text-white/30 ml-auto">{coordTerritorioData.bairrosArray.length} bairros</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {coordTerritorioData.bairrosArray.slice(0, 8).map((r) => (
                <div key={r.bairro} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-1.5">
                  <p className="text-xs text-white/70 font-medium truncate">{r.bairro}</p>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-lg font-bold text-white">{r.total}</span>
                    <span className={`text-xs font-medium ${r.pct >= 40 ? "text-emerald-400" : r.pct >= 20 ? "text-amber-400" : "text-red-400"}`}>{r.pct}% fortes</span>
                  </div>
                  <div className="w-full bg-white/[0.04] rounded-full h-1">
                    <div className={`h-1 rounded-full ${r.pct >= 40 ? "bg-emerald-500" : r.pct >= 20 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${r.pct}%` }} />
                  </div>
                  {r.recentes > 0 && <p className="text-[10px] text-emerald-400/70">+{r.recentes} nos 30d</p>}
                </div>
              ))}
            </div>
          </GlassCard>
        )
      )}

      {/* VISÃO TERRITORIAL — assessor/outros */}
      {filtered.length > 0 && !isCoordenador(userData) && (() => {
        const resumo = Object.entries(
          filtered.reduce<Record<string, { total: number; fortes: number; recentes: number }>>((acc, e) => {
            if (!acc[e.cidade]) acc[e.cidade] = { total: 0, fortes: 0, recentes: 0 };
            acc[e.cidade].total++;
            if (e.grauApoio === "forte") acc[e.cidade].fortes++;
            if (parseDate(e.criadoEm).getTime() > Date.now() - 30 * 86400000) acc[e.cidade].recentes++;
            return acc;
          }, {})
        ).map(([cidade, s]) => ({ cidade, ...s, pct: s.total > 0 ? Math.round((s.fortes / s.total) * 100) : 0 }))
          .sort((a, b) => b.total - a.total).slice(0, 8);
        return (
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={14} className="text-emerald-400" />
              <span className="text-sm font-semibold text-white">Visão Territorial</span>
              <span className="text-xs text-white/30 ml-auto">{resumo.length} cidades</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {resumo.map((r) => (
                <div key={r.cidade} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-1.5">
                  <p className="text-xs text-white/70 font-medium truncate">{r.cidade}</p>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-lg font-bold text-white">{r.total}</span>
                    <span className={`text-xs font-medium ${r.pct >= 40 ? "text-emerald-400" : r.pct >= 20 ? "text-amber-400" : "text-red-400"}`}>{r.pct}% fortes</span>
                  </div>
                  <div className="w-full bg-white/[0.04] rounded-full h-1">
                    <div className={`h-1 rounded-full ${r.pct >= 40 ? "bg-emerald-500" : r.pct >= 20 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${r.pct}%` }} />
                  </div>
                  {r.recentes > 0 && <p className="text-[10px] text-emerald-400/70">+{r.recentes} nos 30d</p>}
                </div>
              ))}
            </div>
          </GlassCard>
        );
      })()}

      {/* Pills de qualidade — leitura rápida da base */}
      {filtered.length > 0 && (() => {
        const agora7d = Date.now() - 7 * 86400000;
        const contagens = {
          forte:    filtered.filter((e) => e.grauApoio === "forte").length,
          medio:    filtered.filter((e) => e.grauApoio === "medio").length,
          indeciso: filtered.filter((e) => e.grauApoio === "indeciso").length,
          fraco:    filtered.filter((e) => e.grauApoio === "fraco").length,
          recente:  filtered.filter((e) => parseDate(e.criadoEm).getTime() > agora7d).length,
        };
        const pills = [
          { key: "",         label: "Todos",    count: filtered.length, cor: "text-white/60",  ativo: "bg-white/10 text-white border-white/20" },
          { key: "forte",    label: "Fortes",   count: contagens.forte,    cor: "text-emerald-400", ativo: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
          { key: "medio",    label: "Médios",   count: contagens.medio,    cor: "text-amber-400",   ativo: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
          { key: "indeciso", label: "Indecisos",count: contagens.indeciso, cor: "text-blue-400",    ativo: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
          { key: "fraco",    label: "Fracos",   count: contagens.fraco,    cor: "text-red-400",     ativo: "bg-red-500/15 text-red-400 border-red-500/30" },
          { key: "recente",  label: "Recentes", count: contagens.recente,  cor: "text-violet-400",  ativo: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
        ] as const;
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-white/20 pr-1 tracking-wide uppercase">Leitura</span>
            {pills.map(({ key, label, count, ativo }) => (
              <button
                key={key}
                onClick={() => setGrauPill(grauPill === key ? "" : key as typeof grauPill)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                  grauPill === key ? ativo : "text-white/30 border-white/[0.07] hover:text-white/55 hover:border-white/20"
                }`}
              >
                {label} <span className="opacity-60 ml-0.5">·{count}</span>
              </button>
            ))}
          </div>
        );
      })()}

      <GlassCard className="p-4">
        {(() => {
          const agora7d = Date.now() - 7 * 86400000;
          const listaExibicao = grauPill === ""
            ? filtered
            : grauPill === "recente"
              ? filtered.filter((e) => parseDate(e.criadoEm).getTime() > agora7d)
              : filtered.filter((e) => e.grauApoio === grauPill);
          return (
            <>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-white/30" />
                <span className="text-xs font-medium text-white/40">Registros individuais</span>
                <span className="text-xs text-white/20 ml-auto">{listaExibicao.length}{grauPill && ` de ${filtered.length}`}</span>
              </div>
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-white/40 border-b border-white/[0.06]"><th className="text-left py-3 px-2 font-medium">Nome</th><th className="text-left py-3 px-2 font-medium">Telefone</th><th className="text-left py-3 px-2 font-medium">Documento</th><th className="text-left py-3 px-2 font-medium">Estado</th><th className="text-left py-3 px-2 font-medium">Cidade</th><th className="text-left py-3 px-2 font-medium">Bairro</th><th className="text-left py-3 px-2 font-medium">Grau</th><th className="text-left py-3 px-2 font-medium">Colaborador</th><th className="text-left py-3 px-2 font-medium">Data</th></tr></thead>
                  <tbody>
                    {listaExibicao.map((e) => (
                      <tr key={e.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 px-2 text-white/70">{e.nomeCompleto}</td>
                        <td className="py-2 px-2 text-white/50">{e.telefone || "-"}</td>
                        <td className="py-2 px-2 text-white/50 font-mono">{e.tipoDocumento?.toUpperCase()}: {e.documento}</td>
                        <td className="py-2 px-2 text-white/50">{e.estado}</td>
                        <td className="py-2 px-2 text-white/50">{e.cidade}</td>
                        <td className="py-2 px-2 text-white/50">{e.bairro || "-"}</td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.grauApoio === "forte" ? "bg-emerald-500/20 text-emerald-400" : e.grauApoio === "medio" ? "bg-amber-500/20 text-amber-400" : e.grauApoio === "fraco" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>
                            {e.grauApoio}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-white/50">{e.colaboradorNome}</td>
                        <td className="py-2 px-2 text-white/30">{formatDate(e.criadoEm)}</td>
                      </tr>
                    ))}
                    {listaExibicao.length === 0 && (
                      <tr><td colSpan={9} className="py-12 text-center text-white/30">Nenhum registro encontrado</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
      </GlassCard>
    </div>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Eleitor, AppUser } from "@/types";
import { getRoleConfig, isSuperOrMaster, isPolitico, isPrefeito, isVereador, isAssessor, isAssessorExecutivo } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatDate, parseDate } from "@/lib/utils";
import { FileSpreadsheet, FileText, Upload, BarChart2, Zap, AlertTriangle, X, MapPin, Crown, Target, Flag, TrendingUp } from "lucide-react";
import { exportPDFPremium, exportRelatorioExecutivo } from "@/lib/reports";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

export default function ExportacoesPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [assessores, setAssessores] = useState<AppUser[]>([]);
  const [selectedAssessorId, setSelectedAssessorId] = useState("");
  const [selectedCidade, setSelectedCidade] = useState("");
  const [modalDossie, setModalDossie] = useState(false);

  useEffect(() => {
    if (userData && !isSuperOrMaster(userData) && !isPolitico(userData) && !isPrefeito(userData) && !isVereador(userData) && !isAssessorExecutivo(userData) && !isAssessor(userData)) {
      router.push("/dashboard");
      return;
    }
    async function load() {
      try {
        const gabId = userData?.campanhaId || userData?.gabineteId;
        const constraints: any[] = [orderBy("criadoEm", "desc")];
        if (!isSuperOrMaster(userData) && gabId) constraints.unshift(where("campanhaId", "==", gabId));
        const q = query(collection(db, "eleitores"), ...constraints);
        const snap = await getDocs(q);
        setEleitores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor)));
        if (isPolitico(userData!) && gabId) {
          const aSnap = await getDocs(query(collection(db, "usuarios"), where("role", "==", "assessor"), where("campanhaId", "==", gabId)));
          setAssessores(aSnap.docs.map(d => ({ uid: d.id, ...d.data() } as AppUser)));
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    if (userData) load();
  }, [userData]);

  const stats = useMemo(() => {
    const agora30d = Date.now() - 30 * 86400e3;
    const fortes    = eleitores.filter((e) => e.grauApoio === "forte").length;
    const indecisos = eleitores.filter((e) => e.grauApoio === "indeciso").length;
    const fracos    = eleitores.filter((e) => e.grauApoio === "fraco").length;
    const medios    = eleitores.filter((e) => e.grauApoio === "medio").length;
    const recentes  = eleitores.filter((e) => parseDate(e.criadoEm).getTime() > agora30d).length;

    const coordMap: Record<string, { nome: string; total: number; fortes: number; indecisos: number; fracos: number }> = {};
    const cidadeMap: Record<string, number> = {};
    const terrMap: Record<string, { label: string; total: number }> = {};

    for (const e of eleitores) {
      cidadeMap[e.cidade] = (cidadeMap[e.cidade] || 0) + 1;
      const key   = `${e.bairro || ""}||${e.cidade}`;
      const label = e.bairro ? `${e.bairro} · ${e.cidade}` : e.cidade;
      if (!terrMap[key]) terrMap[key] = { label, total: 0 };
      terrMap[key].total++;
      if (e.coordenadorId && e.coordenadorNome) {
        if (!coordMap[e.coordenadorId]) coordMap[e.coordenadorId] = { nome: e.coordenadorNome, total: 0, fortes: 0, indecisos: 0, fracos: 0 };
        coordMap[e.coordenadorId].total++;
        if (e.grauApoio === "forte")    coordMap[e.coordenadorId].fortes++;
        if (e.grauApoio === "indeciso") coordMap[e.coordenadorId].indecisos++;
        if (e.grauApoio === "fraco")    coordMap[e.coordenadorId].fracos++;
      }
    }

    const topCoordenadores = Object.values(coordMap).sort((a, b) => b.total - a.total);
    const topCidades = Object.entries(cidadeMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([cidade, total]) => ({ cidade, total }));
    const topTerrit  = Object.values(terrMap).sort((a, b) => b.total - a.total);

    return { total: eleitores.length, fortes, indecisos, fracos, medios, recentes, coordsAtivos: topCoordenadores.length, topCoordenadores, topCidades, topTerrit };
  }, [eleitores]);

  if (!userData || (!isSuperOrMaster(userData) && !isPolitico(userData) && !isPrefeito(userData) && !isVereador(userData) && !isAssessorExecutivo(userData) && !isAssessor(userData))) return null;
  const config = getRoleConfig(userData);

  // ── Export actions (non-assessor: unchanged) ──────────────────────────────

  async function exportExcelPremiumAction() {
    try {
      if (!auth.currentUser) { toast.error("Sessão ainda carregando. Tente novamente em alguns segundos."); return; }
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/exportar-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ titulo: userData?.gabineteNome || "Relatório", campanhaId: userData?.campanhaId || userData?.gabineteId }),
      });
      if (res.status === 503) { toast.error("Base de dados temporariamente indisponível. Tente em alguns minutos."); return; }
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Erro ao exportar"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "relatorio-eleitores.xlsx"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel premium exportado!");
    } catch { toast.error("Erro ao exportar"); }
  }

  function exportPDFPremiumAction() {
    try {
      exportPDFPremium(eleitores, userData?.gabineteNome || "Relatório");
      toast.success("PDF premium exportado!");
    } catch { toast.error("Erro ao exportar"); }
  }

  function exportJSON() {
    const json = JSON.stringify(eleitores, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `eleitores-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    toast.success("JSON exportado!");
  }

  // ── Export actions (assessor) ─────────────────────────────────────────────

  function exportRelatorioExecutivoAction() {
    try {
      exportRelatorioExecutivo(
        eleitores,
        userData?.gabineteNome || "Relatório",
        undefined,
        userData?.gabineteNome,
        undefined,
        "Assessor",
        `+${stats.recentes} (últimos 30 dias)`,
        stats.topCidades,
        stats.topCoordenadores.map((c) => ({ nome: c.nome, total: c.total })),
      );
      toast.success("Relatório Executivo exportado!");
    } catch { toast.error("Erro ao exportar"); }
  }

  function exportCoordenadoresAction() {
    try {
      const header = ["Coordenador", "Total", "Fortes", "Indecisos", "Fracos", "% Fortes"];
      const rows = stats.topCoordenadores.map((c) => [
        c.nome, c.total, c.fortes, c.indecisos, c.fracos,
        c.total > 0 ? `${Math.round((c.fortes / c.total) * 100)}%` : "—",
      ]);
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      ws["!cols"] = [{ wch: 26 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Coordenadores");
      XLSX.writeFile(wb, `producao-coordenadores-${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Produção dos coordenadores exportada!");
    } catch { toast.error("Erro ao exportar"); }
  }

  async function exportBaseAction() {
    try {
      if (!auth.currentUser) { toast.error("Sessão ainda carregando. Tente novamente em alguns segundos."); return; }
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/exportar-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ titulo: userData?.gabineteNome || "Relatório", gabineteNome: userData?.gabineteNome, tipo: "executivo", campanhaId: userData?.campanhaId || userData?.gabineteId }),
      });
      if (res.status === 503) { toast.error("Base de dados temporariamente indisponível. Tente em alguns minutos."); return; }
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Erro ao exportar"); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `relatorio-executivo-${new Date().toISOString().split("T")[0]}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Base Territorial exportada!");
    } catch { toast.error("Erro ao exportar"); }
  }

  function exportOportunidadesAction() {
    try {
      const lista = eleitores.filter((e) => e.grauApoio === "indeciso");
      if (lista.length === 0) { toast.error("Nenhum indeciso na base."); return; }
      exportPDFPremium(lista, `Oportunidades — ${userData?.gabineteNome || "Relatório"}`);
      toast.success("PDF de Oportunidades exportado!");
    } catch { toast.error("Erro ao exportar"); }
  }

  function exportAtencaoAction() {
    try {
      const lista = eleitores.filter((e) => e.grauApoio === "fraco");
      if (lista.length === 0) { toast.error("Nenhum registro de rejeição na base."); return; }
      exportPDFPremium(lista, `Áreas de Atenção — ${userData?.gabineteNome || "Relatório"}`);
      toast.success("PDF de Atenção exportado!");
    } catch { toast.error("Erro ao exportar"); }
  }

  // ── Dados para view não-assessor (preservados) ────────────────────────────
  const estadosMap  = eleitores.reduce<Record<string, number>>((acc, e) => { acc[e.estado] = (acc[e.estado] || 0) + 1; return acc; }, {});
  const estadosOrdenados = Object.entries(estadosMap).sort((a, b) => b[1] - a[1]);
  const cidadesTop  = stats.topCidades.slice(0, 8);
  const maxCidade   = cidadesTop[0]?.total || 1;

  // ── ASSESSOR / EXECUTIVO VIEW — Central de Relatórios ───────────────────
  if (isAssessor(userData) || isAssessorExecutivo(userData)) {
    return (
      <div className="space-y-6 animate-in">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-lg`}>📋</div>
          <div>
            <h1 className="text-2xl font-bold text-white">Central de Relatórios</h1>
            <p className="text-sm text-purple-400">Prepare reuniões · Consolide resultados · Exporte com propósito</p>
          </div>
        </div>

        {/* P1 — Resumo Executivo */}
        <GlassCard className="p-5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-4">Resumo Executivo</p>
          {loading ? (
            <div className="h-20 flex items-center justify-center text-white/30 text-sm">Carregando…</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {([
                { label: "Eleitores",      value: stats.total,       cor: "text-white",       border: "border-white/10",         bg: "bg-white/5"         },
                { label: "Fortes",         value: stats.fortes,      cor: "text-emerald-400", border: "border-emerald-500/20",   bg: "bg-emerald-500/10"  },
                { label: "Indecisos",      value: stats.indecisos,   cor: "text-blue-400",    border: "border-blue-500/20",      bg: "bg-blue-500/10"     },
                { label: "+30 dias",       value: `+${stats.recentes}`, cor: "text-violet-400", border: "border-violet-500/20", bg: "bg-violet-500/10"   },
                { label: "Coordenadores",  value: stats.coordsAtivos,cor: "text-amber-400",   border: "border-amber-500/20",    bg: "bg-amber-500/10"    },
              ] as const).map(({ label, value, cor, border, bg }) => (
                <div key={label} className={`p-4 rounded-xl border ${border} ${bg} text-center`}>
                  <p className={`text-2xl font-bold ${cor}`}>{value}</p>
                  <p className="text-xs text-white/40 mt-1">{label}</p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* P3 — Pré-visualização */}
        <GlassCard className="p-4 border-white/5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">O que será exportado</p>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <span className="text-white/50">Território: <span className="text-white/80">{userData?.gabineteNome || "Gabinete"}</span></span>
            <span className="text-white/50">Registros: <span className="text-white/80">{stats.total}</span></span>
            <span className="text-white/50">Período: <span className="text-white/80">Todos</span></span>
            <span className="text-white/50">Coordenadores: <span className="text-white/80">{stats.coordsAtivos}</span></span>
          </div>
        </GlassCard>

        {/* P2 — Central de Exportação */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Central de Exportação</p>
          <div className="space-y-3">
            <GlassCard className="p-4 flex items-center gap-4 hover:border-rose-500/20 transition-all cursor-pointer group" onClick={exportRelatorioExecutivoAction}>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0 group-hover:bg-rose-500/15 transition-colors">
                <FileText size={18} className="text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">Relatório Executivo</p>
                <p className="text-xs text-white/40 mt-0.5">Resumo territorial com capa — ideal para reunião com o deputado</p>
              </div>
              <span className="text-xs text-rose-400/60 shrink-0 font-medium">PDF</span>
            </GlassCard>

            <GlassCard className="p-4 flex items-center gap-4 hover:border-emerald-500/20 transition-all cursor-pointer group" onClick={exportCoordenadoresAction}>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/15 transition-colors">
                <BarChart2 size={18} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">Produção dos Coordenadores</p>
                <p className="text-xs text-white/40 mt-0.5">Desempenho por coordenador — para cobrança e planejamento de equipe</p>
              </div>
              <span className="text-xs text-emerald-400/60 shrink-0 font-medium">Excel</span>
            </GlassCard>

            <GlassCard className="p-4 flex items-center gap-4 hover:border-blue-500/20 transition-all cursor-pointer group" onClick={exportBaseAction}>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 group-hover:bg-blue-500/15 transition-colors">
                <FileSpreadsheet size={18} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">Base Territorial</p>
                <p className="text-xs text-white/40 mt-0.5">Excel completo — abas: Resumo · Eleitores · Coordenadores · Territórios</p>
              </div>
              <span className="text-xs text-blue-400/60 shrink-0 font-medium">Excel</span>
            </GlassCard>

            <GlassCard className="p-4 flex items-center gap-4 hover:border-blue-500/20 transition-all cursor-pointer group" onClick={exportOportunidadesAction}>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 group-hover:bg-blue-500/15 transition-colors">
                <Zap size={18} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">Oportunidades</p>
                <p className="text-xs text-white/40 mt-0.5">{stats.indecisos} indecisos — lista para abordagem focada</p>
              </div>
              <span className="text-xs text-blue-400/60 shrink-0 font-medium">PDF</span>
            </GlassCard>

            <GlassCard className="p-4 flex items-center gap-4 hover:border-red-500/20 transition-all cursor-pointer group" onClick={exportAtencaoAction}>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 group-hover:bg-red-500/15 transition-colors">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">Áreas de Atenção</p>
                <p className="text-xs text-white/40 mt-0.5">{stats.fracos} com rejeição registrada — para revisão estratégica</p>
              </div>
              <span className="text-xs text-red-400/60 shrink-0 font-medium">PDF</span>
            </GlassCard>
          </div>
        </div>
      </div>
    );
  }

  // ── CENTRAL DE RELATÓRIOS — Vista do Deputado ────────────────────────────
  if (isPolitico(userData)) {
    const totalBase  = eleitores.length;
    const fortesN    = eleitores.filter(e => e.grauApoio === "forte").length;
    const indecisosN = eleitores.filter(e => e.grauApoio === "indeciso").length;
    const pctForte   = totalBase > 0 ? Math.round((fortesN / totalBase) * 100) : 0;
    const cidadesUniq = [...new Set(eleitores.map(e => e.cidade).filter(Boolean))].sort() as string[];
    const assessorSel = assessores.find(a => a.uid === selectedAssessorId);

    return (
      <div className="space-y-6 animate-in">

        {/* Cabeçalho */}
        <div>
          <h1 className="text-2xl font-bold text-white">Central de Relatórios</h1>
          <p className="text-white/50 text-sm mt-1">Relatórios executivos e consolidados estratégicos do mandato</p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{totalBase.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-white/35 mt-0.5">Base total</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className={`text-2xl font-bold ${pctForte >= 40 ? "text-emerald-400" : pctForte >= 20 ? "text-amber-400" : "text-red-400"}`}>{pctForte}%</p>
            <p className="text-xs text-white/35 mt-0.5">Base forte</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{indecisosN}</p>
            <p className="text-xs text-white/35 mt-0.5">Conversíveis</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-bold text-violet-400">{cidadesUniq.length}</p>
            <p className="text-xs text-white/35 mt-0.5">Municípios</p>
          </GlassCard>
        </div>

        {/* Relatórios Disponíveis */}
        <div>
          <h2 className="text-white font-semibold mb-4">Relatórios Disponíveis</h2>
          <div className="space-y-4">

            {/* 📘 Executivo Premium */}
            <GlassCard className="p-5 hover:border-blue-500/20 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xl shrink-0">📘</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-white font-semibold">Relatório Executivo Premium</p>
                      <p className="text-xs text-white/35 mt-0.5">Panorama completo do mandato</p>
                    </div>
                    <span className="text-xs text-blue-400/60 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 shrink-0">PDF</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-4">
                    {["Panorama do mandato", "Força Territorial", "Municípios críticos", "Municípios em expansão", "Inteligência Política", "Agenda de acompanhamento"].map(item => (
                      <div key={item} className="flex items-center gap-1.5 text-xs text-white/40">
                        <span className="text-emerald-400 text-[10px]">✓</span> {item}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 pt-3 border-t border-white/[0.05]">
                    <button onClick={() => router.push("/relatorios")} className="text-xs text-white/35 hover:text-blue-400 transition-colors font-medium">Visualizar →</button>
                    <button onClick={exportPDFPremiumAction} className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">Exportar PDF →</button>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* 📗 Por Assessoria */}
            <GlassCard className="p-5 hover:border-emerald-500/20 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl shrink-0">📗</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="text-white font-semibold">Relatório por Assessoria</p>
                      <p className="text-xs text-white/35 mt-0.5">Desempenho e diagnóstico por assessor</p>
                    </div>
                    <span className="text-xs text-emerald-400/60 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">PDF</span>
                  </div>
                  <select
                    value={selectedAssessorId}
                    onChange={e => setSelectedAssessorId(e.target.value)}
                    className="w-full text-sm bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-zinc-600 mb-3"
                    style={{ colorScheme: "dark" }}
                  >
                    <option value="" className="bg-zinc-950 text-zinc-400">Selecionar assessor…</option>
                    {assessores.map(a => <option key={a.uid} value={a.uid} className="bg-zinc-950 text-white">{a.nome}</option>)}
                  </select>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3">
                    {["Territórios", "Coordenadores", "Eleitores", "Base Forte", "Metas", "Diagnóstico"].map(item => (
                      <div key={item} className="flex items-center gap-1.5 text-xs text-white/40">
                        <span className="text-emerald-400 text-[10px]">✓</span> {item}
                      </div>
                    ))}
                  </div>
                  {assessorSel && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3">
                      <span className="text-white/40">Assessor: <span className="text-white/65">{assessorSel.nome}</span></span>
                      {(assessorSel.cidades ?? []).length > 0 && (
                        <span className="text-white/40">Territórios: <span className="text-white/65">{(assessorSel.cidades ?? []).join(" · ")}</span></span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-4 pt-3 border-t border-white/[0.05]">
                    <button onClick={() => router.push("/assessores")} className="text-xs text-white/35 hover:text-emerald-400 transition-colors font-medium">Visualizar →</button>
                    <button
                      onClick={() => {
                        const titulo = assessorSel
                          ? `Assessoria · ${assessorSel.nome} · ${(assessorSel.cidades ?? []).join(", ") || "Territórios"}`
                          : "Relatório de Assessorias";
                        try { exportPDFPremium(eleitores, titulo); toast.success("Relatório exportado!"); }
                        catch { toast.error("Erro ao exportar"); }
                      }}
                      className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
                    >
                      Exportar PDF →
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* 📙 Territorial */}
            <GlassCard className="p-5 hover:border-amber-500/20 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl shrink-0">📙</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="text-white font-semibold">Relatório Territorial</p>
                      <p className="text-xs text-white/35 mt-0.5">Análise por município</p>
                    </div>
                    <span className="text-xs text-amber-400/60 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0">PDF</span>
                  </div>
                  <select
                    value={selectedCidade}
                    onChange={e => setSelectedCidade(e.target.value)}
                    className="w-full text-sm bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-zinc-600 mb-3"
                    style={{ colorScheme: "dark" }}
                  >
                    <option value="" className="bg-zinc-950 text-zinc-400">Selecionar município…</option>
                    {cidadesUniq.map(c => <option key={c} value={c} className="bg-zinc-950 text-white">{c}</option>)}
                  </select>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3">
                    {["Eleitores", "Forte / Médio / Fraco", "Tendência", "Crescimento", "Assessor responsável", "Situação"].map(item => (
                      <div key={item} className="flex items-center gap-1.5 text-xs text-white/40">
                        <span className="text-emerald-400 text-[10px]">✓</span> {item}
                      </div>
                    ))}
                  </div>
                  {selectedCidade && (() => {
                    const el = eleitores.filter(e => e.cidade === selectedCidade);
                    const f  = el.filter(e => e.grauApoio === "forte").length;
                    const pct = el.length > 0 ? Math.round((f / el.length) * 100) : 0;
                    return (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3">
                        <span className="text-white/40">{selectedCidade}: <span className="text-white/65">{el.length} eleitores</span></span>
                        <span className="text-white/40">Base forte: <span className={pct >= 40 ? "text-emerald-400" : "text-amber-400"}>{pct}%</span></span>
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-4 pt-3 border-t border-white/[0.05]">
                    <button onClick={() => router.push("/relatorios")} className="text-xs text-white/35 hover:text-amber-400 transition-colors font-medium">Visualizar →</button>
                    <button
                      onClick={() => {
                        const lista  = selectedCidade ? eleitores.filter(e => e.cidade === selectedCidade) : eleitores;
                        const titulo = selectedCidade ? `Relatório Territorial · ${selectedCidade}` : "Relatório Territorial";
                        if (lista.length === 0) { toast.error("Nenhum eleitor neste município."); return; }
                        try { exportPDFPremium(lista, titulo); toast.success("Relatório exportado!"); }
                        catch { toast.error("Erro ao exportar"); }
                      }}
                      className="text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium"
                    >
                      Exportar PDF →
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* 📕 Metas */}
            <GlassCard className="p-5 hover:border-red-500/20 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-xl shrink-0">📕</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-white font-semibold">Relatório de Metas</p>
                      <p className="text-xs text-white/35 mt-0.5">Cumprimento e pendências estratégicas</p>
                    </div>
                    <span className="text-xs text-red-400/60 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 shrink-0">PDF</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-4">
                    {["Meta global", "Meta por assessor", "Meta por município", "Cumprimento", "Pendências", "Agenda"].map(item => (
                      <div key={item} className="flex items-center gap-1.5 text-xs text-white/40">
                        <span className="text-emerald-400 text-[10px]">✓</span> {item}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 pt-3 border-t border-white/[0.05]">
                    <button onClick={() => router.push("/metas")} className="text-xs text-white/35 hover:text-red-400 transition-colors font-medium">Visualizar →</button>
                    <button
                      onClick={() => {
                        try { exportPDFPremium(eleitores, `Metas Estratégicas · ${userData?.gabineteNome || "Mandato"}`); toast.success("Relatório exportado!"); }
                        catch { toast.error("Erro ao exportar"); }
                      }}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
                    >
                      Exportar PDF →
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* 📊 Excel Executivo */}
            <GlassCard className="p-5 hover:border-emerald-500/20 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl shrink-0">📊</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-white font-semibold">Excel Executivo Premium</p>
                      <p className="text-xs text-white/35 mt-0.5">Planilha analítica multi-abas</p>
                    </div>
                    <span className="text-xs text-emerald-400/60 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">Excel</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-4">
                    {["Resumo Geral", "Municípios", "Assessorias", "Metas", "Inteligência Política", "Agenda"].map(item => (
                      <div key={item} className="flex items-center gap-1.5 text-xs text-white/40">
                        <span className="text-emerald-400 text-[10px]">✓</span> {item}
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 border-t border-white/[0.05]">
                    <button onClick={exportExcelPremiumAction} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
                      Exportar Excel →
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* ⭐ Dossiê Político Premium */}
        <GlassCard className="p-5 border-violet-500/25">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-xl shrink-0">⭐</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-white font-bold">Dossiê Político Premium</p>
                  <p className="text-xs text-violet-400/60 mt-0.5">Documento executivo completo do mandato · 8 seções</p>
                </div>
                <span className="text-xs text-violet-400/60 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20 shrink-0">PDF Premium</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-4">
                {["Capa do mandato","Panorama Executivo","Força Territorial","Municípios Críticos","Oportunidades","Metas Estratégicas","Ranking Assessorias","Recomendações"].map((item, i) => (
                  <div key={item} className="flex items-center gap-1.5 text-xs text-white/50">
                    <span className="text-violet-400/60 font-bold">{i+1}.</span> {item}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 pt-3 border-t border-violet-500/10">
                <button onClick={() => setModalDossie(true)} className="text-xs text-white/35 hover:text-violet-400 transition-colors font-medium">Visualizar →</button>
                <button onClick={exportPDFPremiumAction} className="text-xs text-violet-400 hover:text-violet-300 transition-colors font-medium">Gerar PDF Premium →</button>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Modal Dossiê */}
        {modalDossie && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModalDossie(false)}>
            <div className="w-full max-w-lg bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <p className="text-xs text-violet-400/60 uppercase tracking-wider mb-1">Dossiê Político Premium</p>
                    <h3 className="text-xl font-bold text-white">{userData?.gabineteNome || "Mandato 2026"}</h3>
                    <p className="text-xs text-white/30 mt-0.5">Ano Eleitoral 2026 · Eleitores 2026</p>
                  </div>
                  <button onClick={() => setModalDossie(false)} className="text-white/30 hover:text-white/60 transition-colors mt-0.5 shrink-0">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-2.5 mb-5">
                  {[
                    { n: "1", title: "Panorama Executivo",       detail: `${totalBase.toLocaleString("pt-BR")} apoiadores · ${cidadesUniq.length} municípios` },
                    { n: "2", title: "Força Territorial",        detail: `${pctForte}% base forte · ${assessores.length} assessorias` },
                    { n: "3", title: "Municípios Críticos",      detail: "Territórios com base fraca ou sem cobertura" },
                    { n: "4", title: "Oportunidades Eleitorais", detail: `${indecisosN} indecisos identificados` },
                    { n: "5", title: "Metas Estratégicas",       detail: "Cumprimento por assessoria e município" },
                    { n: "6", title: "Ranking das Assessorias",  detail: `${assessores.length} assessorias avaliadas` },
                    { n: "7", title: "Agenda de Acompanhamento", detail: "Prioridades e prazos por assessoria" },
                    { n: "8", title: "Recomendações Estratégicas", detail: "Ações priorizadas por urgência" },
                  ].map(sec => (
                    <div key={sec.n} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                      <span className="w-6 h-6 rounded-lg bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{sec.n}</span>
                      <div>
                        <p className="text-white/80 font-medium text-sm">{sec.title}</p>
                        <p className="text-xs text-white/35 mt-0.5">{sec.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-white/[0.06]">
                  <p className="text-[10px] text-white/20 text-center mb-3">Gerado automaticamente pelo Eleitores 2026</p>
                  <button
                    onClick={() => { setModalDossie(false); exportPDFPremiumAction(); }}
                    className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 transition-colors text-white text-sm font-medium"
                  >
                    Gerar PDF Premium
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ── VIEW ORIGINAL (super_admin / prefeito / vereador) ────────────────────
  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-lg`}>👑</div>
        <div>
          <h1 className="text-2xl font-bold text-white">Exportações</h1>
          <p className="text-sm text-purple-400">Exporte dados da plataforma</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-6 text-center hover:border-purple-500/30 transition-all cursor-pointer" onClick={exportExcelPremiumAction}>
          <FileSpreadsheet size={32} className="mx-auto mb-3 text-emerald-400" />
          <h3 className="text-white font-semibold">Excel Premium</h3>
          <p className="text-xs text-white/40 mt-1">Planilha com identidade do partido</p>
        </GlassCard>
        <GlassCard className="p-6 text-center hover:border-purple-500/30 transition-all cursor-pointer" onClick={exportPDFPremiumAction}>
          <FileText size={32} className="mx-auto mb-3 text-rose-400" />
          <h3 className="text-white font-semibold">PDF Premium</h3>
          <p className="text-xs text-white/40 mt-1">Relatório executivo com capa</p>
        </GlassCard>
        <GlassCard className="p-6 text-center hover:border-purple-500/30 transition-all cursor-pointer" onClick={exportJSON}>
          <Upload size={40} className="mx-auto mb-3 text-purple-400" />
          <h3 className="text-white font-semibold">JSON</h3>
          <p className="text-xs text-white/40 mt-1">Dados .json</p>
        </GlassCard>
      </div>

      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Resumo dos Dados</h3>
          <span className="text-sm text-white/40">{eleitores.length} registros</span>
        </div>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 border-b border-white/[0.06]">
                <th className="text-left py-2 px-2 font-medium">Nome</th>
                <th className="text-left py-2 px-2 font-medium">Cidade</th>
                <th className="text-left py-2 px-2 font-medium">Estado</th>
                <th className="text-left py-2 px-2 font-medium">Grau</th>
                <th className="text-left py-2 px-2 font-medium">Colaborador</th>
              </tr>
            </thead>
            <tbody>
              {eleitores.slice(0, 20).map((e) => (
                <tr key={e.id} className="border-b border-white/[0.03]">
                  <td className="py-2 px-2 text-white/70">{e.nomeCompleto}</td>
                  <td className="py-2 px-2 text-white/50">{e.cidade}</td>
                  <td className="py-2 px-2 text-white/50">{e.estado}</td>
                  <td className="py-2 px-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.grauApoio === "forte" ? "bg-emerald-500/20 text-emerald-400" : e.grauApoio === "medio" ? "bg-amber-500/20 text-amber-400" : e.grauApoio === "fraco" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>{e.grauApoio}</span>
                  </td>
                  <td className="py-2 px-2 text-white/50">{e.colaboradorNome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

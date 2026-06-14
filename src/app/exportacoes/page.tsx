"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Eleitor } from "@/types";
import { getRoleConfig, isSuperOrMaster, isPolitico, isPrefeito, isVereador, isAssessor } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatDate, parseDate } from "@/lib/utils";
import { FileSpreadsheet, FileText, Upload, BarChart2, Zap, AlertTriangle } from "lucide-react";
import { exportPDFPremium, exportRelatorioExecutivo } from "@/lib/reports";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

export default function ExportacoesPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userData && !isSuperOrMaster(userData) && !isPolitico(userData) && !isPrefeito(userData) && !isVereador(userData) && !isAssessor(userData)) {
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

  if (!userData || (!isSuperOrMaster(userData) && !isPolitico(userData) && !isPrefeito(userData) && !isVereador(userData) && !isAssessor(userData))) return null;
  const config = getRoleConfig(userData);

  // ── Export actions (non-assessor: unchanged) ──────────────────────────────

  async function exportExcelPremiumAction() {
    try {
      const res = await fetch("/api/exportar-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eleitores, titulo: userData?.gabineteNome || "Relatório" }),
      });
      if (!res.ok) throw new Error();
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
      const res = await fetch("/api/exportar-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eleitores, titulo: userData?.gabineteNome || "Relatório", gabineteNome: userData?.gabineteNome, tipo: "executivo" }),
      });
      if (!res.ok) throw new Error();
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

  // ── ASSESSOR VIEW — Central de Relatórios ────────────────────────────────
  if (isAssessor(userData)) {
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

  // ── VIEW ORIGINAL (super_admin / politico / prefeito / vereador) ──────────
  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-lg`}>👑</div>
        <div>
          <h1 className="text-2xl font-bold text-white">Exportações</h1>
          <p className="text-sm text-purple-400">{isPolitico(userData) ? "Consolidados territoriais da sua base" : "Exporte dados da plataforma"}</p>
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
        {!isPolitico(userData) && (
          <GlassCard className="p-6 text-center hover:border-purple-500/30 transition-all cursor-pointer" onClick={exportJSON}>
            <Upload size={40} className="mx-auto mb-3 text-purple-400" />
            <h3 className="text-white font-semibold">JSON</h3>
            <p className="text-xs text-white/40 mt-1">Dados .json</p>
          </GlassCard>
        )}
      </div>

      {isPolitico(userData) ? (
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-white font-semibold">Consolidado Territorial</h3>
            <span className="text-xs text-white/30">{eleitores.length} apoiadores registrados</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Forte",    value: stats.fortes,    cor: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/10" },
              { label: "Médio",    value: stats.medios,    cor: "text-amber-400",   border: "border-amber-500/20",   bg: "bg-amber-500/10"   },
              { label: "Indeciso", value: stats.indecisos, cor: "text-blue-400",    border: "border-blue-500/20",    bg: "bg-blue-500/10"    },
              { label: "Fraco",    value: stats.fracos,    cor: "text-red-400",     border: "border-red-500/20",     bg: "bg-red-500/10"     },
            ].map(({ label, value, cor, border, bg }) => (
              <div key={label} className={`p-3 rounded-xl border ${border} ${bg} text-center`}>
                <p className={`text-xl font-bold ${cor}`}>{value}</p>
                <p className="text-xs text-white/40 mt-0.5">{label}</p>
                {eleitores.length > 0 && (
                  <p className={`text-[10px] mt-0.5 ${cor}`}>{Math.round((value / eleitores.length) * 100)}%</p>
                )}
              </div>
            ))}
          </div>
          {cidadesTop.length > 0 && (
            <div className="mb-5">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Distribuição por cidade</p>
              <div className="space-y-2.5">
                {cidadesTop.map(({ cidade, total }) => (
                  <div key={cidade} className="flex items-center gap-3">
                    <span className="text-sm text-white/70 w-32 shrink-0 truncate">{cidade}</span>
                    <div className="flex-1 bg-white/[0.04] rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${Math.round((total / maxCidade) * 100)}%` }} />
                    </div>
                    <span className="text-sm text-white/50 w-8 text-right shrink-0">{total}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {estadosOrdenados.length > 0 && (
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Por estado</p>
              <div className="flex flex-wrap gap-2">
                {estadosOrdenados.map(([estado, total]) => (
                  <div key={estado} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                    <span className="text-sm font-medium text-white">{estado}</span>
                    <span className="text-xs text-white/40">{total}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      ) : (
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
      )}
    </div>
  );
}

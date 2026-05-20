"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { Eleitor } from "@/types";
import { estados } from "@/lib/estados-cidades";
import { GlassCard } from "@/components/ui/GlassCard";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { formatDate, parseDate } from "@/lib/utils";
import { FileSpreadsheet, FileText, Filter, Search, TrendingUp, MapPin, Zap } from "lucide-react";
import { isPolitico } from "@/lib/permissions";
import { exportExcelPremium, exportPDFPremium } from "@/lib/reports";
import toast from "react-hot-toast";

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
  const [filtros, setFiltros] = useState({ estado: "", cidade: "", bairro: "", grauApoio: "", dataInicio: "", dataFim: "", search: "" });

  useEffect(() => {
    async function load() {
      try {
        const constraints: any[] = [orderBy("criadoEm", "desc")];
        const gabId = userData?.campanhaId || userData?.gabineteId;
        if (gabId) constraints.unshift(where("campanhaId", "==", gabId));
        const q = query(collection(db, "eleitores"), ...constraints);
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor));
        setEleitores(data);
        setFiltered(data);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    load();
  }, []);

  useEffect(() => {
    let result = [...eleitores];
    if (filtros.estado) result = result.filter((e) => e.estado === filtros.estado);
    if (filtros.cidade) result = result.filter((e) => e.cidade.toLowerCase().includes(filtros.cidade.toLowerCase()));
    if (filtros.bairro) result = result.filter((e) => e.bairro.toLowerCase().includes(filtros.bairro.toLowerCase()));
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

  if (loading) return <div className="flex justify-center py-20"><svg className="animate-spin h-8 w-8 text-emerald-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;

  // Deputado federal: visão executiva de inteligência territorial — sem lista individual
  if (userData && isPolitico(userData)) {
    const agora = Date.now();
    const totalBase = eleitores.length;
    const fortes    = eleitores.filter((e) => e.grauApoio === "forte").length;
    const fracos    = eleitores.filter((e) => e.grauApoio === "fraco").length;
    const indecisos = eleitores.filter((e) => e.grauApoio === "indeciso").length;
    const ultimos30    = eleitores.filter((e) => parseDate(e.criadoEm).getTime() > agora - 30 * 86400000).length;
    const anteriores30 = eleitores.filter((e) => { const t = parseDate(e.criadoEm).getTime(); return t > agora - 60 * 86400000 && t <= agora - 30 * 86400000; }).length;
    const crescimento30d = anteriores30 > 0 ? Math.round(((ultimos30 - anteriores30) / anteriores30) * 100) : ultimos30 > 0 ? 100 : 0;

    const cidadeStats = Object.entries(
      eleitores.reduce<Record<string, { total: number; fortes: number; fracos: number; indecisos: number; recentes: number; prev30: number }>>((acc, e) => {
        if (!acc[e.cidade]) acc[e.cidade] = { total: 0, fortes: 0, fracos: 0, indecisos: 0, recentes: 0, prev30: 0 };
        acc[e.cidade].total++;
        if (e.grauApoio === "forte")    acc[e.cidade].fortes++;
        if (e.grauApoio === "fraco")    acc[e.cidade].fracos++;
        if (e.grauApoio === "indeciso") acc[e.cidade].indecisos++;
        const t = parseDate(e.criadoEm).getTime();
        if (t > agora - 30 * 86400000)                              acc[e.cidade].recentes++;
        else if (t > agora - 60 * 86400000)                         acc[e.cidade].prev30++;
        return acc;
      }, {})
    ).map(([cidade, s]) => ({
      cidade, ...s,
      forca:     s.total > 0 ? Math.round((s.fortes / s.total) * 100) : 0,
      rejeicao:  s.total > 0 ? Math.round(((s.fracos + s.indecisos) / s.total) * 100) : 0,
      tendencia: s.prev30 > 0 ? Math.round(((s.recentes - s.prev30) / s.prev30) * 100) : s.recentes > 0 ? 100 : 0,
    })).sort((a, b) => b.total - a.total);

    const estagnadas  = cidadeStats.filter((c) => c.recentes === 0 && c.total > 5);
    const criticas    = cidadeStats.filter((c) => c.rejeicao > 60);
    const oportunidades = cidadeStats.filter((c) => c.indecisos > 0 && c.indecisos / c.total > 0.2);

    return (
      <div className="space-y-6 animate-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Inteligência Política</h1>
            <p className="text-white/50 text-sm mt-1">
              Comportamento agregado da base · {cidadeStats.length} {cidadeStats.length === 1 ? "território mapeado" : "territórios mapeados"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportExcelPremiumAction}><FileSpreadsheet size={16} /> Excel</Button>
            <Button variant="secondary" onClick={exportPDFPremiumAction}><FileText size={16} /> PDF</Button>
          </div>
        </div>

        {/* KPIs macro */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <GlassCard className="p-4 text-center">
            <p className="text-3xl font-bold text-white">{totalBase.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-white/40 mt-1">Base total</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className={`text-3xl font-bold ${totalBase > 0 && fortes / totalBase > 0.4 ? "text-emerald-400" : "text-amber-400"}`}>
              {totalBase > 0 ? Math.round((fortes / totalBase) * 100) : 0}%
            </p>
            <p className="text-xs text-white/40 mt-1">Base forte</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-400">{indecisos}</p>
            <p className="text-xs text-white/40 mt-1">Potencial de conversão</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className={`text-3xl font-bold ${crescimento30d >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {crescimento30d > 0 ? "+" : ""}{crescimento30d}%
            </p>
            <p className="text-xs text-white/40 mt-1">Crescimento 30 dias</p>
          </GlassCard>
        </div>

        {/* Alertas estratégicos */}
        {(estagnadas.length > 0 || criticas.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {estagnadas.length > 0 && (
              <GlassCard className="p-4 border-amber-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">❄️</span>
                  <h3 className="text-amber-400 font-semibold text-sm">Regiões Estagnadas</h3>
                  <span className="ml-auto text-xs text-amber-400/60">{estagnadas.length}</span>
                </div>
                <div className="space-y-1.5">
                  {estagnadas.slice(0, 5).map((c) => (
                    <div key={c.cidade} className="flex justify-between items-center gap-2">
                      <span className="text-sm text-white/70 truncate">{c.cidade}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-white/40">{c.total} • sem novos</span>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`Acionar ${c.cidade}: ${c.total} apoiadores cadastrados, sem novos há 30 dias. Reativar equipe local.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-base text-green-400/40 hover:text-green-400 transition-colors leading-none"
                          title="Acionar via WhatsApp"
                        >📲</a>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
            {criticas.length > 0 && (
              <GlassCard className="p-4 border-red-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🔴</span>
                  <h3 className="text-red-400 font-semibold text-sm">Áreas Críticas</h3>
                  <span className="ml-auto text-xs text-red-400/60">{criticas.length}</span>
                </div>
                <div className="space-y-1.5">
                  {criticas.slice(0, 5).map((c) => (
                    <div key={c.cidade} className="flex justify-between items-center gap-2">
                      <span className="text-sm text-white/70 truncate">{c.cidade}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-red-400">{c.rejeicao}% rejeição</span>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`Área crítica: ${c.cidade} com ${c.rejeicao}% de rejeição. Avaliar estratégia de recuperação territorial.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-base text-green-400/40 hover:text-green-400 transition-colors leading-none"
                          title="Acionar via WhatsApp"
                        >📲</a>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
            {oportunidades.length > 0 && (
              <GlassCard className="p-4 border-blue-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={14} className="text-blue-400" />
                  <h3 className="text-blue-400 font-semibold text-sm">Oportunidades Eleitorais</h3>
                  <span className="ml-auto text-xs text-blue-400/60">{oportunidades.length}</span>
                </div>
                <div className="space-y-1.5">
                  {oportunidades.slice(0, 5).map((c) => (
                    <div key={c.cidade} className="flex justify-between items-center gap-2">
                      <span className="text-sm text-white/70 truncate">{c.cidade}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-blue-400">{c.indecisos} indecisos</span>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`Oportunidade em ${c.cidade}: ${c.indecisos} indecisos a converter. Reforçar presença local.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-base text-green-400/40 hover:text-green-400 transition-colors leading-none"
                          title="Acionar via WhatsApp"
                        >📲</a>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </div>
        )}

        {/* Ranking territorial completo */}
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
                    <th className="py-3 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {cidadeStats.map((c) => {
                    const waMsg = c.recentes === 0 && c.total > 5
                      ? `Território estagnado: ${c.cidade} — ${c.total} apoiadores sem novos cadastros há 30 dias. Reativar equipe local.`
                      : c.rejeicao > 60
                        ? `Área crítica: ${c.cidade} — ${c.rejeicao}% de rejeição. Avaliar estratégia de recuperação territorial.`
                        : c.total > 0 && c.indecisos / c.total > 0.2
                          ? `Oportunidade em ${c.cidade}: ${c.indecisos} indecisos a converter. Reforçar presença local.`
                          : `Briefing ${c.cidade}: ${c.total} apoiadores · ${c.forca}% força política${c.recentes > 0 ? ` · +${c.recentes} cadastros em 30 dias` : ""}.`;
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
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(waMsg)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-base text-green-400/30 hover:text-green-400 transition-colors leading-none"
                          title="Acionar via WhatsApp"
                        >📲</a>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Relatórios</h1><p className="text-white/50 text-sm mt-1">Filtre e exporte seus dados</p></div>
        <div className="flex items-center gap-2"><Button variant="secondary" onClick={exportExcelPremiumAction}><FileSpreadsheet size={16} /> Excel Premium</Button><Button variant="secondary" onClick={exportPDFPremiumAction}><FileText size={16} /> PDF Premium</Button></div>
      </div>
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><Filter size={18} className="text-emerald-400" /><h3 className="text-white font-semibold">Filtros</h3></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })} options={estadoOptions} label="Estado" />
          <div><label className="block text-sm font-medium text-white/70 mb-1.5">Cidade</label><input type="text" value={filtros.cidade} onChange={(e) => setFiltros({ ...filtros, cidade: e.target.value })} placeholder="Filtrar cidade..." className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1.5">Bairro</label><input type="text" value={filtros.bairro} onChange={(e) => setFiltros({ ...filtros, bairro: e.target.value })} placeholder="Filtrar bairro..." className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" /></div>
          <Select value={filtros.grauApoio} onChange={(e) => setFiltros({ ...filtros, grauApoio: e.target.value })} options={grauOptions} label="Grau de Apoio" />
          <div><label className="block text-sm font-medium text-white/70 mb-1.5">Data Início</label><input type="date" value={filtros.dataInicio} onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1.5">Data Fim</label><input type="date" value={filtros.dataFim} onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1.5">Busca</label><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" /><input type="text" value={filtros.search} onChange={(e) => setFiltros({ ...filtros, search: e.target.value })} placeholder="Nome do eleitor..." className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" /></div></div>
        </div>
        <div className="mt-4 text-sm text-white/40">{filtered.length} de {eleitores.length} registros encontrados</div>
      </GlassCard>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-white/40 border-b border-white/[0.06]"><th className="text-left py-3 px-2 font-medium">Nome</th><th className="text-left py-3 px-2 font-medium">Telefone</th><th className="text-left py-3 px-2 font-medium">Documento</th><th className="text-left py-3 px-2 font-medium">Estado</th><th className="text-left py-3 px-2 font-medium">Cidade</th><th className="text-left py-3 px-2 font-medium">Bairro</th><th className="text-left py-3 px-2 font-medium">Grau</th><th className="text-left py-3 px-2 font-medium">Colaborador</th><th className="text-left py-3 px-2 font-medium">Data</th></tr></thead>
          <tbody>{filtered.map((e) => (
            <tr key={e.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
              <td className="py-3 px-2 text-white/80">{e.nomeCompleto}</td><td className="py-3 px-2 text-white/60">{e.telefone || "-"}</td><td className="py-3 px-2 text-white/60 font-mono text-xs">{e.tipoDocumento?.toUpperCase()}: {e.documento}</td>
              <td className="py-3 px-2 text-white/60">{e.estado}</td><td className="py-3 px-2 text-white/60">{e.cidade}</td><td className="py-3 px-2 text-white/60">{e.bairro || "-"}</td>
              <td className="py-3 px-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.grauApoio === "forte" ? "bg-emerald-500/20 text-emerald-400" : e.grauApoio === "medio" ? "bg-amber-500/20 text-amber-400" : e.grauApoio === "fraco" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>{e.grauApoio}</span></td>
              <td className="py-3 px-2 text-white/60">{e.colaboradorNome}</td><td className="py-3 px-2 text-white/40 text-xs">{formatDate(e.criadoEm)}</td>
            </tr>
          ))}{filtered.length === 0 && <tr><td colSpan={9} className="py-12 text-center text-white/30">Nenhum registro encontrado</td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}
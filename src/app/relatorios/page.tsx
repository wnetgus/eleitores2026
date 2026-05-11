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
import { FileSpreadsheet, FileText, Download, Filter, Search } from "lucide-react";
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
        if (userData?.campanhaId) constraints.unshift(where("campanhaId", "==", userData.campanhaId));
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
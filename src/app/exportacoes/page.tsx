"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Eleitor, ROLE_CONFIG } from "@/types";
import { where } from "firebase/firestore";
import { getRoleConfig, isSuperOrMaster, isPolitico, isPrefeito, isVereador, isAssessor } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import { FileSpreadsheet, FileText, Download, Upload } from "lucide-react";
import { exportExcelPremium, exportPDFPremium } from "@/lib/reports";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import toast from "react-hot-toast";

export default function ExportacoesPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userData && !isSuperOrMaster(userData) && !isPolitico(userData) && !isPrefeito(userData) && !isVereador(userData) && !isAssessor(userData)) { router.push("/dashboard"); return; }
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

  if (!userData || (!isSuperOrMaster(userData) && !isPolitico(userData) && !isPrefeito(userData) && !isVereador(userData) && !isAssessor(userData))) return null;
  const config = getRoleConfig(userData);

  const data = eleitores.map((e) => ({
    Nome: e.nomeCompleto, Telefone: e.telefone || "-",
    Documento: `${e.tipoDocumento?.toUpperCase()}: ${e.documento}`,
    CEP: e.cep || "-", Logradouro: e.logradouro || "-",
    "Nº": e.numero || "-", Complemento: e.complemento || "-",
    Estado: e.estado, Cidade: e.cidade, Bairro: e.bairro, "Grau de Apoio": e.grauApoio,
    Colaborador: e.colaboradorNome, Coordenador: e.coordenadorNome || "-", "Data Cadastro": formatDate(e.criadoEm),
  }));

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
      a.href = url;
      a.download = "relatorio-eleitores.xlsx";
      a.click();
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
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `eleitores-${new Date().toISOString().split("T")[0]}.json`; link.click();
    toast.success("JSON exportado!");
  }

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

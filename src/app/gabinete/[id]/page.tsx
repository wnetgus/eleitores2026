"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy, where, limit, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Gabinete, Eleitor, AppUser, Atividade, Candidato } from "@/types";
import { isSuperOrMaster, isPolitico, isAssessor, isAssessorExecutivo, getRoleConfig } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { formatDate, parseDate } from "@/lib/utils";
import { Building2, Users, Target, Zap, Globe, Activity, FileSpreadsheet, Download, FileText, BarChart3, TrendingUp, ArrowLeft, ExternalLink, Loader2, Plus, Link2, Unlink, ChevronDown, ChevronRight, Mail, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { exportExcelPremium, exportPDFPremium } from "@/lib/reports";
import { buscarGabinetesFilhos, buscarEleitoresPorGabinetes, getGabinetes, registrarAtividade } from "@/lib/firestore";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

export default function PainelGabinetePage() {
  const { userData } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [gabinete, setGabinete] = useState<Gabinete | null>(null);
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [gabinetesFilhos, setGabinetesFilhos] = useState<Gabinete[]>([]);
  const [eleitoresFilhos, setEleitoresFilhos] = useState<Eleitor[]>([]);
  const [todosGabinetes, setTodosGabinetes] = useState<Gabinete[]>([]);
  const [showVincular, setShowVincular] = useState(false);
  const [vincularId, setVincularId] = useState("");
  const [vincularSaving, setVincularSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [equipeExpanded, setEquipeExpanded] = useState<Record<string, boolean>>({});
  const [confirmDesvincular, setConfirmDesvincular] = useState<{ id: string; nome: string } | null>(null);

  function toggleEquipe(key: string) {
    setEquipeExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  useEffect(() => {
    if (!userData) return;
    const podeAcessar = isSuperOrMaster(userData) || isPolitico(userData) || isAssessorExecutivo(userData) || isAssessor(userData);
    if (!podeAcessar) { router.push("/dashboard"); return; }
    if (id) loadAll();
  }, [userData, id]);

  async function loadAll() {
    setLoading(true);
    try {
      const isAdmin = isSuperOrMaster(userData);
      const aQuery = isAdmin
        ? query(collection(db, "atividades"), orderBy("criadoEm", "desc"), limit(50))
        : query(collection(db, "atividades"), where("gabineteId", "==", id), orderBy("criadoEm", "desc"), limit(50));

      const [gResult, eResult, aResult, cResult] = await Promise.allSettled([
        getDoc(doc(db, "campanhas", id)),
        getDocs(query(collection(db, "eleitores"), where("campanhaId", "==", id), orderBy("criadoEm", "desc"))),
        getDocs(aQuery),
        getDocs(query(collection(db, "candidatos"), where("gabineteId", "==", id))),
      ]);

      if (gResult.status === "rejected") {
        console.error("Permissão negada ao ler gabinete:", gResult.reason?.code || gResult.reason);
        return;
      }
      const gSnap = gResult.value;
      if (!gSnap.exists()) return;

      setGabinete({ id: gSnap.id, ...gSnap.data() } as Gabinete);

      if (eResult.status === "fulfilled")
        setEleitores(eResult.value.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor)));
      if (aResult.status === "fulfilled")
        setAtividades(aResult.value.docs.map((d) => ({ id: d.id, ...d.data() } as Atividade)));
      if (cResult.status === "fulfilled")
        setCandidatos(cResult.value.docs.map((d) => ({ id: d.id, ...d.data() } as Candidato)));

      let allUsuarios: AppUser[] = [];
      try {
        if (isAdmin) {
          const uSnap = await getDocs(query(collection(db, "usuarios"), orderBy("criadoEm", "desc")));
          allUsuarios = uSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser));
        } else {
          const [uSnap1, uSnap2] = await Promise.allSettled([
            getDocs(query(collection(db, "usuarios"), where("campanhaId", "==", id), orderBy("criadoEm", "desc"))),
            getDocs(query(collection(db, "usuarios"), where("gabineteId", "==", id), orderBy("criadoEm", "desc"))),
          ]);
          const uMap = new Map<string, AppUser>();
          [uSnap1, uSnap2].forEach((r) => {
            if (r.status === "fulfilled")
              r.value.docs.forEach((d) => uMap.set(d.id, { uid: d.id, ...d.data() } as AppUser));
          });
          allUsuarios = [...uMap.values()];
        }
      } catch (e) { console.error("Erro ao carregar usuários:", e); }
      setUsuarios(allUsuarios);

      const gData = gSnap.data() as Gabinete;
      if (isAdmin && gData?.parentGabineteId) {
        try {
          const parentSnap = await getDoc(doc(db, "campanhas", gData.parentGabineteId));
          if (parentSnap.exists()) gData.parentGabineteNome = parentSnap.data().nome;
        } catch {}
      }

      try {
        const filhos = await buscarGabinetesFilhos(id);
        setGabinetesFilhos(filhos);
        if (isAdmin && filhos.length > 0) {
          const filhoIds = filhos.map((f) => f.id!).filter(Boolean);
          const eleitoresFilhosData = await buscarEleitoresPorGabinetes(filhoIds);
          setEleitoresFilhos(eleitoresFilhosData);
        }
      } catch {}

      const todos = isAdmin ? await getGabinetes().catch(() => []) : [];
      setTodosGabinetes(todos);
    } catch (e) { console.error("Erro ao carregar painel:", e); } finally { setLoading(false); }
  }

  async function vincularGabinete() {
    if (!vincularId || !gabinete?.id) return;
    setVincularSaving(true);
    try {
      await updateDoc(doc(db, "campanhas", vincularId), { parentGabineteId: gabinete.id, parentGabineteNome: gabinete.nome });
      await registrarAtividade({
        acao: "vinculou_gabinete", usuarioId: userData!.uid, usuarioNome: userData!.nome,
        usuarioRole: userData!.role, detalhes: `Vinculou gabinete ao ${gabinete.nome}`,
      });
      toast.success("Gabinete vinculado!");
      setShowVincular(false);
      setVincularId("");
      loadAll();
    } catch (e) { toast.error("Erro ao vincular"); } finally { setVincularSaving(false); }
  }

  function desvincularGabinete(filhoId: string, nome: string) {
    setConfirmDesvincular({ id: filhoId, nome });
  }

  async function confirmarDesvincular() {
    if (!confirmDesvincular) return;
    try {
      await updateDoc(doc(db, "campanhas", confirmDesvincular.id), { parentGabineteId: "", parentGabineteNome: "" });
      toast.success("Gabinete desvinculado!");
      loadAll();
    } catch { toast.error("Erro ao desvincular"); } finally { setConfirmDesvincular(null); }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-rose-500" /></div>;
  if (!gabinete) return <div className="text-center py-20 text-white/30">Gabinete não encontrado</div>;

  const coordenadores = usuarios.filter((u) => u.role === "coordenador" && (u.campanhaId === id || u.gabineteId === id));
  const assessoresDoGab = usuarios.filter((u) => u.role === "assessor" && (u.gabineteId === id || u.campanhaId === id));
  const colaboradoresDoCoord = (uid: string) => usuarios.filter((u) => u.role === "colaborador" && u.coordenadorId === uid);
  const colaboradores = usuarios.filter((u) => u.role === "colaborador");
  const colabNoGabinete = colaboradores.filter((c) => eleitores.some((e) => e.colaboradorId === c.uid));
  const totalEleitores = eleitores.length;
  const hoje = new Date().toLocaleDateString("pt-BR");
  const cadastrosHoje = eleitores.filter((e) => parseDate(e.criadoEm).toLocaleDateString("pt-BR") === hoje).length;
  const cadastrosSemana = eleitores.filter((e) => {
    const diff = (Date.now() - parseDate(e.criadoEm).getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  }).length;
  const ultimaAtividade = atividades.filter((a) => a.gabineteId === id || a.campanhaId === id)[0];

  const crescimentoData = Object.entries(
    eleitores.reduce<Record<string, number>>((acc, e) => {
      const key = parseDate(e.criadoEm).toLocaleDateString("pt-BR");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).map(([dia, total]) => ({ dia, total }))
  .sort((a, b) => {
    const [dA, mA, yA] = a.dia.split("/").map(Number);
    const [dB, mB, yB] = b.dia.split("/").map(Number);
    return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
  });

  const rankingColaboradores = colabNoGabinete
    .map((c) => {
      const coord = usuarios.find((u) => u.uid === c.coordenadorId);
      const territorio = c.bairro && c.cidade ? `${c.bairro} · ${c.cidade}` : (c.cidade || "");
      return {
        nome: c.nome,
        total: eleitores.filter((e) => e.colaboradorId === c.uid).length,
        coordNome: coord?.nome || "",
        territorio,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const rankingCoordenadores = coordenadores
    .map((c) => ({
      nome: c.nome,
      total: eleitores.filter((e) => e.coordenadorId === c.uid).length,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  async function exportExcelPremiumAction() {
    if (!gabinete) return;
    try {
      const res = await fetch("/api/exportar-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eleitores, titulo: gabinete.nome, party: gabinete.politicoPartido }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-${(gabinete.politicoPartido || "gabinete").toLowerCase()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel premium exportado!");
    } catch { toast.error("Erro ao exportar"); }
  }

  function exportPDFPremiumAction() {
    if (!gabinete) return;
    try {
      exportPDFPremium(eleitores, gabinete.nome, gabinete.politicoPartido, gabinete.nome, gabinete.politicoNome, gabinete.cargo);
      toast.success("PDF exportado!");
    } catch { toast.error("Erro ao exportar"); }
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white/40 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: gabinete.corPrincipal || "#8b5cf6" }}>
            {gabinete.nome.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{gabinete.nome}</h1>
            <p className="text-sm text-white/50">{gabinete.cargo} • {gabinete.politicoNome}{gabinete.politicoPartido ? ` • ${gabinete.politicoPartido}` : ""}</p>
          </div>
        </div>
        <Badge variant={gabinete.ativo ? "success" : "default"}>{gabinete.ativo ? "Ativo" : "Inativo"}</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4 text-center">
          <Target size={22} className="mx-auto mb-1 text-purple-400" />
          <p className="text-2xl font-bold text-white">{coordenadores.length}</p>
          <p className="text-xs text-white/40">Coordenadores</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <Zap size={22} className="mx-auto mb-1 text-emerald-400" />
          <p className="text-2xl font-bold text-white">{colabNoGabinete.length}</p>
          <p className="text-xs text-white/40">Colaboradores / Militantes</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <Users size={22} className="mx-auto mb-1 text-rose-400" />
          <p className="text-2xl font-bold text-white">{totalEleitores}</p>
          <p className="text-xs text-white/40">Eleitores</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <TrendingUp size={22} className="mx-auto mb-1 text-amber-400" />
          <p className="text-2xl font-bold text-white">{cadastrosSemana}</p>
          <p className="text-xs text-white/40">Cadastros (7 dias)</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {crescimentoData.length > 0 && (
            <GlassCard className="p-5">
              <h3 className="text-white font-semibold mb-4">Evolução Diária</h3>
              <div className="h-56">
                {mounted && <ResponsiveContainer width="100%" height={224}>
                  <AreaChart data={crescimentoData}>
                    <defs>
                      <linearGradient id="gabGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="dia" stroke="rgba(255,255,255,0.1)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                    <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, color: "#fff" }} />
                    <Area type="monotone" dataKey="total" stroke="#f43f5e" fillOpacity={1} fill="url(#gabGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>}
              </div>
            </GlassCard>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rankingColaboradores.length > 0 && (
              <GlassCard className="p-5">
                <h3 className="text-white font-semibold mb-3">Colaboradores Mais Ativos</h3>
                <div className="space-y-1.5">
                  {rankingColaboradores.map((c, i) => (
                    <div key={c.nome} className="flex items-start gap-2.5 p-2 bg-white/[0.03] rounded-xl">
                      <span className="text-white/30 text-xs w-5 shrink-0 mt-0.5">{i + 1}º</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white/85 text-sm font-medium truncate">{c.nome}</p>
                        {c.coordNome && (
                          <p className="text-white/35 text-[10px] truncate">Coord. {c.coordNome.split(" ")[0]}</p>
                        )}
                        {c.territorio && (
                          <p className="text-white/25 text-[10px] truncate">{c.territorio}</p>
                        )}
                      </div>
                      <span className="text-emerald-400 font-bold text-sm shrink-0">{c.total}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
            {rankingCoordenadores.length > 0 && (
              <GlassCard className="p-5">
                <h3 className="text-white font-semibold mb-3">Coordenadores Mais Ativos</h3>
                <div className="space-y-2">
                  {rankingCoordenadores.map((c, i) => (
                    <div key={c.nome} className="flex items-center gap-3 text-sm">
                      <span className="text-white/40 w-5">{i + 1}º</span>
                      <span className="text-white/80 flex-1 truncate">{c.nome}</span>
                      <span className="text-purple-400 font-medium">{c.total}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <GlassCard className="p-5">
            <h3 className="text-white font-semibold mb-3">Informações do Gabinete</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-white/50">Criado em</span><span className="text-white/80">{formatDate(gabinete.criadoEm)}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Cargo</span><span className="text-white/80">{gabinete.cargo}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Nível</span><span className="text-white/80 capitalize">{gabinete.nivelPolitico || "-"}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Ciclo</span><span className="text-white/80">{gabinete.cicloEleitoral ? gabinete.cicloEleitoral.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "-"}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Político</span><span className="text-white/80">{gabinete.politicoNome}</span></div>
              {gabinete.politicoPartido && <div className="flex justify-between"><span className="text-white/50">Partido</span><span className="text-white/80">{gabinete.politicoPartido}</span></div>}
              {gabinete.parentGabineteId && <div className="flex justify-between"><span className="text-white/50">Vinculado a</span><span className="text-white/80 text-xs">{gabinete.parentGabineteNome || "Gabinete superior"}</span></div>}
              {gabinete.slogan && <div className="flex justify-between"><span className="text-white/50">Slogan</span><span className="text-white/80 italic">"{gabinete.slogan}"</span></div>}
              <div className="flex justify-between"><span className="text-white/50">Cadastros Hoje</span><span className="text-amber-400 font-medium">{cadastrosHoje}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Última atividade</span><span className="text-white/50 text-xs">{ultimaAtividade ? formatDate(ultimaAtividade.criadoEm) : "Nenhuma"}</span></div>
            </div>
          </GlassCard>

          {/* EQUIPE DO GABINETE */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Equipe do Gabinete</h3>
              {isSuperOrMaster(userData) && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.open(`/coordenadores?gabineteId=${id}`, "_blank")}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all"
                    title="Criar coordenador neste gabinete"
                  >
                    <UserPlus size={12} /> Coord.
                  </button>
                  <button
                    onClick={() => window.open(`/colaboradores?gabineteId=${id}`, "_blank")}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                    title="Criar colaborador neste gabinete"
                  >
                    <UserPlus size={12} /> Colab.
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-1 text-sm">
              {/* ASSESSORES */}
              <div>
                <button onClick={() => toggleEquipe("assessores")} className="w-full flex items-center justify-between p-2 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl transition-all">
                  <div className="flex items-center gap-2">
                    <span className="text-white/40">{equipeExpanded.assessores ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-xs font-bold">A</div>
                    <span className="text-white/80">Assessores</span>
                  </div>
                  <span className="text-purple-400 font-medium">{assessoresDoGab.length}</span>
                </button>
                {equipeExpanded.assessores && (
                  <div className="ml-9 mt-1 space-y-1">
                    {assessoresDoGab.length > 0 ? assessoresDoGab.map((a) => (
                      <div key={a.uid} className="flex items-center gap-2 p-1.5 rounded-lg bg-white/[0.02] text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="text-white/80 truncate">{a.nome}</p>
                          <p className="text-white/30 text-[10px] truncate">Assessor(a) • {gabinete?.cargo} {gabinete?.nome}</p>
                        </div>
                        <span className="text-white/20 text-[10px] shrink-0">{a.email}</span>
                      </div>
                    )) : <p className="text-xs text-white/30 italic pl-2">Nenhum assessor</p>}
                  </div>
                )}
              </div>

              {/* COORDENADORES */}
              <div>
                <button onClick={() => toggleEquipe("coordenadores")} className="w-full flex items-center justify-between p-2 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl transition-all">
                  <div className="flex items-center gap-2">
                    <span className="text-white/40">{equipeExpanded.coordenadores ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold">C</div>
                    <span className="text-white/80">Coordenadores</span>
                  </div>
                  <span className="text-blue-400 font-medium">{coordenadores.length}</span>
                </button>
                {equipeExpanded.coordenadores && (
                  <div className="ml-9 mt-1 space-y-1">
                    {coordenadores.length > 0 ? coordenadores.map((c) => {
                      const colabs = colaboradoresDoCoord(c.uid);
                      const coordEleitores = eleitores.filter((e) => e.coordenadorId === c.uid).length;
                      const territorio = c.bairro && c.cidade ? `${c.bairro} · ${c.cidade}` : (c.cidade || "");
                      return (
                        <div key={c.uid} className="rounded-xl bg-white/[0.02] overflow-hidden">
                          <button
                            onClick={() => toggleEquipe(`coord_${c.uid}`)}
                            className="w-full flex items-center gap-2 p-2.5 hover:bg-white/[0.04] transition-colors text-left"
                          >
                            <span className="text-white/30 shrink-0">
                              {equipeExpanded[`coord_${c.uid}`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-white/85 text-xs font-medium truncate">{c.nome}</p>
                              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                {territorio && <span className="text-white/40 text-[10px]">{territorio}</span>}
                                <span className="text-white/25 text-[10px]">{colabs.length} colab. · {coordEleitores} eleit.</span>
                              </div>
                            </div>
                            {c.email && <span className="text-white/15 text-[10px] shrink-0 hidden sm:block max-w-[90px] truncate">{c.email}</span>}
                          </button>
                          {equipeExpanded[`coord_${c.uid}`] && (
                            <div className="border-t border-white/[0.04] px-2.5 pb-2.5 pt-2 space-y-1.5">
                              {colabs.length > 0 ? colabs.map((col) => {
                                const colTotal = eleitores.filter((e) => e.colaboradorId === col.uid).length;
                                const colTerr = col.bairro && col.cidade ? `${col.bairro} · ${col.cidade}` : (col.cidade || territorio);
                                return (
                                  <div key={col.uid} className="flex items-start gap-2 p-2 bg-white/[0.03] rounded-lg">
                                    <Zap size={9} className="text-emerald-400 shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-white/75 text-xs font-medium truncate">{col.nome}</p>
                                      <p className="text-white/30 text-[10px]">Militante</p>
                                      {colTerr && <p className="text-white/20 text-[10px] truncate">{colTerr}</p>}
                                    </div>
                                    {colTotal > 0 && <span className="text-emerald-400/70 text-xs font-medium shrink-0">{colTotal}</span>}
                                  </div>
                                );
                              }) : <p className="text-xs text-white/25 italic pl-1">Sem militantes</p>}
                            </div>
                          )}
                        </div>
                      );
                    }) : <p className="text-xs text-white/30 italic pl-2">Nenhum coordenador</p>}
                  </div>
                )}
              </div>

              {/* COLABORADORES */}
              <div>
                <button onClick={() => toggleEquipe("colaboradores")} className="w-full flex items-center justify-between p-2 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl transition-all">
                  <div className="flex items-center gap-2">
                    <span className="text-white/40">{equipeExpanded.colaboradores ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-xs font-bold">M</div>
                    <span className="text-white/80">Colaboradores/Militantes</span>
                  </div>
                  <span className="text-emerald-400 font-medium">{colabNoGabinete.length}</span>
                </button>
                {equipeExpanded.colaboradores && (
                  <div className="ml-9 mt-1 space-y-1">
                    {colabNoGabinete.length > 0 ? colabNoGabinete.map((col) => {
                      const coordDoCol = usuarios.find((u) => u.uid === col.coordenadorId);
                      const colTerr = col.bairro && col.cidade ? `${col.bairro} · ${col.cidade}` : (col.cidade || "");
                      const colTotal = eleitores.filter((e) => e.colaboradorId === col.uid).length;
                      return (
                        <div key={col.uid} className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02]">
                          <Zap size={9} className="text-emerald-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white/80 text-xs font-medium truncate">{col.nome}</p>
                            <p className="text-white/30 text-[10px]">Militante</p>
                            {colTerr && <p className="text-white/25 text-[10px] truncate">{colTerr}</p>}
                            {coordDoCol && <p className="text-white/20 text-[10px] truncate">Coord. {coordDoCol.nome}</p>}
                          </div>
                          {colTotal > 0 && <span className="text-emerald-400/60 text-xs font-medium shrink-0">{colTotal}</span>}
                        </div>
                      );
                    }) : <p className="text-xs text-white/30 italic pl-2">Nenhum militante</p>}
                  </div>
                )}
              </div>
            </div>
          </GlassCard>

          {gabinetesFilhos.length > 0 && (
            <GlassCard className="p-5">
              <h3 className="text-white font-semibold mb-3">Gabinetes Vinculados</h3>
              <div className="space-y-2">
                {gabinetesFilhos.map((f) => {
                  const totalFilhos = eleitoresFilhos.filter((e) => e.campanhaId === f.id).length;
                  return (
                    <div key={f.id} className="flex items-center justify-between p-2 bg-white/[0.03] rounded-xl text-sm">
                      <div className="flex items-center gap-2">
                        <button onClick={() => window.open(`/gabinete/${f.id}`, "_blank")} className="text-white/80 hover:text-emerald-400 transition-colors text-left">
                          {f.nome} <span className="text-white/40 text-xs">({f.cargo})</span>
                        </button>
                        {isSuperOrMaster(userData) && (
                          <button onClick={() => desvincularGabinete(f.id!, f.nome)} className="text-white/20 hover:text-red-400 transition-colors" title="Desvincular">
                            <Unlink size={12} />
                          </button>
                        )}
                      </div>
                      <span className="text-white/50 text-xs">{totalFilhos} eleitores</span>
                    </div>
                  );
                })}
                <div className="pt-2 border-t border-white/[0.06] flex justify-between text-sm">
                  <span className="text-white/60">Total consolidado</span>
                  <span className="text-emerald-400 font-medium">{eleitoresFilhos.length + totalEleitores} eleitores</span>
                </div>
              </div>
            </GlassCard>
          )}

          {/* BASES POLÍTICAS VINCULADAS */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Bases Políticas Vinculadas</h3>
              {isSuperOrMaster(userData) && (
                <button
                  onClick={() => setShowVincular(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                >
                  <Plus size={14} /> Vincular
                </button>
              )}
            </div>
            {gabinetesFilhos.length === 0 ? (
              <p className="text-sm text-white/30 italic">Nenhuma base vinculada. Clique em "Vincular" para adicionar prefeitos, vereadores ou outros gabinetes aliados.</p>
            ) : null}
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-white font-semibold mb-3">Exportar Dados</h3>
            <div className="space-y-2">
              <Button onClick={exportExcelPremiumAction} className="w-full justify-start" variant="secondary"><FileSpreadsheet size={16} /> Exportar Excel Premium</Button>
              <Button onClick={exportPDFPremiumAction} className="w-full justify-start" variant="secondary"><FileText size={16} /> Exportar PDF Premium</Button>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-white font-semibold mb-3">Navegação Rápida</h3>
            <div className="space-y-2">
              <Button onClick={() => router.push(`/eleitores?gabinete=${id}`)} className="w-full justify-start text-xs" variant="ghost"><Users size={14} /> Eleitores</Button>
              <Button onClick={() => router.push(`/coordenadores?gabineteId=${id}`)} className="w-full justify-start text-xs" variant="ghost"><Target size={14} /> Coordenadores</Button>
              <Button onClick={() => router.push(`/colaboradores?gabineteId=${id}`)} className="w-full justify-start text-xs" variant="ghost"><Zap size={14} /> Colaboradores</Button>
              <Button onClick={() => router.push(`/metas?gabinete=${id}`)} className="w-full justify-start text-xs" variant="ghost"><BarChart3 size={14} /> Metas</Button>
              <Button onClick={() => router.push(`/relatorios?gabinete=${id}`)} className="w-full justify-start text-xs" variant="ghost"><Activity size={14} /> Relatórios</Button>
              <Button onClick={() => router.push(`/candidatos?gabinete=${id}`)} className="w-full justify-start text-xs" variant="ghost"><Building2 size={14} /> Candidatos</Button>
              <Button onClick={() => router.push(`/logs?gabinete=${id}`)} className="w-full justify-start text-xs" variant="ghost"><Activity size={14} /> Logs</Button>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* MODAL VINCULAR GABINETE */}
      {showVincular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowVincular(false)}>
          <div className="bg-[#1a1a2e] border border-white/[0.06] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-4">Vincular Base Política</h3>
            <p className="text-sm text-white/50 mb-4">Selecione um gabinete para vincular como base aliada.</p>
            <Select
              label="Gabinetes disponíveis"
              value={vincularId}
              onChange={(e) => setVincularId(e.target.value)}
              options={todosGabinetes
                .filter((g) => g.id !== id && g.ativo && gabinetesFilhos.every((f) => f.id !== g.id) && !g.parentGabineteId)
                .map((g) => ({ value: g.id!, label: `${g.nome} (${g.cargo})` }))
              }
              emptyMessage="Nenhum gabinete disponível para vincular"
            />
            <div className="flex gap-3 mt-4">
              <Button onClick={vincularGabinete} loading={vincularSaving} className="flex-1">Vincular</Button>
              <Button variant="ghost" onClick={() => setShowVincular(false)} className="flex-1">Cancelar</Button>
            </div>
          </div>
        </div>
      )}
      {confirmDesvincular && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setConfirmDesvincular(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm space-y-5" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="text-white font-semibold">Desvincular gabinete?</p>
              <p className="text-sm text-white/50 mt-1">{confirmDesvincular.nome}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDesvincular(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-semibold hover:bg-white/10 transition-colors">Cancelar</button>
              <button onClick={confirmarDesvincular} className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors">Desvincular</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

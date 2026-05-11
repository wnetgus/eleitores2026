"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, getDoc, doc, query, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Eleitor, AppUser, ROLE_CONFIG } from "@/types";
import { getRoleConfig, isSuperOrMaster, isPolitico, isPrefeito, isVereador, isAssessor, isCoordenador, isColaborador } from "@/lib/permissions";
import { getPartyColors } from "@/lib/reports";
import { Users, UserPlus, TrendingUp, MapPin, Medal, Target, Crown, Zap, Filter } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/dashboard/StatCard";
import { ApoiadoresPorCidade } from "@/components/charts/ApoiadoresPorCidade";
import { CrescimentoDiario } from "@/components/charts/CrescimentoDiario";
import { RankingColaboradores } from "@/components/charts/RankingColaboradores";
import { ApoiadoresPorEstado } from "@/components/charts/ApoiadoresPorEstado";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatDate, parseDate } from "@/lib/utils";

export default function DashboardPage() {
  const { userData } = useAuth();
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [gabineteNome, setGabineteNome] = useState("");
  const [gabineteCargo, setGabineteCargo] = useState("");
  const [gabinetePartido, setGabinetePartido] = useState("");
  const [filtroCidade, setFiltroCidade] = useState("");
  const [filtroBairro, setFiltroBairro] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const uq = query(collection(db, "usuarios"), orderBy("criadoEm", "desc"));
        const usnap = await getDocs(uq);
        setUsuarios(usnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));

        const constraints: any[] = [orderBy("criadoEm", "desc")];
        if (isColaborador(userData)) {
          constraints.unshift(where("colaboradorId", "==", userData!.uid));
        } else if (isCoordenador(userData)) {
          constraints.unshift(where("coordenadorId", "==", userData!.uid));
        } else if (isAssessor(userData) || isAssessor(userData)) {
          if (userData!.campanhaId) constraints.unshift(where("campanhaId", "==", userData!.campanhaId));
        }
        const q = query(collection(db, "eleitores"), ...constraints);
        const snap = await getDocs(q);
        setEleitores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor)));

        // Buscar dados do gabinete do assessor
        const gabId = userData?.gabineteId || userData?.campanhaId;
        if (gabId) {
          const gabSnap = await getDoc(doc(db, "campanhas", gabId));
          if (gabSnap.exists()) {
            const gData = gabSnap.data();
            setGabineteNome(gData.nome || "");
            setGabineteCargo(gData.cargo || "");
            setGabinetePartido(gData.politicoPartido || "");
          }
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    if (userData) load();
  }, [userData]);

  if (!userData) return null;
  const config = getRoleConfig(userData);
  const roleInfo = ROLE_CONFIG[userData.role];

  // Aplicar filtros
  const eleitoresFiltrados = eleitores.filter((e) => {
    if (filtroCidade && e.cidade !== filtroCidade) return false;
    if (filtroBairro && e.bairro !== filtroBairro) return false;
    return true;
  });

  const hoje = new Date().toLocaleDateString("pt-BR");
  const cadastrosHoje = eleitoresFiltrados.filter((e) => parseDate(e.criadoEm).toLocaleDateString("pt-BR") === hoje);

  const cidadeMap = eleitoresFiltrados.reduce<Record<string, number>>((acc, e) => { acc[e.cidade] = (acc[e.cidade] || 0) + 1; return acc; }, {});
  const topCidade = Object.entries(cidadeMap).sort((a, b) => b[1] - a[1])[0];

  const ranking = eleitoresFiltrados.reduce<Record<string, number>>((acc, e) => { acc[e.colaboradorNome] = (acc[e.colaboradorNome] || 0) + 1; return acc; }, {});
  const rankingArray = Object.entries(ranking).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  const cidadesArray = Object.entries(cidadeMap).map(([cidade, total]) => ({ cidade, total })).sort((a, b) => b.total - a.total);

  const estados = eleitoresFiltrados.reduce<Record<string, number>>((acc, e) => { acc[e.estado] = (acc[e.estado] || 0) + 1; return acc; }, {});
  const estadosArray = Object.entries(estados).map(([estado, total]) => ({ estado, total })).sort((a, b) => b.total - a.total);

  // Listas para filtros
  const cidadesDisponiveis = [...new Set(eleitores.map((e) => e.cidade).filter(Boolean))];
  // Bairros baseado nos eleitores SEM filtro de bairro, mas COM filtro de cidade
  const eleitoresBaseBairro = filtroCidade ? eleitores.filter((e) => e.cidade === filtroCidade) : eleitores;
  const bairrosDisponiveis = [...new Set(eleitoresBaseBairro.map((e) => e.bairro).filter(Boolean))];

  const dias = eleitoresFiltrados.reduce<Record<string, number>>((acc, e) => {
    const d = parseDate(e.criadoEm);
    const key = d.toLocaleDateString("pt-BR");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const crescimentoArray = Object.entries(dias).map(([dia, total]) => ({ dia, total })).sort((a, b) => {
    const [dA, mA, yA] = a.dia.split("/").map(Number);
    const [dB, mB, yB] = b.dia.split("/").map(Number);
    return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><svg className="animate-spin h-8 w-8" style={{ color: roleInfo.text.replace("text-", "") }} viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;
  }

  const colaboradoresEquipe = usuarios.filter((u) => isCoordenador(userData) ? u.coordenadorId === userData.uid : true);

  return (
    <div className="space-y-6 animate-in">
      {/* CABEÇALHO: Gabinete Político (Assessor, Político, Prefeito, Vereador) */}
      {(isAssessor(userData) || isPolitico(userData) || isPrefeito(userData) || isVereador(userData)) && gabineteNome && (
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ background: `#${getPartyColors(gabinetePartido).p}` }}>
            {gabineteNome.charAt(0)}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{gabineteNome}</h1>
            <p className="text-sm text-white/50">
              {gabineteCargo} {gabinetePartido ? `• ${gabinetePartido}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/40">Operador</p>
            <p className="text-sm text-white/80 font-medium">{userData.nome}</p>
            <p className={`text-xs ${roleInfo.text}`}>{roleInfo.label}</p>
          </div>
        </div>
      )}

      {/* CABEÇALHO: Demais roles */}
      {!isAssessor(userData) && !isPolitico(userData) && !isPrefeito(userData) && !isVereador(userData) && (
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleInfo.gradient} flex items-center justify-center text-lg`}>
            {roleInfo.icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {isCoordenador(userData) && "Dashboard da Equipe"}
              {isColaborador(userData) && "Meus Cadastros"}
              {isSuperOrMaster(userData) && "Painel Global"}
            </h1>
            <p className={`text-sm ${roleInfo.text}`}>{userData.nome} • {roleInfo.label}</p>
          </div>
        </div>
      )}

      {/* BANNER INFORMATIVO */}
      <div className={`p-4 rounded-2xl border ${roleInfo.border} ${roleInfo.bg} flex items-center gap-3`}>
        <span className="text-2xl">{roleInfo.icon}</span>
        <div>
          <p className="text-white font-medium">
            {isPolitico(userData) && "Acompanhe o desempenho estratégico do seu mandato"}
            {isAssessor(userData) && "Acompanhe a operação do gabinete"}
            {isCoordenador(userData) && "Gerencie sua equipe e acompanhe a produtividade"}
            {isColaborador(userData) && "Faça cadastros rápidos e acompanhe sua meta"}
            {isSuperOrMaster(userData) && "Visão geral de toda a plataforma"}
          </p>
          <p className={`text-xs ${roleInfo.text} mt-0.5`}>
            {isPolitico(userData) && `${eleitores.length} eleitores cadastrados no seu gabinete`}
            {isAssessor(userData) && `${eleitores.length} eleitores • ${usuarios.filter(u => u.role === 'coordenador').length} coordenadores • ${usuarios.filter(u => u.role === 'colaborador').length} colaboradores`}
            {isCoordenador(userData) && `${eleitores.length} eleitores • ${colaboradoresEquipe.filter(u => u.role === 'colaborador').length} colaboradores na equipe`}
            {isColaborador(userData) && `${eleitores.length} cadastros realizados`}
            {isSuperOrMaster(userData) && `${eleitores.length} eleitores no total`}
          </p>
        </div>
      </div>

      {/* FILTROS TERRITORIAIS */}
      {(isPolitico(userData) || isPrefeito(userData) || isVereador(userData) || isAssessor(userData)) && cidadesDisponiveis.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <Filter size={16} className="text-white/30" />
          {isPolitico(userData) && (
            <Select
              label="Cidade"
              value={filtroCidade}
              onChange={(e) => { setFiltroCidade(e.target.value); setFiltroBairro(""); }}
              options={[{ value: "", label: "Todas as cidades" }, ...cidadesDisponiveis.map((c) => ({ value: c, label: c }))]}
            />
          )}
          {(isPrefeito(userData) || isPolitico(userData)) && bairrosDisponiveis.length > 0 && (
            <Select
              label="Bairro"
              value={filtroBairro}
              onChange={(e) => setFiltroBairro(e.target.value)}
              options={[{ value: "", label: "Todos os bairros" }, ...bairrosDisponiveis.map((b) => ({ value: b, label: b }))]}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={isPolitico(userData) ? "Total de Eleitores" : isPrefeito(userData) ? "Eleitores do Município" : isAssessor(userData) ? "Total de Apoiadores" : isCoordenador(userData) ? "Apoiadores da Equipe" : "Meus Cadastros"} value={eleitoresFiltrados.length} icon={<Users size={20} />} trend={cadastrosHoje.length > 0 ? { value: `+${cadastrosHoje.length} hoje`, positive: true } : undefined} delay={0} />
        <StatCard title="Cadastros Hoje" value={cadastrosHoje.length} icon={<UserPlus size={20} />} delay={100} />
        <StatCard title="Cidade Mais Forte" value={topCidade ? topCidade[0] : "-"} icon={<MapPin size={20} />} delay={200} />
        <StatCard title={isPolitico(userData) ? "Colaboradores" : isAssessor(userData) ? "Colaboradores" : isCoordenador(userData) ? "Equipe" : "Minha Meta"} value={isPolitico(userData) ? usuarios.filter(u => u.role === 'colaborador').length : isAssessor(userData) ? usuarios.filter(u => u.role === 'colaborador').length : isCoordenador(userData) ? colaboradoresEquipe.filter(u => u.role === 'colaborador').length : "⚡"} icon={<Medal size={20} />} delay={300} />
      </div>

      {isColaborador(userData) ? (
        <GlassCard className="p-5">
          <h3 className="text-white font-semibold mb-4">Meus Últimos Cadastros</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 border-b border-white/[0.06]">
                  <th className="text-left py-3 px-2 font-medium">Nome</th>
                  <th className="text-left py-3 px-2 font-medium">Cidade</th>
                  <th className="text-left py-3 px-2 font-medium">Grau</th>
                  <th className="text-left py-3 px-2 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {eleitores.slice(0, 10).map((e) => (
                  <tr key={e.id} className="border-b border-white/[0.03]">
                    <td className="py-3 px-2 text-white/80">{e.nomeCompleto}</td>
                    <td className="py-3 px-2 text-white/60">{e.cidade}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.grauApoio === "forte" ? "bg-emerald-500/20 text-emerald-400" : e.grauApoio === "medio" ? "bg-amber-500/20 text-amber-400" : e.grauApoio === "fraco" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>{e.grauApoio}</span>
                    </td>
                    <td className="py-3 px-2 text-white/40 text-xs">{formatDate(e.criadoEm)}</td>
                  </tr>
                ))}
                {eleitores.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-white/30">Nenhum cadastro ainda. Vá em "Novo Cadastro" para começar!</td></tr>}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {crescimentoArray.length > 0 && <CrescimentoDiario data={crescimentoArray} />}
            {cidadesArray.length > 0 && <ApoiadoresPorCidade data={cidadesArray.slice(0, 10)} />}
            {rankingArray.length > 0 && <RankingColaboradores data={rankingArray} />}
            {estadosArray.length > 0 && <ApoiadoresPorEstado data={estadosArray} />}
          </div>

          <GlassCard className="p-5">
            <h3 className="text-white font-semibold mb-4">Últimos Cadastros</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 border-b border-white/[0.06]">
                    <th className="text-left py-3 px-2 font-medium">Nome</th>
                    <th className="text-left py-3 px-2 font-medium">Cidade</th>
                    <th className="text-left py-3 px-2 font-medium">Grau</th>
                    <th className="text-left py-3 px-2 font-medium">Colaborador</th>
                    <th className="text-left py-3 px-2 font-medium">Coordenador</th>
                    <th className="text-left py-3 px-2 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {eleitores.slice(0, 15).map((e) => (
                    <tr key={e.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-2 text-white/80">{e.nomeCompleto}</td>
                      <td className="py-3 px-2 text-white/60">{e.cidade}</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.grauApoio === "forte" ? "bg-emerald-500/20 text-emerald-400" : e.grauApoio === "medio" ? "bg-amber-500/20 text-amber-400" : e.grauApoio === "fraco" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>{e.grauApoio}</span>
                      </td>
                      <td className="py-3 px-2 text-white/60">{e.colaboradorNome}</td>
                      <td className="py-3 px-2 text-white/60">{e.coordenadorNome || "-"}</td>
                      <td className="py-3 px-2 text-white/40 text-xs">{formatDate(e.criadoEm)}</td>
                    </tr>
                  ))}
                  {eleitores.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-white/30">Nenhum cadastro encontrado</td></tr>}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}

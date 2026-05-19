"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, getDoc, doc, query, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Eleitor, AppUser, ROLE_CONFIG } from "@/types";
import { getRoleConfig, isSuperOrMaster, isPolitico, isPrefeito, isVereador, isAssessor, isCoordenador, isColaborador } from "@/lib/permissions";
import { getPartyColors, exportRelatorioExecutivo } from "@/lib/reports";
import { buscarEleitoresPorGabinetes } from "@/lib/firestore";
import { Users, UserPlus, TrendingUp, MapPin, Medal, Target, Crown, Zap, Filter, AlertTriangle, Bell, Clock, Eye, PlusCircle, FileSpreadsheet, Settings } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/dashboard/StatCard";
import { ApoiadoresPorCidade } from "@/components/charts/ApoiadoresPorCidade";
import { CrescimentoDiario } from "@/components/charts/CrescimentoDiario";
import { RankingColaboradores } from "@/components/charts/RankingColaboradores";
import { ApoiadoresPorEstado } from "@/components/charts/ApoiadoresPorEstado";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, parseDate } from "@/lib/utils";
import { calcularSaudeColaborador, calcularIC, calcularSFPSimples } from "@/lib/inteligencia";
import toast from "react-hot-toast";

export default function DashboardPage() {
  const { userData } = useAuth();
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [gabineteNome, setGabineteNome] = useState("");
  const [gabineteCargo, setGabineteCargo] = useState("");
  const [gabinetePartido, setGabinetePartido] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroCidade, setFiltroCidade] = useState("");
  const [filtroBairro, setFiltroBairro] = useState("");
  const [loading, setLoading] = useState(true);
  const [gabinetes, setGabinetes] = useState<any[]>([]);
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState(0);
  const [minhaMeta, setMinhaMeta] = useState(0);
  const [metasPorColaborador, setMetasPorColaborador] = useState<Record<string, number>>({});
  const [gabinetesFilhos, setGabinetesFilhos] = useState<any[]>([]);
  const [eleitoresFilhos, setEleitoresFilhos] = useState<Eleitor[]>([]);
  const [meusCoordIds, setMeusCoordIds] = useState<string[]>([]);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date>(new Date());

  useEffect(() => {
    async function load() {
      try {
        const gabId = userData?.gabineteId || userData?.campanhaId;
        let usuariosSnap: { docs: any[] };
        if (isSuperOrMaster(userData)) {
          usuariosSnap = await getDocs(query(collection(db, "usuarios"), orderBy("criadoEm", "desc")));
        } else if (isCoordenador(userData)) {
          usuariosSnap = await getDocs(query(collection(db, "usuarios"), where("coordenadorId", "==", userData!.uid)));
        } else if (gabId) {
          usuariosSnap = await getDocs(query(collection(db, "usuarios"), where("campanhaId", "==", gabId)));
        } else {
          usuariosSnap = { docs: [] };
        }
        setUsuarios(usuariosSnap.docs.map((d: any) => ({ uid: d.id, ...d.data() } as AppUser)));

        const constraints: any[] = [orderBy("criadoEm", "desc")];
        let eleitoresCarregados = false;
        if (isColaborador(userData)) {
          constraints.unshift(where("colaboradorId", "==", userData!.uid));
        } else if (isCoordenador(userData)) {
          constraints.unshift(where("coordenadorId", "==", userData!.uid));
        } else if (isAssessor(userData)) {
          const coordSnap = await getDocs(query(collection(db, "usuarios"), where("role", "==", "coordenador"), where("assessorId", "==", userData!.uid)));
          const coordIds = coordSnap.docs.map((d) => d.id);
          setMeusCoordIds(coordIds);
          if (coordIds.length > 0) {
            const eQuery = gabId
              ? query(collection(db, "eleitores"), where("coordenadorId", "in", coordIds), where("campanhaId", "==", gabId))
              : query(collection(db, "eleitores"), where("coordenadorId", "in", coordIds));
            const esnap = await getDocs(eQuery);
            setEleitores(esnap.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor)));
          }
          eleitoresCarregados = true;
        } else if (!isSuperOrMaster(userData)) {
          const campanhaId = userData?.campanhaId || userData?.gabineteId;
          if (campanhaId) constraints.unshift(where("campanhaId", "==", campanhaId));
        }
        if (!eleitoresCarregados) {
          const q = query(collection(db, "eleitores"), ...constraints);
          const snap = await getDocs(q);
          setEleitores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor)));
        }

        // Buscar dados do gabinete do assessor
        if (gabId) {
          const gabSnap = await getDoc(doc(db, "campanhas", gabId));
          if (gabSnap.exists()) {
            const gData = gabSnap.data();
            setGabineteNome(gData.nome || "");
            setGabineteCargo(gData.cargo || "");
            setGabinetePartido(gData.politicoPartido || "");
          }
        }
        // Dados extras para Super Admin
        // Metas
        const mSnap = isSuperOrMaster(userData) || !gabId
          ? await getDocs(query(collection(db, "metas")))
          : isColaborador(userData)
            ? await getDocs(query(collection(db, "metas"), where("colaboradorId", "==", userData!.uid)))
            : await getDocs(query(collection(db, "metas"), where("gabineteId", "==", gabId)));
        const metasMap: Record<string, number> = {};
        mSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.colaboradorId) metasMap[data.colaboradorId] = data.meta;
        });
        setMetasPorColaborador(metasMap);
        if (isColaborador(userData) && userData?.coordenadorId) {
          const coordDocSnap = await getDoc(doc(db, "usuarios", userData!.coordenadorId));
          const coordData = coordDocSnap?.data() || {};
          const coordPadrao = (coordData.metaPadraoEquipe as number) || 0;
          let padraoFinal = coordPadrao;
          if (!padraoFinal && coordData.assessorId) {
            const assessorSnap = await getDoc(doc(db, "usuarios", coordData.assessorId));
            padraoFinal = (assessorSnap?.data()?.metaPadraoEquipe as number) || 0;
          }
          setMinhaMeta(metasMap[userData!.uid] || padraoFinal);
        }
        if (isSuperOrMaster(userData)) {
          const [gSnap, sSnap] = await Promise.all([
            getDocs(query(collection(db, "campanhas"), orderBy("criadoEm", "desc"))),
            getDocs(query(collection(db, "usuarios"), where("role", "==", "colaborador"), where("status", "in", ["pendente"]))),
          ]);
          setGabinetes(gSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setSolicitacoesPendentes(sSnap.size);
        }
        // Buscar aliados (coalizão) para político e assessor
        if ((isPolitico(userData) || isAssessor(userData)) && userData?.campanhaId) {
          const filhosSnap = await getDocs(query(collection(db, "campanhas"), where("parentGabineteId", "==", userData.campanhaId)));
          const filhos = filhosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setGabinetesFilhos(filhos);
          if (filhos.length > 0) {
            const filhosIds = filhos.map((f: any) => f.id);
            // buscarEleitoresPorGabinetes faz batching automático (chunks de 30)
            setEleitoresFilhos(await buscarEleitoresPorGabinetes(filhosIds));
          } else {
            setEleitoresFilhos([]);
          }
        }
        setUltimaAtualizacao(new Date());
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    if (userData) load();
  }, [userData]);

  if (!userData) return null;
  const config = getRoleConfig(userData);
  const roleInfo = ROLE_CONFIG[userData.role];

  // Aplicar filtros
  const eleitoresFiltrados = eleitores.filter((e) => {
    if (filtroEstado && e.estado !== filtroEstado) return false;
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

  // Listas para filtros (selects dependentes em cascata: estado → cidade → bairro)
  const estadosDisponiveis = [...new Set(eleitores.map((e) => e.estado).filter(Boolean))].sort();
  const eleitoresBaseCidade = filtroEstado ? eleitores.filter((e) => e.estado === filtroEstado) : eleitores;
  const cidadesDisponiveis = [...new Set(eleitoresBaseCidade.map((e) => e.cidade).filter(Boolean))].sort();
  const eleitoresBaseBairro = filtroCidade ? eleitores.filter((e) => e.cidade === filtroCidade) : filtroEstado ? eleitores.filter((e) => e.estado === filtroEstado) : eleitores;
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
  const progressoMeta = minhaMeta > 0 ? Math.min(100, Math.round((eleitores.length / minhaMeta) * 100)) : 0;
  const colaboradoresPorCoordenador = usuarios.filter((u) => u.role === "colaborador" && u.coordenadorId === userData?.uid && (!u.status || u.status === "ativo")).length;

  // Calcular alertas e panorama para Super Admin
  const alertas: { tipo: "alerta" | "info" | "erro"; mensagem: string; acao?: string; link?: string }[] = [];
  const totalColaboradores = usuarios.filter((u) => u.role === "colaborador" && u.status !== "recusado").length;
  const colaboradoresPendentes = usuarios.filter((u) => u.role === "colaborador" && u.status === "pendente").length;
  const colaboradoresAtivos = usuarios.filter((u) => u.role === "colaborador" && (u.status === "ativo" || !u.status)).length;

  if (isSuperOrMaster(userData)) {
    if (solicitacoesPendentes > 0) {
      alertas.push({ tipo: "alerta", mensagem: `${solicitacoesPendentes} solicitação${solicitacoesPendentes > 1 ? "ões" : ""} de colaborador${solicitacoesPendentes > 1 ? "es" : ""} aguardando aprovação`, acao: "Ver solicitações", link: "/solicitacoes" });
    }
    const gabsInativos = gabinetes.filter((g: any) => !g.ativo);
    if (gabsInativos.length > 0) {
      alertas.push({ tipo: "erro", mensagem: `${gabsInativos.length} gabinete${gabsInativos.length > 1 ? "s" : ""} inativo${gabsInativos.length > 1 ? "s" : ""} — precisa de atenção` });
    }
    const gabsSemEleitores = gabinetes.filter((g: any) => {
      const count = eleitores.filter((e) => e.campanhaId === g.id).length;
      return g.ativo && count === 0;
    });
    if (gabsSemEleitores.length > 0) {
      alertas.push({ tipo: "info", mensagem: `${gabsSemEleitores.length} gabinete${gabsSemEleitores.length > 1 ? "s" : ""} ativo${gabsSemEleitores.length > 1 ? "s" : ""} sem nenhum eleitor cadastrado` });
    }
    const coordsSemEquipe = usuarios.filter((u) => u.role === "coordenador" && (!u.equipe || u.equipe.length === 0));
    if (coordsSemEquipe.length > 0) {
      alertas.push({ tipo: "info", mensagem: `${coordsSemEquipe.length} coordenador${coordsSemEquipe.length > 1 ? "es" : ""} sem colaboradores vinculados`, acao: "Ver coordenadores", link: "/coordenadores?filtro=sem-colaboradores" });
    }
  }

  if (isAssessor(userData)) {
    const pendentesAssessor = meusCoordIds.length > 0
      ? usuarios.filter((u) => u.role === "colaborador" && u.status === "pendente" && meusCoordIds.includes(u.coordenadorId || ""))
      : [];
    if (pendentesAssessor.length > 0) {
      alertas.push({ tipo: "alerta", mensagem: `${pendentesAssessor.length} colaborador${pendentesAssessor.length > 1 ? "es" : ""} aguardando aprovação`, acao: "Ver solicitações", link: "/solicitacoes" });
    }
    const colabsAssessor = meusCoordIds.length > 0
      ? usuarios.filter((u) => u.role === "colaborador" && (!u.status || u.status === "ativo") && meusCoordIds.includes(u.coordenadorId || ""))
      : [];
    const inativos = colabsAssessor.filter((u) => calcularSaudeColaborador(u.ultimaAtividade, u.criadoEm).status === "inativo");
    const parados  = colabsAssessor.filter((u) => calcularSaudeColaborador(u.ultimaAtividade, u.criadoEm).status === "parado");
    if (inativos.length > 0) {
      alertas.push({ tipo: "erro", mensagem: `${inativos.length} colaborador${inativos.length > 1 ? "es inativos" : " inativo"} (sem atividade há mais de 10 dias)`, acao: "Ver colaboradores", link: "/colaboradores" });
    }
    if (parados.length > 0) {
      alertas.push({ tipo: "alerta", mensagem: `${parados.length} colaborador${parados.length > 1 ? "es parados" : " parado"} (6-10 dias sem cadastrar)`, acao: "Ver colaboradores", link: "/colaboradores" });
    }
    const icAssessor = calcularIC(eleitores);
    if (icAssessor && icAssessor.atual + icAssessor.anterior >= 10 && (icAssessor.direcao === "queda" || icAssessor.direcao === "retraindo")) {
      alertas.push({ tipo: "alerta", mensagem: `Crescimento em queda: ${icAssessor.label} nos últimos 7 dias`, acao: "Ver relatório", link: "/relatorios" });
    }
  }

  if (isCoordenador(userData)) {
    const colabsCoordenador = usuarios.filter((u) => u.role === "colaborador" && u.coordenadorId === userData.uid && (!u.status || u.status === "ativo"));
    const comProblema = colabsCoordenador.filter((u) => {
      const s = calcularSaudeColaborador(u.ultimaAtividade, u.criadoEm).status;
      return s === "inativo" || s === "parado";
    });
    if (comProblema.length > 0) {
      const todosParados = colabsCoordenador.length > 0 && comProblema.length === colabsCoordenador.length;
      if (todosParados) {
        alertas.push({ tipo: "erro", mensagem: "Toda a equipe está sem atividade recente", acao: "Ver colaboradores", link: "/colaboradores" });
      } else {
        const nomes = comProblema.slice(0, 3).map((u) => u.nome.split(" ")[0]);
        const extras = comProblema.length - 3;
        const lista = extras > 0 ? `${nomes.join(", ")} e +${extras} outro${extras > 1 ? "s" : ""}` : nomes.join(", ");
        alertas.push({ tipo: "alerta", mensagem: `${lista} sem atividade recente`, acao: "Ver colaboradores", link: "/colaboradores" });
      }
    }
    const icCoordenador = calcularIC(eleitores);
    if (icCoordenador && icCoordenador.atual + icCoordenador.anterior >= 5 && (icCoordenador.direcao === "queda" || icCoordenador.direcao === "retraindo")) {
      alertas.push({ tipo: "alerta", mensagem: `Cadastros em queda: ${icCoordenador.label}`, acao: "Ver relatório", link: "/relatorios" });
    }
  }

  const minutosAtras = Math.floor((Date.now() - ultimaAtualizacao.getTime()) / 60000);

  // --- Inteligência Eleitoral ---
  const sfp = !isSuperOrMaster(userData) ? calcularSFPSimples(eleitoresFiltrados) : null;
  const ic = calcularIC(eleitoresFiltrados);

  const colabsParaAnalise = (() => {
    if (isAssessor(userData) && meusCoordIds.length > 0)
      return usuarios.filter((u) => u.role === "colaborador" && (!u.status || u.status === "ativo") && meusCoordIds.includes(u.coordenadorId || ""));
    if (isCoordenador(userData))
      return usuarios.filter((u) => u.role === "colaborador" && u.coordenadorId === userData?.uid && (!u.status || u.status === "ativo"));
    return [] as typeof usuarios;
  })();

  const saudeEquipe = colabsParaAnalise.map((c) => calcularSaudeColaborador(c.ultimaAtividade, c.criadoEm));
  const saudeAtivos   = saudeEquipe.filter((s) => s.status === "ativo" || s.status === "iniciando").length;
  const saudeAtencao  = saudeEquipe.filter((s) => s.status === "atencao").length;
  const saudeParados  = saudeEquipe.filter((s) => s.status === "parado").length;
  const saudeInativos = saudeEquipe.filter((s) => s.status === "inativo" || s.status === "sem_atividade").length;

  const ultimos7 = eleitoresFiltrados.filter((e) => parseDate(e.criadoEm).getTime() > Date.now() - 7 * 86400000).length;
  const ritmoAtual = Math.round((ultimos7 / 7) * 10) / 10;

  const metaScopeTotal = (() => {
    let ids: string[] = [];
    if (isAssessor(userData) && meusCoordIds.length > 0)
      ids = usuarios.filter((u) => u.role === "colaborador" && meusCoordIds.includes(u.coordenadorId || "")).map((u) => u.uid);
    else if (isCoordenador(userData))
      ids = usuarios.filter((u) => u.role === "colaborador" && u.coordenadorId === userData?.uid).map((u) => u.uid);
    return ids.reduce((sum, id) => sum + (metasPorColaborador[id] || 0), 0);
  })();

  const diasParaEleicao = Math.max(0, Math.ceil((new Date(2026, 9, 4).getTime() - Date.now()) / 86400000));
  const faltam = metaScopeTotal > 0 ? Math.max(0, metaScopeTotal - eleitoresFiltrados.length) : 0;
  const vaiBater = ritmoAtual > 0 && faltam > 0 ? Math.ceil(faltam / ritmoAtual) <= diasParaEleicao : faltam === 0 && metaScopeTotal > 0;
  const percentualMeta = metaScopeTotal > 0 ? Math.min(100, Math.round((eleitoresFiltrados.length / metaScopeTotal) * 100)) : 0;
  const necessarioPorDia = diasParaEleicao > 0 && faltam > 0 ? Math.ceil(faltam / diasParaEleicao) : 0;
  const mostrarInteligencia = !isSuperOrMaster(userData) && (sfp !== null || ic !== null || colabsParaAnalise.length > 0 || metaScopeTotal > 0);

  return (
    <div className="space-y-6 animate-in">
      {/* SEÇÃO PREMIUM — SUPER ADMIN */}
      {isSuperOrMaster(userData) && (
        <>
          {/* Cabeçalho Executivo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-lg">🔱</div>
              <div>
                <h1 className="text-2xl font-bold text-white">Central de Comando</h1>
                <p className="text-sm text-rose-400">Painel executivo da plataforma</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/30">
              <Clock size={12} />
              <span>Última atualização: {minutosAtras <= 1 ? "agora" : `há ${minutosAtras} min`}</span>
            </div>
          </div>

          {/* Alertas Inteligentes */}
          {alertas.length > 0 && (
            <GlassCard className="p-4 border-amber-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Bell size={16} className="text-amber-400" />
                <h3 className="text-white font-semibold text-sm">Alertas</h3>
                <span className="text-xs text-amber-400/70">({alertas.length})</span>
              </div>
              <div className="space-y-2">
                {alertas.map((a, i) => (
                  <div key={i} className={`flex items-center justify-between gap-3 p-2.5 rounded-xl ${
                    a.tipo === "erro" ? "bg-red-500/10 border border-red-500/20" :
                    a.tipo === "alerta" ? "bg-amber-500/10 border border-amber-500/20" :
                    "bg-blue-500/10 border border-blue-500/20"
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-lg ${a.tipo === "erro" ? "text-red-400" : a.tipo === "alerta" ? "text-amber-400" : "text-blue-400"}`}>
                        {a.tipo === "erro" ? "🔴" : a.tipo === "alerta" ? "🟡" : "🔵"}
                      </span>
                      <span className={`text-sm ${a.tipo === "erro" ? "text-red-300" : a.tipo === "alerta" ? "text-amber-300" : "text-blue-300"}`}>
                        {a.mensagem}
                      </span>
                    </div>
                    {a.link && (
                      <a href={a.link} className="shrink-0 text-xs text-white/50 hover:text-white transition-colors px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10">
                        {a.acao || "Ver"}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Ações Rápidas */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-emerald-400" />
              <h3 className="text-white font-semibold text-sm">Ações Rápidas</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <a href="/campanhas" className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] transition-all">
                <PlusCircle size={18} className="text-rose-400" />
                <span className="text-sm text-white/70">Novo Gabinete</span>
              </a>
              <a href="/solicitacoes" className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] transition-all">
                <Eye size={18} className="text-amber-400" />
                <span className="text-sm text-white/70">Solicitações{solicitacoesPendentes > 0 ? ` (${solicitacoesPendentes})` : ""}</span>
              </a>
              <a href="/relatorios" className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] transition-all">
                <FileSpreadsheet size={18} className="text-emerald-400" />
                <span className="text-sm text-white/70">Relatórios</span>
              </a>
              <a href="/configuracoes" className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] transition-all">
                <Settings size={18} className="text-purple-400" />
                <span className="text-sm text-white/70">Configurações</span>
              </a>
            </div>
          </GlassCard>

          {/* Panorama Executivo */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-blue-400" />
              <h3 className="text-white font-semibold text-sm">Panorama Executivo</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-xl bg-white/[0.03]">
                <p className="text-2xl font-bold text-white">{gabinetes.filter((g: any) => g.ativo).length}</p>
                <p className="text-xs text-white/40">Gabinetes ativos</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/[0.03]">
                <p className="text-2xl font-bold text-emerald-400">{colaboradoresAtivos}</p>
                <p className="text-xs text-white/40">Colaboradores ativos</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/[0.03]">
                <p className="text-2xl font-bold text-blue-400">{eleitores.length}</p>
                <p className="text-xs text-white/40">Total de eleitores</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/[0.03]">
                <p className="text-2xl font-bold text-amber-400">{colaboradoresPendentes}</p>
                <p className="text-xs text-white/40">Pendentes</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/[0.03]">
                <p className="text-2xl font-bold text-white">{usuarios.filter((u) => u.role === "coordenador" || u.role === "assessor").length}</p>
                <p className="text-xs text-white/40">Gestores</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/[0.03]">
                <p className="text-2xl font-bold text-emerald-400">{gabinetes.length}</p>
                <p className="text-xs text-white/40">Total gabinetes</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/[0.03]">
                <p className="text-2xl font-bold text-blue-400">{colaboradoresAtivos > 0 ? (eleitores.length / colaboradoresAtivos).toFixed(1) : 0}</p>
                <p className="text-xs text-white/40">Média/colaborador</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/[0.03]">
                <p className="text-2xl font-bold text-amber-400">{cadastrosHoje.length}</p>
                <p className="text-xs text-white/40">Cadastros hoje</p>
              </div>
            </div>
          </GlassCard>
        </>
      )}

      {/* ALERTAS: Assessor e Coordenador */}
      {!isSuperOrMaster(userData) && alertas.length > 0 && (
        <GlassCard className="p-4 border-amber-500/20">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={16} className="text-amber-400" />
            <h3 className="text-white font-semibold text-sm">Alertas operacionais</h3>
            <span className="text-xs text-amber-400/70">({alertas.length})</span>
          </div>
          <div className="space-y-2">
            {alertas.map((a, i) => (
              <div key={i} className={`flex items-center justify-between gap-3 p-2.5 rounded-xl ${
                a.tipo === "erro" ? "bg-red-500/10 border border-red-500/20" :
                a.tipo === "alerta" ? "bg-amber-500/10 border border-amber-500/20" :
                "bg-blue-500/10 border border-blue-500/20"
              }`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span>{a.tipo === "erro" ? "🔴" : a.tipo === "alerta" ? "🟡" : "🔵"}</span>
                  <span className={`text-sm truncate ${a.tipo === "erro" ? "text-red-300" : a.tipo === "alerta" ? "text-amber-300" : "text-blue-300"}`}>
                    {a.mensagem}
                  </span>
                </div>
                {a.link && (
                  <a href={a.link} className="shrink-0 text-xs text-white/50 hover:text-white transition-colors px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10">
                    {a.acao || "Ver"}
                  </a>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

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

      {/* CABEÇALHO: Coordenador */}
      {isCoordenador(userData) && (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-lg">🎯</div>
          <div>
            <h1 className="text-2xl font-bold text-white">Painel de Supervisão</h1>
            <p className="text-sm text-blue-400">{userData.nome} • Gerencie sua equipe e produtividade</p>
          </div>
        </div>
      )}

      {/* CABEÇALHO: Colaborador */}
      {isColaborador(userData) && (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-lg">⚡</div>
          <div>
            <h1 className="text-2xl font-bold text-white">Meu Painel</h1>
            <p className="text-sm text-emerald-400">{userData.nome} • Acompanhe sua meta e cadastros</p>
          </div>
        </div>
      )}

      {/* CABEÇALHO: Super Admin (já tem o próprio) */}

      {/* BANNER INFORMATIVO */}
      <div className={`p-4 rounded-2xl border ${roleInfo.border} ${roleInfo.bg} flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-3">
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
              {isAssessor(userData) && `${eleitores.length} eleitores • ${meusCoordIds.length} coordenadores • ${usuarios.filter(u => u.role === 'colaborador' && meusCoordIds.includes(u.coordenadorId || '')).length} colaboradores`}
              {isCoordenador(userData) && `${eleitores.length} eleitores • ${colaboradoresEquipe.filter(u => u.role === 'colaborador').length} colaboradores na equipe`}
              {isColaborador(userData) && `${eleitores.length} cadastros realizados`}
              {isSuperOrMaster(userData) && `${eleitores.length} eleitores no total`}
            </p>
          </div>
        </div>
        {(isSuperOrMaster(userData) || isPolitico(userData) || isPrefeito(userData) || isVereador(userData) || isAssessor(userData)) && (
          <button
            onClick={() => {
              exportRelatorioExecutivo(
                eleitores,
                gabineteNome || "Relatório",
                gabinetePartido,
                gabineteNome,
                undefined,
                gabineteCargo,
                cadastrosHoje.length > 0 ? `+${cadastrosHoje.length} hoje` : undefined,
                cidadesArray.slice(0, 5),
                rankingArray.slice(0, 5),
              );
              toast.success("Relatório executivo gerado!");
            }}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all"
          >
            <FileSpreadsheet size={14} />
            Relatório Executivo
          </button>
        )}
      </div>

      {/* SUA COALIZÃO — Inserida aqui, após os cards e antes dos filtros */}
      {(isPolitico(userData) || isAssessor(userData)) && gabinetesFilhos.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-sm">🌐</div>
            <div>
              <h2 className="text-lg font-bold text-white">Sua Coalizão</h2>
              <p className="text-xs text-amber-400/70">Visão estratégica dos gabinetes aliados</p>
            </div>
          </div>

          <GlassCard className="p-4 border-amber-500/20">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-xl bg-white/[0.03]">
                <p className="text-xs text-white/40 mb-1">Seu gabinete</p>
                <p className="text-2xl font-bold text-white">{eleitores.length}</p>
                <p className="text-xs text-white/30">eleitores</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/[0.03]">
                <p className="text-xs text-white/40 mb-1">Aliados</p>
                <p className="text-2xl font-bold text-amber-400">{eleitoresFilhos.length}</p>
                <p className="text-xs text-white/30">eleitores</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/[0.03]">
                <p className="text-xs text-white/40 mb-1">Total da coalizão</p>
                <p className="text-2xl font-bold text-emerald-400">{eleitores.length + eleitoresFilhos.length}</p>
                <p className="text-xs text-white/30">eleitores</p>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-2xl font-bold text-white">{gabinetesFilhos.length}</p>
              <p className="text-xs text-white/40">Aliados</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-2xl font-bold text-emerald-400">{eleitoresFilhos.length}</p>
              <p className="text-xs text-white/40">Eleitores dos aliados</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-2xl font-bold text-blue-400">{gabinetesFilhos.length > 0 ? Math.round(eleitoresFilhos.length / gabinetesFilhos.length) : 0}</p>
              <p className="text-xs text-white/40">Média por aliado</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-2xl font-bold text-amber-400">{eleitoresFilhos.filter((e) => parseDate(e.criadoEm).toLocaleDateString("pt-BR") === hoje).length}</p>
              <p className="text-xs text-white/40">Cadastros hoje (aliados)</p>
            </div>
          </div>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-amber-400" />
              <h3 className="text-white font-semibold">Ranking de Aliados</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 border-b border-white/[0.06]">
                    <th className="text-left py-3 px-2 font-medium">Gabinete</th>
                    <th className="text-left py-3 px-2 font-medium">Cargo</th>
                    <th className="text-left py-3 px-2 font-medium">Partido</th>
                    <th className="text-left py-3 px-2 font-medium">Eleitores</th>
                    <th className="text-left py-3 px-2 font-medium">Fortes</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {gabinetesFilhos
                    .map((g: any) => {
                      const eFilhos = eleitoresFilhos.filter((e) => e.campanhaId === g.id);
                      const fortes = eFilhos.filter((e) => e.grauApoio === "forte").length;
                      return { ...g, totalEleitores: eFilhos.length, fortes };
                    })
                    .sort((a: any, b: any) => b.totalEleitores - a.totalEleitores)
                    .map((g: any) => (
                      <tr key={g.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: `#${getPartyColors(g.politicoPartido).p}` }}>{g.nome.charAt(0)}</div>
                            <span className="text-white/80 font-medium">{g.nome}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-white/60">{g.cargo?.replace(/_/g, " ")}</td>
                        <td className="py-3 px-2">
                          {g.politicoPartido && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ background: `#${getPartyColors(g.politicoPartido).a}`, color: `#${getPartyColors(g.politicoPartido).d}` }}>
                              {g.politicoPartido}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-white/80 font-medium">{g.totalEleitores}</td>
                        <td className="py-3 px-2 text-emerald-400">{g.fortes}</td>
                        <td className="py-3 px-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${g.totalEleitores > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-500/20 text-gray-400"}`}>
                            {g.totalEleitores > 0 ? "Ativo" : "Sem dados"}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <p className="text-center text-[10px] text-white/20 -mt-2">Você acompanha — eles operam. Autonomia operacional dos aliados preservada.</p>
        </>
      )}

      {/* FILTROS TERRITORIAIS */}
      {(isSuperOrMaster(userData) || isPolitico(userData) || isPrefeito(userData) || isAssessor(userData)) && (estadosDisponiveis.length > 0 || bairrosDisponiveis.length > 0) && (
        <div className="flex items-center gap-3 flex-wrap">
          <Filter size={16} className="text-white/30" />
          {(isSuperOrMaster(userData) || isPolitico(userData) || isAssessor(userData)) && estadosDisponiveis.length > 0 && (
            <Select
              label="Estado"
              value={filtroEstado}
              onChange={(e) => { setFiltroEstado(e.target.value); setFiltroCidade(""); setFiltroBairro(""); }}
              options={[{ value: "", label: "Todos os estados" }, ...estadosDisponiveis.map((s) => ({ value: s, label: s }))]}
            />
          )}
          {(isSuperOrMaster(userData) || isPolitico(userData) || isAssessor(userData)) && cidadesDisponiveis.length > 0 && (
            <Select
              label="Cidade"
              value={filtroCidade}
              onChange={(e) => { setFiltroCidade(e.target.value); setFiltroBairro(""); }}
              options={[{ value: "", label: "Todas as cidades" }, ...cidadesDisponiveis.map((c) => ({ value: c, label: c }))]}
            />
          )}
          {(isPrefeito(userData) || isPolitico(userData) || isAssessor(userData)) && bairrosDisponiveis.length > 0 && (
            <Select
              label="Bairro"
              value={filtroBairro}
              onChange={(e) => setFiltroBairro(e.target.value)}
              options={[{ value: "", label: "Todos os bairros" }, ...bairrosDisponiveis.map((b) => ({ value: b, label: b }))]}
            />
          )}
        </div>
      )}

      {/* CARDS DE INDICADORES POR ROLE */}
      {isColaborador(userData) ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="Meus Cadastros" value={eleitoresFiltrados.length} icon={<Users size={20} />} trend={cadastrosHoje.length > 0 ? { value: `+${cadastrosHoje.length} hoje`, positive: true } : undefined} delay={0} />
          <StatCard title="Cadastros Hoje" value={cadastrosHoje.length} icon={<UserPlus size={20} />} delay={100} />
          <StatCard title="Minha Meta" value={minhaMeta > 0 ? `${progressoMeta}%` : "⚡"} icon={<Target size={20} />} delay={200} />
        </div>
      ) : isCoordenador(userData) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Apoiadores da Equipe" value={eleitoresFiltrados.length} icon={<Users size={20} />} trend={cadastrosHoje.length > 0 ? { value: `+${cadastrosHoje.length} hoje`, positive: true } : undefined} delay={0} />
          <StatCard title="Cadastros Hoje" value={cadastrosHoje.length} icon={<UserPlus size={20} />} delay={100} />
          <StatCard title="Colaboradores na Equipe" value={colaboradoresPorCoordenador} icon={<Target size={20} />} delay={200} />
          <StatCard title="Cidade Mais Forte" value={topCidade ? topCidade[0] : "-"} icon={<MapPin size={20} />} delay={300} />
        </div>
      ) : isAssessor(userData) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total de Apoiadores" value={eleitoresFiltrados.length} icon={<Users size={20} />} trend={cadastrosHoje.length > 0 ? { value: `+${cadastrosHoje.length} hoje`, positive: true } : undefined} delay={0} />
          <StatCard title="Cadastros Hoje" value={cadastrosHoje.length} icon={<UserPlus size={20} />} delay={100} />
          <StatCard title="Coordenadores" value={usuarios.filter(u => u.role === 'coordenador').length} icon={<Target size={20} />} delay={200} />
          <StatCard title="Colaboradores" value={usuarios.filter(u => u.role === 'colaborador' && (!u.status || u.status === 'ativo')).length} icon={<Medal size={20} />} delay={300} />
        </div>
      ) : isPolitico(userData) || isPrefeito(userData) || isVereador(userData) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title={isPrefeito(userData) ? "Eleitores do Município" : "Total de Eleitores"} value={eleitoresFiltrados.length} icon={<Users size={20} />} trend={cadastrosHoje.length > 0 ? { value: `+${cadastrosHoje.length} hoje`, positive: true } : undefined} delay={0} />
          <StatCard title="Cadastros Hoje" value={cadastrosHoje.length} icon={<UserPlus size={20} />} delay={100} />
          <StatCard title="Cidade Mais Forte" value={topCidade ? topCidade[0] : "-"} icon={<MapPin size={20} />} delay={200} />
          <StatCard title={isPolitico(userData) ? "Expansão Territorial" : isPrefeito(userData) ? "Bairros Ativos" : "Penetração Local"} value={isPolitico(userData) ? `${cidadesArray.length} cidades` : isPrefeito(userData) ? `${bairrosDisponiveis.length} bairros` : `${cidadesArray.length} áreas`} icon={<Medal size={20} />} delay={300} />
        </div>
      ) : null}

      {/* INTELIGÊNCIA ELEITORAL */}
      {mostrarInteligencia && (
        <GlassCard className="p-5 border-indigo-500/10">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-indigo-400" />
            <h3 className="text-white font-semibold text-sm">Inteligência Eleitoral</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sfp && (
              <div className={`p-4 rounded-xl ${sfp.bg} border border-white/[0.06]`}>
                <p className="text-xs text-white/40 mb-1">Força Política</p>
                <p className={`text-xl font-bold ${sfp.cor}`}>{sfp.label}</p>
                <p className="text-xs text-white/40 mt-1">{sfp.score.toFixed(2)} pts · {sfp.total} eleitores</p>
                <div className="mt-2 w-full bg-white/[0.05] rounded-full h-1">
                  <div className={`h-1 rounded-full transition-all ${sfp.dot}`} style={{ width: `${Math.min(100, (sfp.score / 3) * 100)}%` }} />
                </div>
              </div>
            )}
            {ic && (
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs text-white/40 mb-1">Crescimento Semanal</p>
                <p className={`text-xl font-bold ${ic.cor}`}>{ic.seta} {ic.variacao > 0 ? "+" : ""}{ic.variacao}%</p>
                <p className="text-xs text-white/40 mt-1">{ic.atual} esta semana · {ic.anterior} anterior</p>
                <p className={`text-xs mt-0.5 capitalize ${ic.cor}`}>{ic.direcao}</p>
              </div>
            )}
            {metaScopeTotal > 0 && (isAssessor(userData) || isCoordenador(userData)) && (
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs text-white/40 mb-1">Projeção de Meta</p>
                <p className={`text-xl font-bold ${faltam === 0 ? "text-emerald-400" : vaiBater ? "text-emerald-400" : "text-amber-400"}`}>
                  {percentualMeta}%
                </p>
                <p className="text-xs text-white/40 mt-1">{ritmoAtual}/dia · meta {metaScopeTotal}</p>
                <p className={`text-xs mt-0.5 ${faltam === 0 ? "text-emerald-400/70" : vaiBater ? "text-emerald-400/70" : "text-amber-400/70"}`}>
                  {faltam === 0 ? "✓ Meta atingida!" : vaiBater ? `✓ No ritmo (${diasParaEleicao}d restantes)` : `⚠ Precisa ${necessarioPorDia}/dia`}
                </p>
              </div>
            )}
            {colabsParaAnalise.length > 0 && (
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs text-white/40 mb-1">Saúde da Equipe</p>
                <p className="text-xl font-bold text-white">{colabsParaAnalise.length} <span className="text-sm font-normal text-white/40">colab.</span></p>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5">
                  {saudeAtivos > 0   && <span className="text-xs text-emerald-400">{saudeAtivos} ativos</span>}
                  {saudeAtencao > 0  && <span className="text-xs text-amber-400">{saudeAtencao} atenção</span>}
                  {saudeParados > 0  && <span className="text-xs text-orange-400">{saudeParados} parados</span>}
                  {saudeInativos > 0 && <span className="text-xs text-red-400">{saudeInativos} inativos</span>}
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {isColaborador(userData) ? (
        <>
          {/* Meta pessoal com progresso circular simplificado */}
          {minhaMeta > 0 && (
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target size={18} className="text-emerald-400" />
                <h3 className="text-white font-semibold">Minha Meta</h3>
              </div>
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#10b981" strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 42}`}
                      strokeDashoffset={`${2 * Math.PI * 42 * (1 - Math.min(progressoMeta / 100, 1))}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">{eleitores.length}</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/60">Meta: <span className="text-white font-medium">{minhaMeta}</span> cadastros</span>
                    <span className="text-sm text-emerald-400 font-medium">{progressoMeta}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(progressoMeta, 100)}%` }} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-white/40 pt-1">
                    <span>📊 {eleitores.length} de {minhaMeta}</span>
                    <span>📅 {cadastrosHoje.length} hoje</span>
                    <span>📈 +{crescimentoArray.length > 1 ? eleitores.filter(e => parseDate(e.criadoEm).getTime() > Date.now() - 7*24*60*60*1000).length : 0} na semana</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Últimos cadastros simplificado */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus size={18} className="text-emerald-400" />
              <h3 className="text-white font-semibold">Meus Últimos Cadastros</h3>
              <span className="text-xs text-white/30 ml-auto">{eleitores.length} total</span>
            </div>
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
                  {eleitores.length === 0 && <tr><td colSpan={4} className="py-4"><EmptyState icon="📋" title="Nenhum cadastro ainda" description="Vá em Novo Cadastro para começar" action={{ label: "Ir para Novo Cadastro", href: "/eleitores" }} /></td></tr>}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      ) : null}

      {/* GRÁFICOS E TABELAS POR ROLE */}
      {isCoordenador(userData) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {crescimentoArray.length > 0 && <CrescimentoDiario data={crescimentoArray} />}
          {cidadesArray.length > 0 && <ApoiadoresPorCidade data={cidadesArray.slice(0, 10)} />}
        </div>
      )}

      {isAssessor(userData) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {crescimentoArray.length > 0 && <CrescimentoDiario data={crescimentoArray} />}
            {cidadesArray.length > 0 && <ApoiadoresPorCidade data={cidadesArray.slice(0, 10)} />}
            {rankingArray.length > 0 && <RankingColaboradores data={rankingArray} />}
            {estadosArray.length > 0 && <ApoiadoresPorEstado data={estadosArray} />}
          </div>

          {/* Solicitações pendentes para o assessor */}
          {solicitacoesPendentes > 0 && (
            <GlassCard className="p-4 border-amber-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-amber-400" />
                  <span className="text-sm text-white/80"><span className="text-amber-400 font-semibold">{solicitacoesPendentes}</span> solicitação{`${solicitacoesPendentes > 1 ? "ões" : ""}`} de colaborador{`${solicitacoesPendentes > 1 ? "es" : ""}`} pendente{`${solicitacoesPendentes > 1 ? "s" : ""}`}</span>
                </div>
                <a href="/solicitacoes" className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">Ver solicitações</a>
              </div>
            </GlassCard>
          )}

          <GlassCard className="p-5">
            <h3 className="text-white font-semibold mb-4">Últimos Cadastros</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-white/40 border-b border-white/[0.06]"><th className="text-left py-3 px-2 font-medium">Nome</th><th className="text-left py-3 px-2 font-medium">Cidade</th><th className="text-left py-3 px-2 font-medium">Grau</th><th className="text-left py-3 px-2 font-medium">Colaborador</th><th className="text-left py-3 px-2 font-medium">Coordenador</th><th className="text-left py-3 px-2 font-medium">Data</th></tr></thead>
                <tbody>
                  {eleitores.slice(0, 15).map((e) => (
                    <tr key={e.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-2 text-white/80">{e.nomeCompleto}</td><td className="py-3 px-2 text-white/60">{e.cidade}</td>
                      <td className="py-3 px-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.grauApoio === "forte" ? "bg-emerald-500/20 text-emerald-400" : e.grauApoio === "medio" ? "bg-amber-500/20 text-amber-400" : e.grauApoio === "fraco" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>{e.grauApoio}</span></td>
                      <td className="py-3 px-2 text-white/60">{e.colaboradorNome}</td><td className="py-3 px-2 text-white/60">{e.coordenadorNome || "-"}</td><td className="py-3 px-2 text-white/40 text-xs">{formatDate(e.criadoEm)}</td>
                    </tr>
                  ))}
                  {eleitores.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-white/30">Nenhum cadastro encontrado</td></tr>}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}

      {(isPolitico(userData) || isPrefeito(userData) || isVereador(userData)) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {crescimentoArray.length > 0 && <CrescimentoDiario data={crescimentoArray} />}
            {isPolitico(userData) && cidadesArray.length > 0 && <ApoiadoresPorCidade data={cidadesArray.slice(0, 10)} />}
            {isPrefeito(userData) && cidadesArray.length > 0 && <ApoiadoresPorCidade data={cidadesArray.slice(0, 10)} />}
            {isVereador(userData) && cidadesArray.length > 0 && <ApoiadoresPorCidade data={cidadesArray.slice(0, 10)} />}
            {estadosArray.length > 0 && <ApoiadoresPorEstado data={estadosArray} />}
          </div>

          <GlassCard className="p-5">
            <h3 className="text-white font-semibold mb-4">Visão Geral</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-white/40 border-b border-white/[0.06]"><th className="text-left py-3 px-2 font-medium">Cidade</th><th className="text-left py-3 px-2 font-medium">Total</th><th className="text-left py-3 px-2 font-medium">Fortes</th><th className="text-left py-3 px-2 font-medium">Médios</th><th className="text-left py-3 px-2 font-medium">Fracos</th><th className="text-left py-3 px-2 font-medium">Penetração</th></tr></thead>
                <tbody>
                  {cidadesArray.slice(0, 10).map((c) => {
                    const fortes = eleitoresFiltrados.filter((e) => e.cidade === c.cidade && e.grauApoio === "forte").length;
                    const medios = eleitoresFiltrados.filter((e) => e.cidade === c.cidade && e.grauApoio === "medio").length;
                    const fracos = eleitoresFiltrados.filter((e) => e.cidade === c.cidade && e.grauApoio === "fraco").length;
                    const penetracao = cidadesDisponiveis.length > 0 ? Math.round((c.total / eleitoresFiltrados.length) * 100) : 0;
                    return (
                      <tr key={c.cidade} className="border-b border-white/[0.03]">
                        <td className="py-3 px-2 text-white/80 font-medium">{c.cidade}</td>
                        <td className="py-3 px-2 text-white/60">{c.total}</td>
                        <td className="py-3 px-2 text-emerald-400">{fortes}</td>
                        <td className="py-3 px-2 text-amber-400">{medios}</td>
                        <td className="py-3 px-2 text-red-400">{fracos}</td>
                        <td className="py-3 px-2 text-white/60">{penetracao}%</td>
                      </tr>
                    );
                  })}
                  {cidadesArray.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-white/30">Nenhum dado disponível</td></tr>}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}

    </div>
  );
}

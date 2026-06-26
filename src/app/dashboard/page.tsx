"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, getDoc, doc, query, orderBy, where, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Eleitor, AppUser, ROLE_CONFIG } from "@/types";
import { getRoleConfig, isSuperOrMaster, isPolitico, isPrefeito, isVereador, isAssessor, isAssessorExecutivo, isCoordenador, isColaborador } from "@/lib/permissions";
import { DashboardExecutivo } from "./DashboardExecutivo";
import { getPartyColors, exportRelatorioExecutivo } from "@/lib/reports";
import { buscarEleitoresPorGabinetes, queryInChunks } from "@/lib/firestore";
import { Users, UserPlus, TrendingUp, MapPin, Medal, Target, Crown, Zap, Filter, AlertTriangle, Bell, Clock, Eye, PlusCircle, FileSpreadsheet, Settings, Shield, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/dashboard/StatCard";
import dynamic from "next/dynamic";
const ApoiadoresPorCidade = dynamic(() => import("@/components/charts/ApoiadoresPorCidade").then(m => ({ default: m.ApoiadoresPorCidade })), { ssr: false });
const ApoiadoresPorBairro = dynamic(() => import("@/components/charts/ApoiadoresPorBairro").then(m => ({ default: m.ApoiadoresPorBairro })), { ssr: false });
const CrescimentoDiario = dynamic(() => import("@/components/charts/CrescimentoDiario").then(m => ({ default: m.CrescimentoDiario })), { ssr: false });
const RankingColaboradores = dynamic(() => import("@/components/charts/RankingColaboradores").then(m => ({ default: m.RankingColaboradores })), { ssr: false });
const ApoiadoresPorEstado = dynamic(() => import("@/components/charts/ApoiadoresPorEstado").then(m => ({ default: m.ApoiadoresPorEstado })), { ssr: false });
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, parseDate } from "@/lib/utils";
import { calcularSaudeColaborador, calcularIC, calcularSFPSimples, criarPendencia, ordenarPendencias, getResumoPendencias, getProximaEtapa, executarMotorTerritorial, TerritorioPolitico } from "@/lib/inteligencia";
import { PainelExecucao, ExecucaoItem } from "@/components/politico/PainelExecucao";
import { CentralDecisoes, DecisaoPolitica } from "@/components/politico/CentralDecisoes";
import { AgendaExecutiva, AgendaItem } from "@/components/politico/AgendaExecutiva";
import { CentralAlertas, AlertaExecutivo } from "@/components/politico/CentralAlertas";
import { MemoriaMandato, EventoMandato } from "@/components/politico/MemoriaMandato";
import toast from "react-hot-toast";
import { criarNotificacao } from "@/lib/notificacoes";

export default function DashboardPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [gabineteNome, setGabineteNome] = useState("");
  const [gabineteCargo, setGabineteCargo] = useState("");
  const [gabinetePartido, setGabinetePartido] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroCidade, setFiltroCidade] = useState("");
  const [filtroBairro, setFiltroBairro] = useState("");
  const [filtroAssessorId, setFiltroAssessorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [gabinetes, setGabinetes] = useState<any[]>([]);
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState(0);
  const [minhaMeta, setMinhaMeta] = useState(0);
  const [metasPorColaborador, setMetasPorColaborador] = useState<Record<string, number>>({});
  const [gabinetesFilhos, setGabinetesFilhos] = useState<any[]>([]);
  const [eleitoresFilhos, setEleitoresFilhos] = useState<Eleitor[]>([]);
  const [meusCoordIds, setMeusCoordIds] = useState<string[]>([]);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date>(new Date());
  const [filtroQualidade, setFiltroQualidade] = useState("");
  const [modalPendencia, setModalPendencia] = useState<string | null>(null);
  const [modalEstabDash, setModalEstabDash] = useState(false);
  const [assessoriasCriadas, setAssessoriasCriadas] = useState<Set<string>>(new Set());
  const [coordenacoesCriadas, setCoordenacoesCriadas] = useState<Set<string>>(new Set());
  const [modalDeterminacao, setModalDeterminacao] = useState<{ territorio: string; acao: string; assessorNome: string } | null>(null);
  const [determinacaoForm, setDeterminacaoForm] = useState({ assunto: "", prioridade: "Alta", prazo: 7, descricao: "" });
  const [determinacaoEnviando, setDeterminacaoEnviando] = useState(false);
  const [determinacoes, setDeterminacoes] = useState<any[]>([]);
  const [abaDeterminacao, setAbaDeterminacao] = useState<"pendente" | "em_andamento" | "concluida">("pendente");

  // Auto-switch para a tab com conteúdo quando a ativa fica vazia
  useEffect(() => {
    if (!determinacoes.length) return;
    const counts = { pendente: 0, em_andamento: 0, concluida: 0 } as Record<string, number>;
    determinacoes.forEach((d) => { if (d.status in counts) counts[d.status]++; });
    if (counts[abaDeterminacao] === 0) {
      if (counts.em_andamento > 0) setAbaDeterminacao("em_andamento");
      else if (counts.concluida > 0) setAbaDeterminacao("concluida");
    }
  }, [determinacoes]);

  useEffect(() => {
    async function load() {
      try {
        // Executivo tem DashboardExecutivo próprio — não carrega dados aqui
        if (isAssessorExecutivo(userData)) { setLoading(false); return; }

        const gabId = userData?.campanhaId || userData?.gabineteId;
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

        // Redirecionar para onboarding se politico sem assessores (primeira vez)
        if (isPolitico(userData)) {
          const temAssessores = usuariosSnap.docs.some((d: any) => d.data().role === "assessor");
          if (!temAssessores && typeof window !== "undefined" && !localStorage.getItem("onboarding_completo")) {
            router.push("/onboarding");
            setLoading(false);
            return;
          }
        }

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
            const extra = gabId ? [where("campanhaId", "==", gabId)] : [];
            const docs = await queryInChunks(collection(db, "eleitores"), "coordenadorId", coordIds, extra);
            setEleitores(docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor)));
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
        // Metas — usuários não-admin sem gabId não executam query sem filtro
        let mSnap: { docs: any[] } = { docs: [] };
        if (isSuperOrMaster(userData)) {
          mSnap = await getDocs(query(collection(db, "metas")));
        } else if (isColaborador(userData)) {
          mSnap = await getDocs(query(collection(db, "metas"), where("colaboradorId", "==", userData!.uid)));
        } else if (gabId) {
          mSnap = await getDocs(query(collection(db, "metas"), where("gabineteId", "==", gabId)));
        }
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
        // Assessorias ativas — para o motor perceber municípios com cobertura real
        if (isPolitico(userData)) {
          try {
            const aSnap = await getDocs(query(collection(db, "assessorias"), where("campanhaId", "==", userData?.campanhaId || userData?.gabineteId), where("status", "==", "ativa")));
            setAssessoriasCriadas(new Set(aSnap.docs.map((d) => d.data().municipio as string).filter(Boolean)));
          } catch (e) { console.error("assessorias:", e); setAssessoriasCriadas(new Set()); }
        }
        // Coordenações ativas — para o motor perceber municípios com coordenação real
        if (isPolitico(userData)) {
          try {
            const cSnap = await getDocs(query(collection(db, "coordenacoes"), where("campanhaId", "==", userData?.campanhaId || userData?.gabineteId), where("status", "==", "ativa")));
            setCoordenacoesCriadas(new Set(cSnap.docs.map((d) => d.data().municipio as string).filter(Boolean)));
          } catch (e) { console.error("coordenacoes:", e); setCoordenacoesCriadas(new Set()); }
        }

        // Determinações do Deputado (P6 — Sprint 20)
        if (isPolitico(userData)) {
          try {
            const dSnap = await getDocs(query(collection(db, "determinacoes"), where("campanhaId", "==", userData?.campanhaId || userData?.gabineteId || ""), where("criadoPorId", "==", userData?.uid || "")));
            setDeterminacoes(dSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
          } catch (e) { console.error("determinacoes:", e); setDeterminacoes([]); }
        }

        setUltimaAtualizacao(new Date());
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    if (userData) load();
  }, [userData]);

  const territoriosReais = useMemo<TerritorioPolitico[]>(() => {
    if (!userData || !isPolitico(userData) || eleitores.length === 0) return [];
    const cidadeMap = new Map<string, Eleitor[]>();
    for (const e of eleitores) {
      if (!e.cidade) continue;
      if (!cidadeMap.has(e.cidade)) cidadeMap.set(e.cidade, []);
      cidadeMap.get(e.cidade)!.push(e);
    }
    return Array.from(cidadeMap.entries()).map(([cidade, grupo]) => ({
      cidade,
      eleitores:         grupo.length,
      fortes:            grupo.filter((e) => e.grauApoio === "forte").length,
      medios:            grupo.filter((e) => e.grauApoio === "medio").length,
      indecisos:         grupo.filter((e) => e.grauApoio === "indeciso").length,
      fracos:            grupo.filter((e) => e.grauApoio === "fraco").length,
      crescimento30d: (() => {
        const agora = Date.now();
        const ultimos30 = grupo.filter((e) => parseDate(e.criadoEm).getTime() > agora - 30 * 86400000).length;
        const prev30    = grupo.filter((e) => { const t = parseDate(e.criadoEm).getTime(); return t > agora - 60 * 86400000 && t <= agora - 30 * 86400000; }).length;
        return prev30 > 0 ? Math.round(((ultimos30 - prev30) / prev30) * 100) : ultimos30 > 0 ? 100 : 0;
      })(),
      possuiAssessoria:  assessoriasCriadas.has(cidade) ||
                         usuarios.some((u) => u.role === "assessor" && u.ativo === true && (
                           (Array.isArray(u.cidades) && (u.cidades as string[]).includes(cidade)) ||
                           (u as any).cidade === cidade ||
                           (u as any).cidadePrincipal === cidade
                         )),
      possuiCoordenacao: coordenacoesCriadas.has(cidade) ||
                         usuarios.some((u) => u.role === "coordenador" && u.ativo === true && (
                           (u as any).cidadePrincipal === cidade ||
                           (u as any).cidade === cidade
                         )),
      assessorResponsavel: (() => {
        const a = usuarios.find((u) => u.role === "assessor" && u.ativo === true && (
          (Array.isArray(u.cidades) && (u.cidades as string[]).includes(cidade)) ||
          (u as any).cidade === cidade ||
          (u as any).cidadePrincipal === cidade
        ));
        return a?.nome || "";
      })(),
      diasSemNovoCadastro: (() => {
        const datas = grupo.map((e) => parseDate(e.criadoEm).getTime()).filter(Boolean);
        if (datas.length === 0) return 0;
        const ultimo = Math.max(...datas);
        return Math.floor((Date.now() - ultimo) / 86400000);
      })(),
      colaboradoresCount: usuarios.filter((u) => u.role === "colaborador" && (u as any).cidadePrincipal === cidade).length,
      novosEleitores30d: grupo.filter((e) => parseDate(e.criadoEm).getTime() > Date.now() - 30 * 86400000).length,
    }));
  }, [eleitores, assessoriasCriadas, coordenacoesCriadas, usuarios, userData]);

  const coordsDoAssessorFiltro = useMemo(() => {
    if (!filtroAssessorId) return null;
    return new Set(
      usuarios.filter((u) => u.role === "coordenador" && (u as any).assessorId === filtroAssessorId).map((u) => u.uid)
    );
  }, [filtroAssessorId, usuarios]);

  if (!userData) return null;

  // Assessor Executivo tem dashboard próprio — não usa o fluxo genérico abaixo
  if (isAssessorExecutivo(userData)) return <DashboardExecutivo userData={userData} />;

  const config = getRoleConfig(userData);
  const roleInfo = ROLE_CONFIG[userData.role];

  // Aplicar filtros
  const eleitoresFiltrados = eleitores.filter((e) => {
    if (filtroEstado && e.estado !== filtroEstado) return false;
    if (filtroCidade && e.cidade !== filtroCidade) return false;
    if (filtroBairro && e.bairro !== filtroBairro) return false;
    if (coordsDoAssessorFiltro && (!e.coordenadorId || !coordsDoAssessorFiltro.has(e.coordenadorId))) return false;
    return true;
  });

  const assessoresParaFiltro = isPolitico(userData) ? usuarios.filter((u) => u.role === "assessor") : [];

  const hoje = new Date().toLocaleDateString("pt-BR");
  const cadastrosHoje = eleitoresFiltrados.filter((e) => parseDate(e.criadoEm).toLocaleDateString("pt-BR") === hoje);

  const cidadeMap = eleitoresFiltrados.reduce<Record<string, number>>((acc, e) => { acc[e.cidade] = (acc[e.cidade] || 0) + 1; return acc; }, {});
  const topCidade = Object.entries(cidadeMap).sort((a, b) => b[1] - a[1])[0];

  const colaboradoresIds = new Set(usuarios.filter((u) => u.role === "colaborador").map((u) => u.uid));
  const ranking = eleitoresFiltrados.filter((e) => e.colaboradorId && colaboradoresIds.has(e.colaboradorId)).reduce<Record<string, number>>((acc, e) => { acc[e.colaboradorNome] = (acc[e.colaboradorNome] || 0) + 1; return acc; }, {});
  const rankingArray = Object.entries(ranking).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  const cidadesArray = Object.entries(cidadeMap).map(([cidade, total]) => ({ cidade, total })).sort((a, b) => b.total - a.total);

  const bairroMap = isCoordenador(userData)
    ? eleitoresFiltrados.reduce<Record<string, number>>((acc, e) => {
        const key = e.bairro ? `${e.bairro} · ${e.cidade}` : e.cidade;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    : {};
  const topBairro = (Object.entries(bairroMap).sort((a, b) => b[1] - a[1])[0] ?? null) as [string, number] | null;
  const territorioCoordenador = isCoordenador(userData)
    ? (userData.bairro && userData.cidade
        ? `${userData.bairro} · ${userData.cidade}`
        : userData.cidade || userData.cidadePrincipal || "")
    : "";

  const bairrosArray = isCoordenador(userData)
    ? Object.entries(
        eleitoresFiltrados.reduce<Record<string, number>>((acc, e) => {
          const key = e.bairro || e.cidade;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})
      ).map(([bairro, total]) => ({ bairro, total })).sort((a, b) => b.total - a.total)
    : [] as { bairro: string; total: number }[];

  const concentracaoBairro = isCoordenador(userData) && eleitoresFiltrados.length > 0 && bairrosArray.length > 0
    ? Math.round((bairrosArray[0].total / eleitoresFiltrados.length) * 100)
    : 0;
  const territorioConcentrado = concentracaoBairro >= 90;

  const estados = eleitoresFiltrados.reduce<Record<string, number>>((acc, e) => { acc[e.estado] = (acc[e.estado] || 0) + 1; return acc; }, {});
  const estadosArray = Object.entries(estados).map(([estado, total]) => ({ estado, total })).sort((a, b) => b.total - a.total);

  // Listas para filtros (selects dependentes em cascata: assessor → estado → cidade → bairro)
  const eleitoresBaseAssessor = filtroAssessorId && coordsDoAssessorFiltro
    ? eleitores.filter((e) => e.coordenadorId && coordsDoAssessorFiltro.has(e.coordenadorId))
    : eleitores;
  const estadosDisponiveis = [...new Set(eleitoresBaseAssessor.map((e) => e.estado).filter(Boolean))].sort();
  const eleitoresBaseCidade = filtroEstado ? eleitoresBaseAssessor.filter((e) => e.estado === filtroEstado) : eleitoresBaseAssessor;
  const cidadesDisponiveis = [...new Set(eleitoresBaseCidade.map((e) => e.cidade).filter(Boolean))].sort();
  const eleitoresBaseBairro = filtroCidade ? eleitoresBaseAssessor.filter((e) => e.cidade === filtroCidade) : filtroEstado ? eleitoresBaseAssessor.filter((e) => e.estado === filtroEstado) : eleitoresBaseAssessor;
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
  const totalColaboradores = usuarios.filter((u) => u.role === "colaborador" && u.status !== "recusado" && u.status !== "aprovado").length;
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
      alertas.push({ tipo: "alerta", mensagem: `${pendentesAssessor.length} novo${pendentesAssessor.length > 1 ? "s mobilizadores aguardando" : " mobilizador aguardando"} incorporação à equipe`, acao: "Ver solicitações", link: "/solicitacoes" });
    }
    const colabsAssessor = meusCoordIds.length > 0
      ? usuarios.filter((u) => u.role === "colaborador" && (!u.status || u.status === "ativo") && meusCoordIds.includes(u.coordenadorId || ""))
      : [];
    const inativos = colabsAssessor.filter((u) => calcularSaudeColaborador(u.ultimaAtividade, u.criadoEm).status === "inativo");
    const parados  = colabsAssessor.filter((u) => calcularSaudeColaborador(u.ultimaAtividade, u.criadoEm).status === "parado");
    if (inativos.length > 0) {
      alertas.push({ tipo: "erro", mensagem: `Presença reduzida: ${inativos.length} mobilizador${inativos.length > 1 ? "es" : ""} sem atividade territorial há +10 dias`, acao: "Ver mobilizadores", link: "/colaboradores" });
    }
    if (parados.length > 0) {
      alertas.push({ tipo: "alerta", mensagem: `${parados.length} mobilizador${parados.length > 1 ? "es com" : " com"} atividade territorial em queda (6–10 dias)`, acao: "Ver mobilizadores", link: "/colaboradores" });
    }
    const icAssessor = calcularIC(eleitores);
    if (icAssessor && icAssessor.atual + icAssessor.anterior >= 10 && (icAssessor.direcao === "queda" || icAssessor.direcao === "retraindo")) {
      alertas.push({ tipo: "alerta", mensagem: `Expansão territorial desacelerando: ${icAssessor.label} nos últimos 7 dias`, acao: "Ver inteligência", link: "/relatorios" });
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

  const crescimentoTerritorial = (() => {
    if (!isPolitico(userData)) return [];
    const agora = Date.now();
    const d30 = agora - 30 * 86400000;
    const d60 = agora - 60 * 86400000;
    const map30: Record<string, number> = {};
    const mapPrev: Record<string, number> = {};
    eleitoresFiltrados.forEach((e) => {
      const t = parseDate(e.criadoEm).getTime();
      if (t > d30) map30[e.cidade] = (map30[e.cidade] || 0) + 1;
      else if (t > d60) mapPrev[e.cidade] = (mapPrev[e.cidade] || 0) + 1;
    });
    return Object.entries(map30)
      .filter(([, atual]) => atual >= 5)
      .map(([cidade, atual]) => {
        const prev = mapPrev[cidade] || 0;
        const delta = prev > 0 ? Math.round(((atual - prev) / prev) * 100) : 100;
        return { cidade, atual, prev, delta };
      })
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 8);
  })();
  const maxCrescDelta = crescimentoTerritorial.length > 0
    ? Math.max(...crescimentoTerritorial.map((i) => Math.abs(i.delta)), 1)
    : 1;

  const territorioMap = isPolitico(userData)
    ? (() => {
        const agora30d = Date.now() - 30 * 86400000;
        return Object.entries(
          eleitoresFiltrados.reduce<Record<string, { total: number; fortes: number; indecisos: number; fracos: number; recentes: number }>>((acc, e) => {
            const key = e.bairro ? `${e.bairro} · ${e.cidade}` : e.cidade;
            if (!acc[key]) acc[key] = { total: 0, fortes: 0, indecisos: 0, fracos: 0, recentes: 0 };
            acc[key].total++;
            if (e.grauApoio === "forte") acc[key].fortes++;
            if (e.grauApoio === "indeciso") acc[key].indecisos++;
            if (e.grauApoio === "fraco") acc[key].fracos++;
            if (parseDate(e.criadoEm).getTime() > agora30d) acc[key].recentes++;
            return acc;
          }, {})
        ).map(([territorio, s]) => ({ territorio, ...s })).sort((a, b) => b.total - a.total);
      })()
    : [] as { territorio: string; total: number; fortes: number; indecisos: number; fracos: number; recentes: number }[];

  const topTerritorio = territorioMap[0] ?? null;
  const maxTerrTotal = territorioMap[0]?.total || 1;

  const analiseAssessor = isPolitico(userData)
    ? (() => {
        const coordToAssessorId = usuarios
          .filter((u) => u.role === "coordenador" && u.assessorId)
          .reduce<Record<string, string>>((acc, u) => { acc[u.uid] = u.assessorId!; return acc; }, {});
        const assessorNomeMap = usuarios
          .filter((u) => u.role === "assessor")
          .reduce<Record<string, string>>((acc, u) => { acc[u.uid] = u.nome; return acc; }, {});
        const assessorCidadesMap = usuarios
          .filter((u) => u.role === "assessor")
          .reduce<Record<string, string[]>>((acc, u) => {
            acc[u.uid] = (u as any).cidades?.length ? (u as any).cidades : (u.cidadePrincipal ? [u.cidadePrincipal] : []);
            return acc;
          }, {});
        const stats: Record<string, { nome: string; semNome: boolean; total: number; fortes: number; territorios: Record<string, number> }> = {};
        const semLideranca: Eleitor[] = [];
        for (const e of eleitoresFiltrados) {
          const assessorId = e.coordenadorId ? coordToAssessorId[e.coordenadorId] : undefined;
          if (!assessorId) { semLideranca.push(e); continue; }
          const nomeReal = assessorNomeMap[assessorId];
          if (!stats[assessorId]) stats[assessorId] = { nome: nomeReal || "Sem responsável definido", semNome: !nomeReal, total: 0, fortes: 0, territorios: {} };
          stats[assessorId].total++;
          if (e.grauApoio === "forte") stats[assessorId].fortes++;
          const key = e.bairro ? `${e.bairro} · ${e.cidade}` : e.cidade;
          stats[assessorId].territorios[key] = (stats[assessorId].territorios[key] || 0) + 1;
        }
        // Incluir assessores com zero eleitores — o Deputado precisa ver quem ainda não iniciou
        usuarios.filter((u) => u.role === "assessor").forEach((u) => {
          if (!stats[u.uid]) stats[u.uid] = { nome: u.nome, semNome: false, total: 0, fortes: 0, territorios: {} };
        });
        const ranking = Object.entries(stats)
          .map(([id, s]) => ({
            id,
            nome: s.nome,
            semNome: s.semNome,
            total: s.total,
            fortes: s.fortes,
            pctForte: s.total > 0 ? Math.round((s.fortes / s.total) * 100) : 0,
            topTerr: Object.entries(s.territorios).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
            cidades: assessorCidadesMap[id] ?? [],
          }))
          .sort((a, b) => b.total - a.total);
        return { ranking, semLideranca };
      })()
    : { ranking: [] as { id: string; nome: string; semNome: boolean; total: number; fortes: number; pctForte: number; topTerr: string | null; cidades: string[] }[], semLideranca: [] as Eleitor[] };

  const assessorRanking = analiseAssessor.ranking;
  const eleitoresSemLideranca = analiseAssessor.semLideranca;
  const maxAssessorTotal = assessorRanking.filter((a) => a.total > 0)[0]?.total || 1;

  // Dados reais por cidade para modal de pendências (P2 — Sprint 20)
  const statsCidadeModal = isPolitico(userData) ? (() => {
    const agora = Date.now();
    const d30 = agora - 30 * 86400000;
    const d60 = agora - 60 * 86400000;
    const map: Record<string, { total: number; fortes: number; indecisos: number; cadastros30d: number; cadastros30_60d: number; pctForte: number }> = {};
    eleitoresFiltrados.forEach((e) => {
      if (!e.cidade) return;
      if (!map[e.cidade]) map[e.cidade] = { total: 0, fortes: 0, indecisos: 0, cadastros30d: 0, cadastros30_60d: 0, pctForte: 0 };
      map[e.cidade].total++;
      if (e.grauApoio === "forte")   map[e.cidade].fortes++;
      if (e.grauApoio === "indeciso") map[e.cidade].indecisos++;
      const t = parseDate(e.criadoEm).getTime();
      if (t > d30)       map[e.cidade].cadastros30d++;
      else if (t > d60)  map[e.cidade].cadastros30_60d++;
    });
    for (const c of Object.values(map)) c.pctForte = c.total > 0 ? Math.round((c.fortes / c.total) * 100) : 0;
    return map;
  })() : {} as Record<string, { total: number; fortes: number; indecisos: number; cadastros30d: number; cadastros30_60d: number; pctForte: number }>;

  const assessorResponsavelPorCidade = isPolitico(userData) ? (() => {
    const coordToAid: Record<string, string> = {};
    const aidToNome: Record<string, string> = {};
    usuarios.filter((u) => u.role === "coordenador").forEach((u) => { if (u.assessorId) coordToAid[u.uid] = u.assessorId; });
    usuarios.filter((u) => u.role === "assessor").forEach((u) => { aidToNome[u.uid] = u.nome; });
    const cidadeAidCount: Record<string, Record<string, number>> = {};
    eleitoresFiltrados.forEach((e) => {
      if (!e.cidade || !e.coordenadorId) return;
      const aid = coordToAid[e.coordenadorId];
      if (!aid) return;
      if (!cidadeAidCount[e.cidade]) cidadeAidCount[e.cidade] = {};
      cidadeAidCount[e.cidade][aid] = (cidadeAidCount[e.cidade][aid] || 0) + 1;
    });
    const result: Record<string, string> = {};
    for (const [cidade, counts] of Object.entries(cidadeAidCount)) {
      const topAid = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      result[cidade] = topAid ? (aidToNome[topAid] || "—") : "—";
    }
    return result;
  })() : {} as Record<string, string>;

  const todasCidadesAssessores = isPolitico(userData)
    ? new Set(assessorRanking.flatMap((a) => a.cidades))
    : new Set<string>();

  const municipiosSemAssessor = isPolitico(userData)
    ? [...new Set(eleitoresSemLideranca.map((e) => e.cidade))]
        .filter((c) => !todasCidadesAssessores.has(c))
        .map((cidade) => {
          const rep = eleitoresSemLideranca.find((e) => e.cidade === cidade);
          return { cidade, label: rep?.bairro ? `${rep.bairro} · ${cidade}` : cidade };
        })
    : [] as { cidade: string; label: string }[];

  const cidadesComCoordenador = isPolitico(userData)
    ? new Set(usuarios.filter((u) => u.role === "coordenador").map((u) => u.cidadePrincipal || u.cidade).filter((c): c is string => !!c))
    : new Set<string>();

  const municipiosSemCoordenador = isPolitico(userData)
    ? assessorRanking
        .filter((a) => !a.semNome && a.cidades.length > 0)
        .flatMap((a) => a.cidades.map((c) => ({ cidade: c, assessorNome: a.nome })))
        .filter(({ cidade }) => !cidadesComCoordenador.has(cidade))
    : [] as { cidade: string; assessorNome: string }[];

  const cadastros30d = isPolitico(userData)
    ? eleitoresFiltrados.filter((e) => parseDate(e.criadoEm).getTime() > Date.now() - 30 * 86400000).length
    : 0;

  const crescimento30dPolitico = isPolitico(userData) ? (() => {
    const agora = Date.now();
    const a30 = eleitoresFiltrados.filter((e) => { const t = parseDate(e.criadoEm).getTime(); return t > agora - 60 * 86400000 && t <= agora - 30 * 86400000; }).length;
    return a30 > 0 ? Math.round(((cadastros30d - a30) / a30) * 100) : cadastros30d > 0 ? 100 : 0;
  })() : 0;

  const projecaoVotos = isPolitico(userData) && eleitoresFiltrados.length > 0 ? Math.round(
    eleitoresFiltrados.filter((e) => e.grauApoio === "forte").length * 0.9 +
    eleitoresFiltrados.filter((e) => e.grauApoio === "medio").length * 0.6 +
    eleitoresFiltrados.filter((e) => e.grauApoio === "indeciso").length * 0.25 +
    eleitoresFiltrados.filter((e) => e.grauApoio === "fraco").length * 0.05
  ) : 0;

  const indecisosTotal = isPolitico(userData) ? eleitoresFiltrados.filter((e) => e.grauApoio === "indeciso").length : 0;
  const melhorOportunidade = isPolitico(userData) && territorioMap.length > 0
    ? (territorioMap.filter((t) => t.total >= 3 && t.indecisos > 0).sort((a, b) => (b.indecisos / b.total) - (a.indecisos / a.total))[0] ?? null)
    : null;

  const municipiosSemAtividade30d = isPolitico(userData) && eleitoresFiltrados.length > 0 ? (() => {
    const comRegistros = new Set(eleitoresFiltrados.map((e) => e.cidade));
    const comRecentes  = new Set(eleitoresFiltrados.filter((e) => parseDate(e.criadoEm).getTime() > Date.now() - 30 * 86400000).map((e) => e.cidade));
    return Array.from(comRegistros).filter((c) => !comRecentes.has(c)).length;
  })() : 0;

  const concentracaoRisco = isPolitico(userData) && eleitoresFiltrados.length >= 10 ? (() => {
    const cids = eleitoresFiltrados.reduce<Record<string, number>>((acc, e) => { acc[e.cidade] = (acc[e.cidade] || 0) + 1; return acc; }, {});
    const top3 = Object.values(cids).sort((a, b) => b - a).slice(0, 3).reduce((s, v) => s + v, 0);
    return Math.round((top3 / eleitoresFiltrados.length) * 100);
  })() : 0;

  const indiceSaudeTerritorial = isPolitico(userData) && eleitoresFiltrados.length > 0 ? (() => {
    const total = eleitoresFiltrados.length;
    const sfp = calcularSFPSimples(eleitoresFiltrados);
    const pctSFP = sfp ? Math.min(1, sfp.score / 3.0) : 0;
    const d30 = eleitoresFiltrados.filter((e) => parseDate(e.criadoEm).getTime() > Date.now() - 30 * 86400000).length;
    const qualidade      = Math.min(40, Math.round(pctSFP * 100 * 0.4));
    const crescScore     = crescimento30dPolitico > 20 ? 25 : crescimento30dPolitico > 5 ? 18 : crescimento30dPolitico > 0 ? 10 : 0;
    const diversScore    = Math.round((1 - concentracaoRisco / 100) * 20);
    const atividadeScore = Math.min(15, Math.round((d30 / total) * 15));
    return Math.min(100, Math.round(qualidade + crescScore + diversScore + atividadeScore));
  })() : 0;


  // Execução real — derivada dos territórios reais (assessorias + coordenações)
  const execucaoReal: ExecucaoItem[] = territoriosReais.map((t) => ({
    cidade:      t.cidade,
    status:      (!t.possuiAssessoria ? "atrasada" : !t.possuiCoordenacao ? "em_andamento" : "concluida") as ExecucaoItem["status"],
    responsavel: t.assessorResponsavel || "—",
    descricao:   !t.possuiAssessoria ? "Sem assessoria regional" : !t.possuiCoordenacao ? "Aguardando coordenação" : "Estrutura ativa",
    dias:        0,
  }));
  const execucaoAtiva: ExecucaoItem[] = execucaoReal;
  const territorios = territoriosReais;
  const motor = isPolitico(userData) ? executarMotorTerritorial(territorios) : null;

  // Sprint 7 — substituição controlada: motor tem prioridade, demo é fallback
  const pendenciasMotor = motor?.pendencias ?? [];

  const pendenciasAssessoresInativos = isPolitico(userData)
    ? usuarios
        .filter((u) => {
          if (u.role !== "assessor") return false;
          if (u.ativo === false) return false;
          const ua = (u as any).ultimaAtividade;
          if (!ua) return false;
          const ts: number = ua?.toMillis?.() ?? new Date(ua).getTime();
          return Date.now() - ts > 30 * 86400000;
        })
        .map((u) =>
          criarPendencia({
            tipo: "alta",
            titulo: "Assessor Inativo",
            descricao: `${u.nome} sem atividade há mais de 30 dias.`,
            territorio: (u as any).cidadePrincipal || "—",
            origem: "Inteligência Política",
            destino: "/assessores",
            acao: "Reativar Assessor",
          })
        )
    : [];

  const pendenciasAtivas = ordenarPendencias([
    ...pendenciasMotor,
    ...pendenciasAssessoresInativos,
  ]);
  const resumoPendenciasAtivas = isPolitico(userData) ? getResumoPendencias(pendenciasAtivas) : null;

  // Classificação estratégica de municípios
  const prioridadeMunicipio: Record<string, number> = {
    Recife: 1, Olinda: 1, Caruaru: 1, Petrolina: 1, Garanhuns: 1,
    Salgueiro: 2, Timbaúba: 2, Surubim: 2,
    Bezerros: 3, Palmares: 3, Caetés: 3,
  };
  const eleitoresPorCidade = Object.fromEntries(territorios.map((t) => [t.cidade, t.eleitores]));
  const pendenciasOrdenadas = [...pendenciasAtivas].sort((a, b) => {
    const pa = prioridadeMunicipio[a.territorio] ?? 99;
    const pb = prioridadeMunicipio[b.territorio] ?? 99;
    if (pa !== pb) return pa - pb;
    if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;
    return (eleitoresPorCidade[b.territorio] ?? 0) - (eleitoresPorCidade[a.territorio] ?? 0);
  });

  const agendaMotor = motor?.agenda ?? [];
  const agendaAtiva = agendaMotor;

  const alertasMotor = motor?.alertas ?? [];
  const alertasAtivos = alertasMotor;

  const decisoesMotor = motor?.decisoes ?? [];
  const decisoesAtivas = decisoesMotor;

  const memoriaMotor = motor?.memoria ?? [];
  const memoriaAtiva = memoriaMotor;

  type PendenciaExtra = { responsavel: string; stats?: { label: string; value: string }[]; assessor?: string; impacto?: { eleitores: string; assessores?: string; coordenacoes?: string }; prazo?: string };
  const PENDENCIA_EXTRA: Record<string, PendenciaExtra> = {
    "Força Territorial-Surubim-Designar Assessoria": { responsavel: "Pedro Coelho", stats: [{ label: "Apoiadores", value: "4" }],                                                                                        impacto: { eleitores: "+350 eleitores", assessores: "+1 assessor", coordenacoes: "+1 coordenação" }, prazo: "15 dias" },
    "Base Eleitoral-Garanhuns-Recuperar Base":        { responsavel: "Carla Neves",  stats: [{ label: "Base Forte", value: "8%" }, { label: "Indecisos", value: "24" }, { label: "Tendência", value: "+91%" }],           impacto: { eleitores: "+120 eleitores" },                                                           prazo: "60 dias" },
    "Força Territorial-Timbaúba-Criar Coordenação":   { responsavel: "Carlos Silva", assessor: "Carlos Silva", stats: [{ label: "Apoiadores", value: "0" }],                                                             impacto: { eleitores: "+80 eleitores", coordenacoes: "+1 coordenação" },                            prazo: "30 dias" },
  };

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

      {/* CABEÇALHO: Deputado Federal — premium */}
      {isPolitico(userData) && gabineteNome && (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ background: `#${getPartyColors(gabinetePartido).p}` }}>
              {gabineteNome.charAt(0)}
            </div>
            <div>
              <p className="text-[11px] text-white/30 mb-0.5">
                {(() => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; })()},{" "}
                <span className="text-white/50">{userData.nome.split(" ")[0]}</span>
              </p>
              <h1 className="text-xl font-bold text-white leading-tight">{gabineteNome}</h1>
              <p className="text-sm text-white/40">
                {gabineteCargo}{gabinetePartido ? ` · ${gabinetePartido}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {indiceSaudeTerritorial > 0 && (() => {
              const stClass = indiceSaudeTerritorial >= 70 ? { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400" }
                            : indiceSaudeTerritorial >= 45 ? { bg: "bg-amber-500/10",   border: "border-amber-500/20",   text: "text-amber-400"   }
                            :                                { bg: "bg-red-500/10",      border: "border-red-500/20",      text: "text-red-400"     };
              const stLabel = indiceSaudeTerritorial >= 75 ? "Excelente"
                            : indiceSaudeTerritorial >= 50 ? "Boa"
                            : indiceSaudeTerritorial >= 25 ? "Em Atenção"
                            :                                "Crítica";
              return (
                <div
                  title={`Saúde Territorial (0–100) — ${stLabel}\nConsidera:\n• Cobertura dos municípios\n• Crescimento da base\n• Estrutura territorial\n• Atividade da equipe\n• Missões concluídas`}
                  className={`flex flex-col items-center px-3 py-2 rounded-xl border cursor-help ${stClass.bg} ${stClass.border}`}
                >
                  <span className={`text-[9px] uppercase tracking-wider font-semibold ${stClass.text} mb-0.5`}>Saúde Territorial</span>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xl font-bold leading-none ${stClass.text}`}>{indiceSaudeTerritorial}</span>
                    <span className="text-[10px] text-white/25">/100</span>
                  </div>
                  <span className={`text-[9px] font-medium mt-0.5 ${stClass.text}`}>{stLabel}</span>
                </div>
              );
            })()}
            <div className="text-right">
              <p className={`text-xs font-medium ${roleInfo.text}`}>{roleInfo.label}</p>
              <p className="text-[11px] text-white/25 mt-0.5">
                {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CABEÇALHO: Assessor, Prefeito, Vereador */}
      {(isAssessor(userData) || isPrefeito(userData) || isVereador(userData)) && gabineteNome && (
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

      {/* FILTROS TERRITORIAIS AVANÇADOS — exclusivo deputado */}
      {isPolitico(userData) && (estadosDisponiveis.length > 0 || assessoresParaFiltro.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter size={14} className="text-white/30 shrink-0" />
            {assessoresParaFiltro.length > 0 && (
              <Select
                label="Assessor"
                value={filtroAssessorId}
                onChange={(e) => { setFiltroAssessorId(e.target.value); setFiltroEstado(""); setFiltroCidade(""); setFiltroBairro(""); }}
                options={[{ value: "", label: "Todos os assessores" }, ...assessoresParaFiltro.map((a) => ({ value: a.uid, label: a.nome }))]}
              />
            )}
            {estadosDisponiveis.length > 0 && (
              <Select
                label="Estado"
                value={filtroEstado}
                onChange={(e) => { setFiltroEstado(e.target.value); setFiltroCidade(""); setFiltroBairro(""); }}
                options={[{ value: "", label: "Todos os estados" }, ...estadosDisponiveis.map((s) => ({ value: s, label: s }))]}
              />
            )}
            {cidadesDisponiveis.length > 0 && (
              <Select
                label="Cidade"
                value={filtroCidade}
                onChange={(e) => { setFiltroCidade(e.target.value); setFiltroBairro(""); }}
                options={[{ value: "", label: "Todas as cidades" }, ...cidadesDisponiveis.map((c) => ({ value: c, label: c }))]}
              />
            )}
            {bairrosDisponiveis.length > 0 && (
              <Select
                label="Bairro"
                value={filtroBairro}
                onChange={(e) => setFiltroBairro(e.target.value)}
                options={[{ value: "", label: "Todos os bairros" }, ...bairrosDisponiveis.map((b) => ({ value: b, label: b }))]}
              />
            )}
          </div>
          {(filtroAssessorId || filtroEstado || filtroCidade || filtroBairro) && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-white/25 uppercase tracking-wider">Filtrando:</span>
              {filtroAssessorId && (() => {
                const a = assessoresParaFiltro.find((x) => x.uid === filtroAssessorId);
                return a ? (
                  <button
                    onClick={() => setFiltroAssessorId("")}
                    className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25 hover:bg-violet-500/25 transition-all"
                  >
                    {a.nome} ×
                  </button>
                ) : null;
              })()}
              {filtroEstado && (
                <button
                  onClick={() => { setFiltroEstado(""); setFiltroCidade(""); setFiltroBairro(""); }}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25 hover:bg-blue-500/25 transition-all"
                >
                  {filtroEstado} ×
                </button>
              )}
              {filtroCidade && (
                <button
                  onClick={() => { setFiltroCidade(""); setFiltroBairro(""); }}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all"
                >
                  {filtroCidade} ×
                </button>
              )}
              {filtroBairro && (
                <button
                  onClick={() => setFiltroBairro("")}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25 transition-all"
                >
                  {filtroBairro} ×
                </button>
              )}
              <button
                onClick={() => { setFiltroAssessorId(""); setFiltroEstado(""); setFiltroCidade(""); setFiltroBairro(""); }}
                className="text-[10px] text-white/25 hover:text-white/50 transition-colors ml-1"
              >
                Limpar todos
              </button>
            </div>
          )}
        </div>
      )}

      {/* ESTADO VAZIO — Deputado sem eleitores */}
      {isPolitico(userData) && eleitores.length === 0 && (
        <GlassCard className="p-5 border-violet-500/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Users size={18} className="text-violet-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Nenhum eleitor cadastrado ainda</p>
              <p className="text-xs text-white/40 mt-0.5">Sua base eleitoral está vazia</p>
            </div>
          </div>
          <p className="text-sm text-white/50 leading-relaxed">
            {usuarios.filter((u) => u.role === "assessor").length === 0
              ? "Comece adicionando assessores ao gabinete. Eles coordenam os mobilizadores responsáveis pelos cadastros."
              : usuarios.filter((u) => u.role === "colaborador" && (!u.status || u.status === "ativo")).length === 0
                ? "Assessores cadastrados, mas ainda sem mobilizadores ativos em campo. Aguarde a ativação da equipe."
                : "Equipe em campo. Os cadastros realizados pelos mobilizadores aparecerão aqui automaticamente."}
          </p>
          <a href="/assessores" className="inline-flex items-center gap-1.5 mt-3 text-xs text-violet-400/70 hover:text-violet-300 transition-colors">
            <PlusCircle size={11} />
            Gerenciar assessores
          </a>
        </GlassCard>
      )}

      {/* BRIEFING EXECUTIVO — exclusivo para deputado federal */}
      {isPolitico(userData) && eleitoresFiltrados.length > 0 && (
        <GlassCard className="p-5 border-violet-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-violet-400" />
              <span className="text-xs text-violet-400 font-semibold uppercase tracking-wider">Briefing Executivo</span>
            </div>
            <span className="text-[11px] text-white/20">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span>
          </div>
          <div className="space-y-2.5">
            {topTerritorio && (
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-400 shrink-0 mt-0.5 text-sm">✓</span>
                <p className="text-sm text-white/80">
                  <span className="font-medium">{topTerritorio.territorio}</span> lidera o mandato com {topTerritorio.total} apoiadores
                  {topTerritorio.total > 0 && <span className="text-white/40"> · {Math.round((topTerritorio.fortes / topTerritorio.total) * 100)}% fortes</span>}
                </p>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <span className="shrink-0 mt-0.5 text-sm">{ultimos7 > 0 ? "📈" : "⚠"}</span>
              <p className={`text-sm ${ultimos7 > 0 ? "text-white/70" : "text-amber-400/80"}`}>
                {ultimos7 > 0
                  ? `${ultimos7} novo${ultimos7 !== 1 ? "s" : ""} cadastro${ultimos7 !== 1 ? "s" : ""} nos últimos 7 dias`
                  : "Nenhum cadastro novo nos últimos 7 dias — acione a equipe"}
              </p>
            </div>
            {melhorOportunidade && (
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5 text-sm">🎯</span>
                <p className="text-sm text-white/70">
                  <span className="text-white/90 font-medium">{melhorOportunidade.indecisos}</span> indecisos convertíveis em <span className="text-white/80">{melhorOportunidade.territorio}</span>
                </p>
              </div>
            )}
            {municipiosSemAtividade30d > 0 && (
              <div className="flex items-start gap-2.5">
                <span className="text-amber-400 shrink-0 mt-0.5 text-sm">⚠</span>
                <p className="text-sm text-amber-400/80">
                  {municipiosSemAtividade30d} {municipiosSemAtividade30d === 1 ? "município" : "municípios"} sem novos cadastros nos últimos 30 dias
                </p>
              </div>
            )}
            {concentracaoRisco > 70 && (
              <div className="flex items-start gap-2.5">
                <span className="text-red-400 shrink-0 mt-0.5 text-sm">⚠</span>
                <p className="text-sm text-red-400/80">
                  {concentracaoRisco}% da base concentrada em 3 territórios — risco de dependência territorial
                </p>
              </div>
            )}
            {projecaoVotos > 0 && (
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5 text-sm">🗳</span>
                <p className="text-sm text-white/60">
                  Base comprometida: <span className="text-violet-400 font-semibold">{projecaoVotos.toLocaleString("pt-BR")} votos</span> de alta probabilidade
                  {indecisosTotal > 0 && <span className="text-white/35"> · +{indecisosTotal} indecisos em disputa</span>}
                </p>
              </div>
            )}
          </div>
          {indiceSaudeTerritorial > 0 && (
            <div className="mt-4 pt-4 border-t border-white/[0.05]">
              <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2">Saúde Territorial</p>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-28 h-1.5 bg-white/[0.06] rounded-full">
                  <div
                    className={`h-1.5 rounded-full transition-all ${indiceSaudeTerritorial >= 70 ? "bg-emerald-500" : indiceSaudeTerritorial >= 45 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${indiceSaudeTerritorial}%` }}
                  />
                </div>
                <div>
                  <span className={`text-lg font-bold ${indiceSaudeTerritorial >= 70 ? "text-emerald-400" : indiceSaudeTerritorial >= 45 ? "text-amber-400" : "text-red-400"}`}>
                    {indiceSaudeTerritorial}<span className="text-sm font-normal text-white/30">/100</span>
                  </span>
                  <p className={`text-xs font-medium mt-0.5 ${indiceSaudeTerritorial >= 75 ? "text-emerald-400" : indiceSaudeTerritorial >= 50 ? "text-sky-400" : indiceSaudeTerritorial >= 25 ? "text-amber-400" : "text-red-400"}`}>
                    {indiceSaudeTerritorial >= 75 ? "Excelente" : indiceSaudeTerritorial >= 50 ? "Boa" : indiceSaudeTerritorial >= 25 ? "Em Atenção" : "Crítica"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.04] text-white/40">
                  Base forte: {eleitoresFiltrados.length > 0 ? Math.round((eleitoresFiltrados.filter((e) => e.grauApoio === "forte").length / eleitoresFiltrados.length) * 100) : 0}%
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.04] text-white/40">
                  Municípios ativos: {new Set(eleitoresFiltrados.filter((e) => parseDate(e.criadoEm).getTime() > Date.now() - 30 * 86400000).map((e) => e.cidade)).size}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full bg-white/[0.04] ${cadastros30d > 0 ? "text-emerald-400/60" : "text-white/30"}`}>
                  {cadastros30d > 0 ? `+${cadastros30d}` : "0"} apoiadores recentes
                </span>
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {/* SALA DE SITUAÇÃO — atalho rápido para o Deputado */}
      {isPolitico(userData) && (
        <Link href="/sala-situacao" className="block group">
          <GlassCard className="p-4 border border-violet-500/15 hover:border-violet-500/35 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                  <Shield size={18} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors">Sala de Situação</p>
                  <p className="text-[11px] text-white/30">Municípios em risco · oportunidades · alertas operacionais</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-white/20 group-hover:text-violet-400 transition-colors" />
            </div>
          </GlassCard>
        </Link>
      )}

      {/* PRIORIDADES ESTRATÉGICAS — político */}
      {isPolitico(userData) && eleitoresFiltrados.length >= 5 && territorioMap.length > 0 && (() => {
        const prioridades: { emoji: string; titulo: string; descricao: string; cor: string }[] = [];
        if (topTerritorio) {
          const pctForte = topTerritorio.total > 0 ? Math.round((topTerritorio.fortes / topTerritorio.total) * 100) : 0;
          prioridades.push({ emoji: "🔥", titulo: topTerritorio.territorio, descricao: `${topTerritorio.total} apoiadores · ${pctForte}% fortes`, cor: "text-emerald-400" });
        }
        const terrOrdenadosPorQueda = [...crescimentoTerritorial].sort((a, b) => a.delta - b.delta);
        if (terrOrdenadosPorQueda.length > 0) {
          const pior = terrOrdenadosPorQueda[0];
          const descQueda = pior.delta < 0
            ? `Queda de ${Math.abs(pior.delta)}% nos últimos 30 dias`
            : pior.prev === 0
              ? "Território novo — sem histórico anterior para comparação"
              : `Menor crescimento: +${pior.delta}% nos últimos 30 dias`;
          prioridades.push({ emoji: "⚠", titulo: pior.cidade, descricao: descQueda, cor: "text-amber-400" });
        }
        if (melhorOportunidade) {
          prioridades.push({ emoji: "🎯", titulo: melhorOportunidade.territorio, descricao: `${melhorOportunidade.indecisos} indecisos convertíveis`, cor: "text-violet-400" });
        }
        if (prioridades.length === 0) return null;
        return (
          <GlassCard className="p-5 border-violet-500/10">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-violet-400" />
              <h3 className="text-white font-semibold">Prioridades Estratégicas</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {prioridades.map((p, i) => {
                const prio = prioridadeMunicipio[p.titulo];
                const PRIO_STYLE: Record<number, string> = {
                  1: "text-red-400 bg-red-500/10 border-red-500/20",
                  2: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                  3: "text-white/35 bg-white/5 border-white/10",
                };
                return (
                  <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.10] transition-all">
                    <span className="text-xl shrink-0 mt-0.5">{p.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className={`text-sm font-semibold ${p.cor}`}>{p.titulo}</p>
                        {prio && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${PRIO_STYLE[prio]}`}>P{prio}</span>
                        )}
                      </div>
                      <p className="text-xs text-white/40">{p.descricao}</p>
                      <a href="/mapa-politico" className="inline-block text-[11px] text-violet-400/60 hover:text-violet-300 mt-2 transition-colors">
                        Analisar →
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        );
      })()}

      {/* CENTRAL DE PENDÊNCIAS ESTRATÉGICAS — deputado */}
      {/* Modal pequeno ESTABILIZAÇÃO — dashboard */}
      {modalEstabDash && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setModalEstabDash(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <span className="text-sm shrink-0">⚡</span>
              <div>
                <p className="text-xs font-bold text-violet-400 tracking-wider">ESTABILIZAÇÃO</p>
                <p className="text-[11px] text-white/40">Os planos reais serão habilitados após a homologação final do sistema.</p>
              </div>
            </div>
            <button
              onClick={() => setModalEstabDash(false)}
              className="w-full py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* BANNER DEMO — visível quando não há eleitores reais */}
      {isPolitico(userData) && territoriosReais.length === 0 && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
          <span>⚠️</span>
          <span>Visualização demonstrativa — adicione eleitores para ver a inteligência territorial com dados reais.</span>
        </div>
      )}

      {/* INTELIGÊNCIA EXECUTIVA — título de seção */}
      {isPolitico(userData) && motor && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-sm">⚡</span>
          <h2 className="text-white font-semibold">Inteligência Executiva</h2>
          <span className="text-[10px] text-white/25 ml-1 italic">motor territorial ativo</span>
        </div>
      )}

      {/* SCORECARDS EXECUTIVOS — Inteligência Política */}
      {isPolitico(userData) && motor && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Pendências */}
          <div className="p-4 rounded-2xl bg-zinc-900 border border-red-500/20 hover:border-red-500/35 transition-all">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Pendências</p>
              <span className="text-base">🔴</span>
            </div>
            <p className="text-3xl font-bold text-white mb-3">{pendenciasAtivas.length}</p>
            <div className="space-y-1.5 pt-2.5 border-t border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-white/30">Críticas</span>
                <span className="text-[10px] font-bold text-red-400">{pendenciasAtivas.filter((p) => p.tipo === "critica").length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-white/30">Médias</span>
                <span className="text-[10px] font-bold text-amber-400">{pendenciasAtivas.filter((p) => p.tipo === "alta" || p.tipo === "media").length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-white/30">Baixas</span>
                <span className="text-[10px] font-bold text-emerald-400">{pendenciasAtivas.filter((p) => p.tipo === "baixa").length}</span>
              </div>
            </div>
          </div>

          {/* Alertas */}
          <div className="p-4 rounded-2xl bg-zinc-900 border border-amber-500/20 hover:border-amber-500/35 transition-all">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Alertas</p>
              <span className="text-base">🔔</span>
            </div>
            <p className="text-3xl font-bold text-white mb-3">{alertasAtivos.length}</p>
            <div className="space-y-1.5 pt-2.5 border-t border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-white/30">Críticos</span>
                <span className="text-[10px] font-bold text-red-400">{alertasAtivos.filter((a) => a.tipo === "critico").length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-white/30">Oportunidades</span>
                <span className="text-[10px] font-bold text-blue-400">{alertasAtivos.filter((a) => a.tipo === "oportunidade").length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-white/30">Atenção</span>
                <span className="text-[10px] font-bold text-amber-400">{alertasAtivos.filter((a) => a.tipo === "atencao").length}</span>
              </div>
            </div>
          </div>

          {/* Municípios P1 */}
          {(() => {
            const p1Cities = Object.entries(prioridadeMunicipio).filter(([, p]) => p === 1).map(([c]) => c);
            const p1ComCobertura = p1Cities.filter((c) => territorios.some((t) => t.cidade === c && t.possuiAssessoria)).length;
            const coberturaP1 = p1Cities.length > 0 ? Math.round((p1ComCobertura / p1Cities.length) * 100) : 0;
            return (
              <div className="p-4 rounded-2xl bg-zinc-900 border border-violet-500/20 hover:border-violet-500/35 transition-all">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Municípios P1</p>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-violet-400 bg-violet-500/10 border-violet-500/20">P1</span>
                </div>
                <p className="text-3xl font-bold text-white mb-3">{p1Cities.length}</p>
                <div className="space-y-2 pt-2.5 border-t border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/30">Cobertura</span>
                    <span className={`text-[10px] font-bold ${coberturaP1 >= 80 ? "text-emerald-400" : coberturaP1 >= 50 ? "text-amber-400" : "text-red-400"}`}>{coberturaP1}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${coberturaP1 >= 80 ? "bg-emerald-500" : coberturaP1 >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${coberturaP1}%` }} />
                  </div>
                  <p className="text-[10px] text-white/20">{p1ComCobertura}/{p1Cities.length} com assessoria</p>
                </div>
              </div>
            );
          })()}

          {/* Crescimento */}
          <div className={`p-4 rounded-2xl bg-zinc-900 border transition-all ${crescimento30dPolitico >= 0 ? "border-emerald-500/20 hover:border-emerald-500/35" : "border-red-500/20 hover:border-red-500/35"}`}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Crescimento</p>
              <span className="text-base">{crescimento30dPolitico >= 0 ? "📈" : "📉"}</span>
            </div>
            <p className={`text-3xl font-bold mb-3 ${crescimento30dPolitico > 0 ? "text-emerald-400" : crescimento30dPolitico < 0 ? "text-red-400" : "text-white"}`}>
              {crescimento30dPolitico > 0 ? "+" : ""}{crescimento30dPolitico}%
            </p>
            <div className="space-y-1.5 pt-2.5 border-t border-white/5">
              <p className="text-[10px] text-white/30">Últimos 30 dias</p>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-white/25">{cadastros30d} cadastros</span>
                <span className={`text-[10px] font-medium ${crescimento30dPolitico > 0 ? "text-emerald-400/70" : crescimento30dPolitico < 0 ? "text-red-400/70" : "text-white/30"}`}>
                  {crescimento30dPolitico > 0 ? "↑ Expansão" : crescimento30dPolitico < 0 ? "↓ Retração" : "→ Estável"}
                </span>
              </div>
            </div>
          </div>

        </div>
      )}

      {isPolitico(userData) && pendenciasAtivas.length > 0 && resumoPendenciasAtivas && (
        <>
          {/* Modal de resolução */}
          {modalPendencia && (() => {
            const p = pendenciasAtivas.find((x) => x.id === modalPendencia);
            if (!p) return null;
            const extra: PendenciaExtra = PENDENCIA_EXTRA[p.id] ?? { responsavel: "—", stats: [] };
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm" onClick={() => setModalPendencia(null)}>
                <div
                  className={p.tipo === "alta"
                    ? "w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-zinc-950 border border-zinc-800 p-6 space-y-5"
                    : "bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md space-y-5"}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Identificador do território */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Território</span>
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">{p.territorio}</span>
                    {(() => { const pr = prioridadeMunicipio[p.territorio]; const s = { 1: "text-red-400 bg-red-500/10 border-red-500/20", 2: "text-amber-400 bg-amber-500/10 border-amber-500/20", 3: "text-white/35 bg-white/5 border-white/10" } as Record<number, string>; return pr ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${s[pr]}`}>P{pr}</span> : null; })()}
                  </div>

                  {/* Modal: Designar Assessoria (critica) */}
                  {p.tipo === "critica" && (
                    <>
                      <div>
                        <p className="text-lg font-bold text-white uppercase tracking-wide">{p.territorio}</p>
                        <p className="text-xs text-white/40 mt-0.5">{extra.stats?.[0]?.value} apoiadores cadastrados</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/30 uppercase tracking-wider mb-1.5">Situação</p>
                        <span className="inline-block text-xs px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">Sem Assessoria Regional</span>
                      </div>
                      <div>
                        <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Ação disponível</p>
                        <div className="space-y-2 opacity-40">
                          <label className="flex items-center gap-2 cursor-not-allowed"><input type="radio" disabled /><span className="text-sm text-white/70">Criar nova assessoria</span></label>
                          <label className="flex items-center gap-2 cursor-not-allowed"><input type="radio" disabled /><span className="text-sm text-white/70">Designar assessoria existente</span></label>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-white/30 uppercase tracking-wider mb-1.5">Selecionar responsável</p>
                        <select disabled style={{ colorScheme: "dark" }} className="w-full bg-zinc-800 border border-zinc-700 text-white/40 rounded-xl px-3 py-2 text-sm cursor-not-allowed opacity-50">
                          <option className="bg-zinc-950">{extra.responsavel}</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/40">Responsável: <span className="text-white/60">{extra.responsavel}</span></span>
                        <span className="text-white/40">Prazo: <span className="text-white/60">15 dias</span></span>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setModalPendencia(null); router.push(`/missoes?acao=nova&tipo=criar_assessoria&cidade=${encodeURIComponent(p.territorio)}&prioridade=P1`); }}
                          className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
                        >
                          Criar Missão — {p.territorio} →
                        </button>
                        <button onClick={() => setModalPendencia(null)} className="px-5 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-colors">Cancelar</button>
                      </div>
                    </>
                  )}

                  {/* Modal: Recuperar Base (alta) — Plano Executivo com dados reais */}
                  {p.tipo === "alta" && (() => {
                    const st = statsCidadeModal[p.territorio] ?? { total: 0, fortes: 0, indecisos: 0, cadastros30d: 0, cadastros30_60d: 0, pctForte: 0 };
                    const delta30 = st.cadastros30_60d > 0 ? Math.round(((st.cadastros30d - st.cadastros30_60d) / st.cadastros30_60d) * 100) : 0;
                    const tendenciaLabel = st.cadastros30_60d === 0 ? "—" : delta30 >= 0 ? `+${delta30}%` : `${delta30}%`;
                    const tendenciaColor = delta30 >= 0 ? "text-emerald-400" : "text-red-400";
                    const assessorNome = assessorResponsavelPorCidade[p.territorio] || extra.responsavel;
                    const motivo = st.pctForte < 15
                      ? "Base forte abaixo de 15% — conversão necessária"
                      : st.cadastros30d < 3
                        ? "Baixo cadastro de campo nos últimos 30 dias"
                        : delta30 < -30
                          ? `Queda de ${Math.abs(delta30)}% no ritmo de cadastro`
                          : st.indecisos > st.fortes
                            ? "Indecisos sem acompanhamento ativo"
                            : "Crescimento territorial abaixo do esperado";
                    const meta30 = Math.min(100, st.pctForte + 7);
                    const meta60 = Math.min(100, st.pctForte + 14);
                    const meta90 = Math.min(100, st.pctForte + 22);
                    const plano: string[] = [
                      "Reunir assessoria regional para alinhamento",
                      st.indecisos > 3 ? `Converter ${st.indecisos} indecisos identificados` : "Intensificar identificação de indecisos",
                      st.cadastros30d < 5 ? "Aumentar frequência das visitas de campo" : "Manter ritmo de cadastro ativo",
                      "Criar meta territorial com prazo definido",
                      "Monitoramento semanal dos indicadores",
                    ];
                    return (
                      <>
                        <div>
                          <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Recuperação de Base</p>
                          <p className="text-lg font-bold text-white uppercase tracking-wide">{p.territorio}</p>
                        </div>

                        {/* Situação Atual */}
                        <div>
                          <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Situação Atual</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="text-center p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                              <p className="text-base font-bold text-white/80">{st.cadastros30d}</p>
                              <p className="text-[10px] text-white/30 mt-0.5">Cadastros 30d</p>
                            </div>
                            <div className="text-center p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                              <p className="text-base font-bold text-white/50">{st.cadastros30_60d}</p>
                              <p className="text-[10px] text-white/30 mt-0.5">Período anterior</p>
                            </div>
                            <div className="text-center p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                              <p className={`text-base font-bold ${tendenciaColor}`}>{tendenciaLabel}</p>
                              <p className="text-[10px] text-white/30 mt-0.5">Variação</p>
                            </div>
                            <div className="text-center p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                              <p className="text-base font-bold text-amber-400">{st.pctForte}%</p>
                              <p className="text-[10px] text-white/30 mt-0.5">Base Forte</p>
                            </div>
                          </div>
                          <div className="mt-2 p-2.5 rounded-xl bg-red-500/[0.07] border border-red-500/15">
                            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Motivo provável</p>
                            <p className="text-xs text-red-300/80">{motivo}</p>
                          </div>
                        </div>

                        {/* Diagnóstico Completo */}
                        <div>
                          <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Diagnóstico</p>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-center p-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                              <p className="text-base font-bold text-blue-400">{st.indecisos}</p>
                              <p className="text-[10px] text-white/30 mt-0.5">Indecisos</p>
                            </div>
                            <div className="text-center p-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                              <p className="text-base font-bold text-white/60">{st.total}</p>
                              <p className="text-[10px] text-white/30 mt-0.5">Total</p>
                            </div>
                            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-red-500/10 border border-red-500/20">
                              <span className="text-[9px] font-bold text-red-400 tracking-wider leading-tight text-center">INTERVENÇÃO{"\n"}NECESSÁRIA</span>
                            </div>
                          </div>
                        </div>

                        {/* Meta de Recuperação */}
                        <div>
                          <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Meta de Recuperação — Base Forte</p>
                          <div className="space-y-0">
                            {[
                              { label: "Atual",        value: `${st.pctForte}%`, color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20"     },
                              { label: "Meta 30 dias", value: `${meta30}%`,       color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20"   },
                              { label: "Meta 60 dias", value: `${meta60}%`,       color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20"    },
                              { label: "Meta 90 dias", value: `${meta90}%`,       color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                            ].map(({ label, value, color, bg, border }, idx, arr) => (
                              <div key={label} className="flex items-start gap-2">
                                <div className="flex flex-col items-center shrink-0">
                                  <div className={`w-7 h-7 rounded-lg ${bg} ${border} border flex items-center justify-center mt-0.5`}>
                                    <span className={`text-xs font-bold ${color}`}>{value}</span>
                                  </div>
                                  {idx < arr.length - 1 && <div className="w-px h-5 bg-white/[0.08] my-0.5" />}
                                </div>
                                <p className={`text-xs mt-1.5 ${color}`}>{label}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Plano de Ação */}
                        <div>
                          <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Plano de Ação</p>
                          <div className="space-y-1.5">
                            {plano.map((a) => (
                              <label key={a} className="flex items-center gap-2 cursor-not-allowed">
                                <input type="checkbox" defaultChecked disabled className="w-4 h-4 accent-red-500" />
                                <span className="text-sm text-white/50">{a}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Responsável */}
                        <div className="flex items-center justify-between">
                          <div className="text-sm space-y-0.5">
                            <p className="text-white/35 text-xs uppercase tracking-wider">Assessor Responsável</p>
                            <p className="text-white/70 font-medium">{assessorNome}</p>
                            <p className="text-white/35 text-xs">Prazo sugerido: <span className="text-white/55">60 dias</span></p>
                          </div>
                          <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 tracking-wider">CRÍTICA</span>
                        </div>

                        {/* Resumo Executivo */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                          <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Resumo Executivo</p>
                          <p className="text-sm text-white/50 leading-relaxed">
                            {p.territorio} tem {st.total} apoiadores na base, com {st.pctForte}% de força política.
                            {st.cadastros30_60d > 0 && st.cadastros30d < st.cadastros30_60d ? ` O cadastro caiu ${Math.abs(delta30)}% em relação ao período anterior.` : ""}
                            {st.indecisos > 0 ? ` Há ${st.indecisos} indecisos convertíveis que precisam de acompanhamento.` : ""}
                            {" "}A prioridade é fortalecer a base e acelerar o cadastro de campo.
                          </p>
                        </div>

                        {/* Rodapé */}
                        <div className="flex gap-3">
                          <button
                            onClick={() => { setModalPendencia(null); router.push(`/eleitores?cidade=${encodeURIComponent(p.territorio)}`); }}
                            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
                          >
                            Ver Eleitores de {p.territorio} →
                          </button>
                          <button
                            data-testid="btn-abrir-determinacao"
                            onClick={() => { setModalPendencia(null); setModalDeterminacao({ territorio: p.territorio, acao: "Recuperar Base Territorial", assessorNome }); }}
                            className="px-4 py-2.5 rounded-xl bg-violet-500/15 text-violet-300 text-sm font-medium border border-violet-500/25 hover:bg-violet-500/25 transition-colors"
                          >
                            Determinar
                          </button>
                          <button onClick={() => setModalPendencia(null)} className="px-4 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-colors">Cancelar</button>
                        </div>
                      </>
                    );
                  })()}

                  {/* Modal: Criar Coordenação (media) */}
                  {p.tipo === "media" && (
                    <>
                      <div>
                        <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Criar Coordenação</p>
                        <p className="text-lg font-bold text-white uppercase tracking-wide">{p.territorio}</p>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between"><span className="text-white/40">Apoiadores:</span><span className="text-white/60">{extra.stats?.[0]?.value}</span></div>
                        <div className="flex justify-between"><span className="text-white/40">Assessor:</span><span className="text-white/60">{extra.assessor ?? "—"}</span></div>
                        <p className="text-xs text-orange-400/60 pt-0.5">Nenhuma coordenação ativa.</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Sugestões</p>
                        <div className="space-y-1.5 opacity-40">
                          {["Coordenador Regional", "Liderança Comunitária", "Núcleo de Bairro"].map((s) => (
                            <label key={s} className="flex items-center gap-2 cursor-not-allowed">
                              <input type="checkbox" defaultChecked disabled />
                              <span className="text-sm text-white/70">{s}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/40">Meta inicial: <span className="text-white/60">10 apoiadores</span></span>
                        <span className="text-white/40">Prazo: <span className="text-white/60">30 dias</span></span>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setModalPendencia(null); router.push(`/missoes?acao=nova&tipo=criar_coordenacao&cidade=${encodeURIComponent(p.territorio)}&prioridade=P2`); }}
                          className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
                        >
                          Criar Missão — {p.territorio} →
                        </button>
                        <button onClick={() => setModalPendencia(null)} className="px-5 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-colors">Cancelar</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Lista de pendências */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🔴</span>
                <h3 className="text-white font-semibold">Central de Pendências</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                  {resumoPendenciasAtivas.total} {resumoPendenciasAtivas.total === 1 ? "pendência" : "pendências"}
                </span>
              </div>
              <span className="text-xs text-white/30">{resumoPendenciasAtivas.texto}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {pendenciasOrdenadas.map((p) => {
                const extra: PendenciaExtra = PENDENCIA_EXTRA[p.id] ?? { responsavel: "—", stats: [] };
                const BADGE: Record<string, { label: string; bg: string; text: string; border: string; hoverBorder: string }> = {
                  critica: { label: "Crítica", bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/20",     hoverBorder: "hover:border-red-500/40"     },
                  alta:    { label: "Alta",    bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/20",   hoverBorder: "hover:border-amber-500/40"   },
                  media:   { label: "Média",   bg: "bg-orange-500/10",  text: "text-orange-400",  border: "border-orange-500/20",  hoverBorder: "hover:border-orange-500/40"  },
                  baixa:   { label: "Baixa",   bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", hoverBorder: "hover:border-emerald-500/40" },
                };
                const ACAO_LABEL: Record<string, string> = {
                  critica: "Resolver →",
                  alta:    "Recuperar Base →",
                  media:   "Criar Coordenação →",
                  baixa:   "Ver →",
                };
                const ACAO_REC: Record<string, string> = {
                  critica: "→ Designar Assessoria Regional",
                  alta:    "→ Recuperar Base Territorial",
                  media:   "→ Criar Coordenação Local",
                  baixa:   "→ Monitorar",
                };
                const b = BADGE[p.tipo];
                const prio = prioridadeMunicipio[p.territorio];
                const PRIO_STYLE: Record<number, string> = {
                  1: "text-violet-400 bg-violet-500/10 border-violet-500/20",
                  2: "text-amber-400  bg-amber-500/10  border-amber-500/20",
                  3: "text-white/35   bg-white/5        border-white/10",
                };
                return (
                  <div key={p.id} className={`p-4 rounded-2xl bg-zinc-900 border ${b.border} ${b.hoverBorder} transition-all`}>
                    <div className="flex items-start gap-4">
                      <span className={`shrink-0 mt-0.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${b.bg} ${b.text} ${b.border}`}>
                        {b.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-white truncate">{p.titulo}</p>
                          <span className="text-xs text-white/30 shrink-0">· {p.territorio}</span>
                          {prio && (
                            <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${PRIO_STYLE[prio]}`}>
                              P{prio}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/40 mb-2">{p.descricao}</p>
                        <p className={`text-xs font-semibold ${b.text}`}>{ACAO_REC[p.tipo]}</p>
                        <p className="text-xs text-white/25 mt-1">Responsável: {extra.responsavel}</p>
                        {extra.impacto && (
                          <div className="mt-2.5 pt-2 border-t border-white/5">
                            <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1.5">Impacto estimado</p>
                            <div className="flex flex-wrap gap-1.5">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">👥 {extra.impacto.eleitores}</span>
                              {extra.impacto.assessores && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">👤 {extra.impacto.assessores}</span>}
                              {extra.impacto.coordenacoes && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">🗂 {extra.impacto.coordenacoes}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-white/25 mb-1.5">{extra.prazo ?? "15 dias"}</p>
                        <button
                          onClick={() => setModalPendencia(p.id)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${b.bg} ${b.text} hover:opacity-80`}
                        >
                          {ACAO_LABEL[p.tipo]}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* CENTRAL DE ACOMPANHAMENTO — deputado */}
      {isPolitico(userData) && execucaoAtiva.length > 0 && (
        <PainelExecucao items={execucaoAtiva} prioridadeMunicipio={prioridadeMunicipio} />
      )}

      {/* CENTRAL DE DECISÕES — deputado */}
      {isPolitico(userData) && decisoesAtivas.length > 0 && (
        <CentralDecisoes decisoes={decisoesAtivas} prioridadeMunicipio={prioridadeMunicipio} />
      )}

      {/* AGENDA EXECUTIVA — deputado */}
      {isPolitico(userData) && agendaAtiva.length > 0 && (
        <AgendaExecutiva items={agendaAtiva} prioridadeMunicipio={prioridadeMunicipio} />
      )}

      {/* CENTRAL DE ALERTAS — deputado */}
      {isPolitico(userData) && alertasAtivos.length > 0 && (
        <CentralAlertas alertas={alertasAtivos} />
      )}

      {/* MEMÓRIA DO MANDATO — deputado */}
      {isPolitico(userData) && memoriaAtiva.length > 0 && (
        <MemoriaMandato eventos={memoriaAtiva} />
      )}

      {/* CABEÇALHO: Coordenador */}
      {isCoordenador(userData) && (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-lg">🎯</div>
          <div>
            <h1 className="text-2xl font-bold text-white">Painel de Supervisão</h1>
            <p className="text-sm text-blue-400">{userData.nome}{territorioCoordenador ? ` • ${territorioCoordenador}` : " • Gerencie sua equipe e produtividade"}</p>
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
              {isCoordenador(userData) && `${eleitores.length} eleitores • ${colaboradoresEquipe.filter(u => u.role === 'colaborador').length} colaboradores${territorioCoordenador ? ` • ${territorioCoordenador}` : " na equipe"}`}
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

      {/* FILTROS TERRITORIAIS — super_admin, prefeito, assessor (deputado tem bloco próprio acima) */}
      {(isSuperOrMaster(userData) || isPrefeito(userData) || isAssessor(userData)) && (estadosDisponiveis.length > 0 || bairrosDisponiveis.length > 0) && (
        <div className="flex items-center gap-3 flex-wrap">
          <Filter size={16} className="text-white/30" />
          {isSuperOrMaster(userData) && estadosDisponiveis.length > 0 && (
            <Select
              label="Estado"
              value={filtroEstado}
              onChange={(e) => { setFiltroEstado(e.target.value); setFiltroCidade(""); setFiltroBairro(""); }}
              options={[{ value: "", label: "Todos os estados" }, ...estadosDisponiveis.map((s) => ({ value: s, label: s }))]}
            />
          )}
          {(isSuperOrMaster(userData) || isAssessor(userData)) && cidadesDisponiveis.length > 0 && (
            <Select
              label="Cidade"
              value={filtroCidade}
              onChange={(e) => { setFiltroCidade(e.target.value); setFiltroBairro(""); }}
              options={[{ value: "", label: "Todas as cidades" }, ...cidadesDisponiveis.map((c) => ({ value: c, label: c }))]}
            />
          )}
          {(isPrefeito(userData) || isAssessor(userData)) && bairrosDisponiveis.length > 0 && (
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
      {isColaborador(userData) ? (() => {
        const fortesKpi = eleitoresFiltrados.filter((e) => e.grauApoio === "forte").length;
        const faltamKpi = minhaMeta > 0 ? Math.max(0, minhaMeta - eleitoresFiltrados.length) : 0;
        const metaColor = minhaMeta === 0 ? "text-white/30"
          : progressoMeta >= 100 ? "text-emerald-400"
          : progressoMeta >= 80 ? "text-blue-400"
          : progressoMeta >= 50 ? "text-amber-400"
          : "text-red-400";
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <GlassCard className="p-5 text-center">
              <Users size={24} className="mx-auto mb-2 text-emerald-400" />
              <p className="text-3xl font-bold text-white">{eleitoresFiltrados.length}</p>
              <p className="text-xs text-white/40">Cadastros</p>
              {cadastrosHoje.length > 0 && <p className="text-xs text-emerald-400 mt-1">+{cadastrosHoje.length} hoje</p>}
            </GlassCard>
            <GlassCard className="p-5 text-center">
              <Target size={24} className={`mx-auto mb-2 ${minhaMeta > 0 ? metaColor : "text-white/30"}`} />
              <p className={`text-3xl font-bold ${minhaMeta > 0 ? metaColor : "text-white/30"}`}>
                {minhaMeta > 0 ? `${progressoMeta}%` : "—"}
              </p>
              <p className="text-xs text-white/40">Meta</p>
            </GlassCard>
            <GlassCard className="p-5 text-center">
              <TrendingUp size={24} className={`mx-auto mb-2 ${minhaMeta > 0 ? (faltamKpi > 0 ? "text-amber-400" : "text-emerald-400") : "text-white/30"}`} />
              <p className={`text-3xl font-bold ${minhaMeta > 0 ? (faltamKpi > 0 ? "text-amber-400" : "text-emerald-400") : "text-white/30"}`}>
                {minhaMeta > 0 ? faltamKpi : "—"}
              </p>
              <p className="text-xs text-white/40">Faltam</p>
            </GlassCard>
            <GlassCard className="p-5 text-center">
              <Medal size={24} className={`mx-auto mb-2 ${fortesKpi > 0 ? "text-emerald-400" : "text-white/30"}`} />
              <p className={`text-3xl font-bold ${fortesKpi > 0 ? "text-emerald-400" : "text-white/30"}`}>{fortesKpi}</p>
              <p className="text-xs text-white/40">Fortes</p>
            </GlassCard>
          </div>
        );
      })() : isCoordenador(userData) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Apoiadores da Equipe" value={eleitoresFiltrados.length} icon={<Users size={20} />} trend={cadastrosHoje.length > 0 ? { value: `+${cadastrosHoje.length} hoje`, positive: true } : undefined} delay={0} />
          <StatCard title="Cadastros Hoje" value={cadastrosHoje.length} icon={<UserPlus size={20} />} delay={100} />
          <StatCard title="Colaboradores na Equipe" value={colaboradoresPorCoordenador} icon={<Target size={20} />} delay={200} />
          <StatCard title="Meu Território" value={topBairro ? topBairro[0] : territorioCoordenador || "-"} icon={<MapPin size={20} />} delay={300} />
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
          <StatCard title={isPolitico(userData) ? "Território Mais Forte" : "Cidade Mais Forte"} value={isPolitico(userData) ? (topTerritorio ? topTerritorio.territorio : "-") : (topCidade ? topCidade[0] : "-")} icon={<MapPin size={20} />} delay={200} />
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
                <p className="text-xs text-white/40 mb-1">Qualidade da Base</p>
                <p className={`text-xl font-bold ${sfp.cor}`}>{sfp.label}</p>
                <p className="text-xs text-white/40 mt-1">{sfp.total > 0 ? Math.round((eleitoresFiltrados.filter((e) => e.grauApoio === "forte").length / sfp.total) * 100) : 0}% da base é forte · {sfp.total} apoiadores</p>
                <div className="mt-2 w-full bg-white/[0.05] rounded-full h-1">
                  <div className={`h-1 rounded-full transition-all ${sfp.dot}`} style={{ width: `${Math.min(100, (sfp.score / 3) * 100)}%` }} />
                </div>
              </div>
            )}
            {ic && (
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs text-white/40 mb-1">Cadastros — últimos 7 dias</p>
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
                  {saudeParados > 0  && <span className="text-xs text-orange-400">{saudeParados} {isCoordenador(userData) ? "parado(s) (6–10d)" : "parados"}</span>}
                  {saudeInativos > 0 && <span className="text-xs text-red-400">{saudeInativos} {isCoordenador(userData) ? "sem atividade (+10d)" : "inativos"}</span>}
                </div>
              </div>
            )}
            {isPolitico(userData) && eleitoresFiltrados.length > 0 && (() => {
              const fortesI = eleitoresFiltrados.filter((e) => e.grauApoio === "forte").length;
              const mediosI = eleitoresFiltrados.filter((e) => e.grauApoio === "medio").length;
              const indecisosI = eleitoresFiltrados.filter((e) => e.grauApoio === "indeciso").length;
              const fracosI = eleitoresFiltrados.filter((e) => e.grauApoio === "fraco").length;
              return (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-xs text-white/40 mb-3">Composição da Base</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-emerald-400">💪 Fortes</span>
                      <span className="text-sm font-bold text-emerald-400">{fortesI}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-amber-400">🟡 Médios</span>
                      <span className="text-sm font-bold text-amber-400">{mediosI}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-blue-400">🔵 Indecisos</span>
                      <span className="text-sm font-bold text-blue-400">{indecisosI}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-red-400">🔴 Fracos</span>
                      <span className="text-sm font-bold text-red-400">{fracosI}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
            {isColaborador(userData) && eleitoresFiltrados.length > 0 && (() => {
              const fortesB = eleitoresFiltrados.filter((e) => e.grauApoio === "forte").length;
              const mediosB = eleitoresFiltrados.filter((e) => e.grauApoio === "medio").length;
              const indecisosB = eleitoresFiltrados.filter((e) => e.grauApoio === "indeciso").length;
              const fracosB = eleitoresFiltrados.filter((e) => e.grauApoio === "fraco").length;
              return (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-xs text-white/40 mb-3">Composição da Base</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-emerald-400">💪 Base Forte</span>
                      <span className="text-sm font-bold text-emerald-400">{fortesB}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-amber-400">🟡 Médios</span>
                      <span className="text-sm font-bold text-amber-400">{mediosB}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-blue-400">🔵 Indecisos</span>
                      <span className="text-sm font-bold text-blue-400">{indecisosB}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-red-400">🔴 Fracos</span>
                      <span className="text-sm font-bold text-red-400">{fracosB}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </GlassCard>
      )}

      {isColaborador(userData) ? (
        <>
          {/* RESUMO DA PRODUÇÃO — P3 */}
          {(() => {
            const total = eleitoresFiltrados.length;
            const frases: string[] = [];
            const fortesR = eleitoresFiltrados.filter((e) => e.grauApoio === "forte").length;
            const faltamR = minhaMeta > 0 ? Math.max(0, minhaMeta - total) : 0;
            if (total > 0) {
              frases.push(`✅ Você realizou ${total} ${total === 1 ? "cadastro" : "cadastros"}.`);
            } else {
              frases.push("📋 Nenhum cadastro realizado ainda.");
            }
            if (minhaMeta > 0) {
              if (faltamR === 0) frases.push("🎯 Meta atingida! Continue cadastrando.");
              else frases.push(`🎯 Faltam ${faltamR} para atingir sua meta.`);
            }
            if (total > 0) {
              const pctForte = Math.round((fortesR / total) * 100);
              frases.push(`💪 ${pctForte}% da sua base é forte.`);
              const bairrosU = [...new Set(eleitoresFiltrados.map((e) => e.bairro).filter(Boolean))];
              const cidadesU = [...new Set(eleitoresFiltrados.map((e) => e.cidade).filter(Boolean))];
              if (bairrosU.length === 1 && cidadesU.length === 1) {
                frases.push(`📍 Todos os seus cadastros estão em ${bairrosU[0]} · ${cidadesU[0]}.`);
              } else if (cidadesU.length === 1) {
                frases.push(`📍 Todos os seus cadastros estão em ${cidadesU[0]}.`);
              }
            }
            if (cadastrosHoje.length === 0) {
              if (total > 0) frases.push("⚠ Nenhum cadastro realizado hoje.");
            } else {
              frases.push(`✅ ${cadastrosHoje.length} ${cadastrosHoje.length === 1 ? "cadastro realizado" : "cadastros realizados"} hoje.`);
            }
            return (
              <GlassCard className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={18} className="text-emerald-400" />
                  <h3 className="text-white font-semibold">Resumo da Produção</h3>
                </div>
                <div className="space-y-1.5">
                  {frases.map((frase, i) => (
                    <p key={i} className="text-sm text-white/70 leading-relaxed">{frase}</p>
                  ))}
                </div>
              </GlassCard>
            );
          })()}

          {/* CARD PRINCIPAL DE META — P1 */}
          {(() => {
            const STATUS_COLLAB = {
              excelente: { label: "Meta Atingida", color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30", bar: "bg-emerald-500" },
              no_ritmo:  { label: "No Ritmo",      color: "text-blue-400",    bg: "bg-blue-500/15",    border: "border-blue-500/30",    bar: "bg-blue-500"   },
              atencao:   { label: "Atenção",        color: "text-amber-400",   bg: "bg-amber-500/15",   border: "border-amber-500/30",   bar: "bg-amber-500"  },
              critico:   { label: "Crítico",        color: "text-red-400",     bg: "bg-red-500/15",     border: "border-red-500/30",     bar: "bg-red-500"    },
              sem_meta:  { label: "Sem Meta",       color: "text-white/30",    bg: "bg-white/5",        border: "border-white/10",       bar: "bg-white/20"   },
            } as const;
            const getStatus = (prog: number, meta: number): keyof typeof STATUS_COLLAB => {
              if (meta === 0) return "sem_meta";
              if (prog >= 100) return "excelente";
              if (prog >= 80) return "no_ritmo";
              if (prog >= 50) return "atencao";
              return "critico";
            };
            const status = getStatus(progressoMeta, minhaMeta);
            const sc = STATUS_COLLAB[status];
            const faltam = minhaMeta > 0 ? Math.max(0, minhaMeta - eleitoresFiltrados.length) : 0;
            return (
              <GlassCard className={`p-6 border ${sc.border}`}>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${sc.bg}`}>
                      <Target size={20} className={sc.color} />
                    </div>
                    <h3 className="text-white font-semibold">Minha Meta</h3>
                  </div>
                  {minhaMeta > 0 && (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${sc.bg} ${sc.color} ${sc.border}`}>
                      {sc.label}
                    </span>
                  )}
                </div>
                {minhaMeta > 0 ? (
                  <>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className={`text-5xl font-bold ${sc.color}`}>{eleitoresFiltrados.length}</span>
                      <span className="text-2xl text-white/30">/ {minhaMeta}</span>
                    </div>
                    <p className="text-sm text-white/40 mb-5">
                      {faltam > 0 ? `Faltam ${faltam} cadastros` : "Meta atingida!"}
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/40">Progresso</span>
                        <span className={`font-bold ${sc.color}`}>{progressoMeta}%</span>
                      </div>
                      <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${sc.bar}`}
                          style={{ width: `${Math.min(progressoMeta, 100)}%` }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-4 py-2">
                    <span className="text-4xl text-white/15">—</span>
                    <div>
                      <p className="text-white/50 font-medium">Meta não definida</p>
                      <p className="text-xs text-white/25 mt-0.5">Aguarde seu coordenador definir uma meta para a equipe</p>
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })()}

          {/* ÚLTIMOS CADASTROS — P4 Localidade */}
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
                    <th className="text-left py-3 px-2 font-medium">Localidade</th>
                    <th className="text-left py-3 px-2 font-medium">Grau</th>
                    <th className="text-left py-3 px-2 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {eleitores.slice(0, 10).map((e) => (
                    <tr key={e.id} className="border-b border-white/[0.03]">
                      <td className="py-3 px-2 text-white/80">{e.nomeCompleto}</td>
                      <td className="py-3 px-2 text-white/60">{e.bairro ? `${e.bairro} · ${e.cidade}` : e.cidade}</td>
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
          {eleitoresFiltrados.length > 0 && (
            territorioConcentrado ? (
              <GlassCard className="p-5 flex flex-col justify-center gap-3">
                <div className="flex items-center gap-2">
                  <MapPin size={15} className="text-blue-400" />
                  <span className="text-xs text-blue-400 font-semibold uppercase tracking-wider">Território Concentrado</span>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">{concentracaoBairro}%</p>
                  <p className="text-sm text-white/60 mt-1">
                    {concentracaoBairro === 100 ? "100% da base está em" : `${concentracaoBairro}% da base está concentrada em`}{" "}
                    <span className="text-white font-medium">{bairrosArray[0].bairro}</span>.
                  </p>
                </div>
                {bairrosArray.length > 1 && (
                  <p className="text-xs text-white/30">
                    {bairrosArray.length - 1} outro{bairrosArray.length - 1 > 1 ? "s" : ""} bairro{bairrosArray.length - 1 > 1 ? "s" : ""} com presença menor.
                  </p>
                )}
              </GlassCard>
            ) : (
              bairrosArray.length > 0 && <ApoiadoresPorBairro data={bairrosArray.slice(0, 10)} />
            )
          )}
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
            <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
              <h3 className="text-white font-semibold">Últimos Cadastros</h3>
              <div className="flex items-center gap-1.5 flex-wrap">
                {([
                  { key: "",         label: "Todos"    },
                  { key: "forte",    label: "Fortes"   },
                  { key: "medio",    label: "Médios"   },
                  { key: "indeciso", label: "Indecisos"},
                  { key: "fraco",    label: "Fracos"   },
                  { key: "recentes", label: "Recentes" },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFiltroQualidade(key)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all border ${
                      filtroQualidade === key
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "text-white/30 border-white/[0.07] hover:text-white/55 hover:border-white/20"
                    }`}
                  >{label}</button>
                ))}
              </div>
            </div>
            {(() => {
              const agora = Date.now();
              const lista = filtroQualidade === "recentes"
                ? eleitores.filter((e) => parseDate(e.criadoEm).getTime() > agora - 7 * 86400000)
                : filtroQualidade
                ? eleitores.filter((e) => e.grauApoio === filtroQualidade)
                : eleitores;
              return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-white/40 border-b border-white/[0.06]"><th className="text-left py-3 px-2 font-medium">Nome</th><th className="text-left py-3 px-2 font-medium">Localidade</th><th className="text-left py-3 px-2 font-medium">Grau</th><th className="text-left py-3 px-2 font-medium">Colaborador</th><th className="text-left py-3 px-2 font-medium">Coordenador</th><th className="text-left py-3 px-2 font-medium">Data</th></tr></thead>
                <tbody>
                  {lista.slice(0, 15).map((e) => (
                    <tr key={e.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-2 text-white/80">{e.nomeCompleto}</td><td className="py-3 px-2 text-white/60">{e.bairro ? `${e.bairro} · ${e.cidade}` : e.cidade}</td>
                      <td className="py-3 px-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.grauApoio === "forte" ? "bg-emerald-500/20 text-emerald-400" : e.grauApoio === "medio" ? "bg-amber-500/20 text-amber-400" : e.grauApoio === "fraco" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>{e.grauApoio}</span></td>
                      <td className="py-3 px-2 text-white/60">{e.colaboradorNome}</td><td className="py-3 px-2 text-white/60">{e.coordenadorNome || "-"}</td><td className="py-3 px-2 text-white/40 text-xs">{formatDate(e.criadoEm)}</td>
                    </tr>
                  ))}
                  {lista.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-white/30">{filtroQualidade ? "Nenhum registro nesta categoria" : "Nenhum cadastro encontrado"}</td></tr>}
                </tbody>
              </table>
            </div>
              );
            })()}
          </GlassCard>
        </>
      )}

      {(isPolitico(userData) || isPrefeito(userData) || isVereador(userData)) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {crescimentoArray.length > 0 && <CrescimentoDiario data={crescimentoArray} />}
            {isPolitico(userData) && (
              <GlassCard className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users size={16} className="text-violet-400" />
                  <h3 className="text-white font-semibold">Desempenho das Assessorias</h3>
                  {assessorRanking.some((a) => a.total === 0) && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-amber-400/70">
                      <AlertTriangle size={11} />
                      {assessorRanking.filter((a) => a.total === 0).length} sem atividade
                    </span>
                  )}
                </div>
                {assessorRanking.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-white/30 text-sm">Nenhum assessor cadastrado</p>
                    <p className="text-white/20 text-xs mt-1">Adicione assessores ao gabinete para acompanhar o desempenho da equipe</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assessorRanking.map((a, idx) => {
                      const medals = ["🥇", "🥈", "🥉"];
                      const semAtividade = a.total === 0;
                      const rank = semAtividade ? "—" : (idx < 3 ? medals[idx] : `${idx + 1}º`);
                      const pct = semAtividade ? 0 : Math.round((a.total / maxAssessorTotal) * 100);
                      const corForte = a.pctForte >= 50 ? "text-emerald-400" : a.pctForte >= 30 ? "text-amber-400" : "text-red-400";
                      return (
                        <div key={a.id} className={`flex items-start gap-3 ${semAtividade ? "opacity-60" : ""}`}>
                          <span className="text-base w-8 shrink-0 text-center mt-1">{rank}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="min-w-0">
                                <p className={`text-sm font-semibold truncate ${a.semNome ? "text-amber-400" : "text-white"}`}>{a.nome}</p>
                                {a.semNome ? (
                                  <p className="text-xs text-amber-400/60 mt-0.5">Liderança não cadastrada no sistema</p>
                                ) : a.cidades.length > 0 ? (
                                  <p className="flex items-center gap-1 text-xs text-white/50 mt-0.5 truncate">
                                    <MapPin size={10} className="shrink-0 text-white/30" />
                                    {a.cidades.join(" · ")}
                                  </p>
                                ) : a.topTerr ? (
                                  <p className="text-xs text-white/40 truncate">{a.topTerr}</p>
                                ) : (
                                  <p className="text-xs text-white/25 truncate">Território não definido</p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                {semAtividade ? (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.05] text-white/30">Não iniciou</span>
                                ) : (
                                  <>
                                    <p className="text-sm font-bold text-white">{a.total}</p>
                                    <p className={`text-xs ${corForte}`}>{a.pctForte}% fortes</p>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="w-full bg-white/[0.04] rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </GlassCard>
            )}
            {isPrefeito(userData) && cidadesArray.length > 0 && <ApoiadoresPorCidade data={cidadesArray.slice(0, 10)} />}
            {isVereador(userData) && cidadesArray.length > 0 && <ApoiadoresPorCidade data={cidadesArray.slice(0, 10)} />}
            {isPolitico(userData)
              ? (territorioMap.length > 0 && (
                  <GlassCard className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Crown size={16} className="text-violet-400" />
                      <h3 className="text-white font-semibold">Top Territórios</h3>
                      <span className="text-xs text-white/30 ml-1">{territorioMap.length} territórios</span>
                    </div>
                    <div className="space-y-3">
                      {territorioMap.slice(0, 8).map((t, idx) => {
                        const medals = ["🥇", "🥈", "🥉"];
                        const rank = idx < 3 ? medals[idx] : `${idx + 1}º`;
                        const pct = Math.round((t.total / maxTerrTotal) * 100);
                        return (
                          <div key={t.territorio} className="flex items-center gap-3">
                            <span className="text-base w-8 shrink-0 text-center">{rank}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <div className="min-w-0">
                                  <span className="text-sm text-white/80 truncate block">{t.territorio}</span>
                                  <span className="text-xs text-emerald-400/60">{t.total > 0 ? Math.round((t.fortes / t.total) * 100) : 0}% fortes</span>
                                </div>
                                <span className="text-sm text-white/50 shrink-0 ml-2">{t.total}</span>
                              </div>
                              <div className="w-full bg-white/[0.04] rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </GlassCard>
                ))
              : (estadosArray.length > 0 && <ApoiadoresPorEstado data={estadosArray} />)}
            {isPolitico(userData) && cidadesArray.length > 0 && (
              <ApoiadoresPorCidade data={cidadesArray.slice(0, 10)} />
            )}
            {isPolitico(userData) && crescimentoTerritorial.length > 0 && (
              <GlassCard className="p-5">
                <div className="flex items-center gap-2 mb-5">
                  <TrendingUp size={16} className="text-violet-400" />
                  <h3 className="text-white font-semibold">Crescimento Territorial — 30 dias</h3>
                </div>
                <div className="space-y-3">
                  {crescimentoTerritorial.map((item) => (
                    <div key={item.cidade} className="flex items-center gap-3">
                      <span className="text-sm text-white/70 w-28 shrink-0 truncate">{item.cidade}</span>
                      <div className="flex-1 bg-white/[0.04] rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${item.delta >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                          style={{ width: `${Math.round((Math.abs(item.delta) / maxCrescDelta) * 100)}%` }}
                        />
                      </div>
                      <span className={`text-sm font-bold w-14 text-right shrink-0 ${item.delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {item.delta > 0 ? "+" : ""}{item.delta}%
                      </span>
                      <span className="text-xs text-white/25 w-12 text-right shrink-0">{item.atual} cad.</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-white/20 mt-4">Últimos 30 dias vs. 30 dias anteriores</p>
              </GlassCard>
            )}
          </div>

          {/* COBERTURA TERRITORIAL — municípios sem assessor com eleitores cadastrados */}
          {isPolitico(userData) && municipiosSemAssessor.length > 0 && (
            <GlassCard className="p-4 border-red-500/20">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="text-red-400" />
                  <h3 className="text-white font-semibold text-sm">Cobertura Territorial</h3>
                </div>
                <span className="text-xs text-red-400/70 px-2 py-0.5 rounded-full bg-red-500/10">🔴 Sem Assessoria Regional</span>
              </div>
              <p className="text-sm text-white/70 mb-3">
                {municipiosSemAssessor.length} {municipiosSemAssessor.length === 1 ? "município possui apoiadores cadastrados, mas ainda não possui" : "municípios possuem apoiadores cadastrados, mas ainda não possuem"} assessoria regional responsável.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {municipiosSemAssessor.map(({ label }) => (
                  <span key={label} className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400/80">• {label}</span>
                ))}
              </div>
              <a href="/assessores" className="inline-flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-300 transition-colors">
                <span>→</span> Designar assessoria regional
              </a>
            </GlassCard>
          )}

          {/* ESTRUTURA TERRITORIAL — municípios com assessor mas sem coordenador */}
          {isPolitico(userData) && municipiosSemCoordenador.length > 0 && (
            <GlassCard className="p-4 border-amber-500/20">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="text-amber-400" />
                  <h3 className="text-white font-semibold text-sm">Estrutura Territorial</h3>
                </div>
                <span className="text-xs text-amber-400/70 px-2 py-0.5 rounded-full bg-amber-500/10">🟡 Estrutura Incompleta</span>
              </div>
              <p className="text-sm text-white/70 mb-3">
                {municipiosSemCoordenador.length} {municipiosSemCoordenador.length === 1 ? "município já atribuído a assessores, mas sem" : "municípios já atribuídos a assessores, mas sem"} coordenação ativa.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {municipiosSemCoordenador.map(({ cidade, assessorNome }) => (
                  <span key={cidade} className="text-xs px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400/80">
                    • {cidade} <span className="text-white/25">— {assessorNome}</span>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <a
                  href={`/coordenadores?alertaEstrutura=${municipiosSemCoordenador.map(({ cidade, assessorNome }) => `${encodeURIComponent(cidade)}|${encodeURIComponent(assessorNome)}`).join(",")}`}
                  className="inline-flex items-center gap-1.5 text-xs text-amber-400/70 hover:text-amber-300 transition-colors"
                >
                  <span>→</span> Ver coordenadores
                </a>
                <button
                  data-testid="btn-abrir-determinacao"
                  onClick={() => setModalDeterminacao({
                    territorio: municipiosSemCoordenador.map((m) => m.cidade).join(", "),
                    acao: "Criar coordenação operacional",
                    assessorNome: municipiosSemCoordenador[0]?.assessorNome || "Assessor Executivo",
                  })}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-violet-500/15 text-violet-300 border border-violet-500/25 hover:bg-violet-500/25 transition-colors"
                >
                  Determinar Providência
                </button>
              </div>
            </GlassCard>
          )}

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
                  {cidadesArray.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center">
                        <p className="text-white/30 text-sm">Nenhum eleitor cadastrado</p>
                        <p className="text-white/20 text-xs mt-1">Os dados aparecerão aqui conforme sua equipe realizar cadastros em campo</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}

      {/* MINHAS DETERMINAÇÕES — P6 Sprint 20 */}
      {isPolitico(userData) && (
        <GlassCard className="p-5 border-violet-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crown size={16} className="text-violet-400" />
              <h3 className="text-white font-semibold">Minhas Determinações</h3>
              {determinacoes.filter((d) => d.status === "pendente").length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold">
                  {determinacoes.filter((d) => d.status === "pendente").length}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {(["pendente", "em_andamento", "concluida"] as const).map((s) => {
                const cnt = determinacoes.filter((d) => d.status === s).length;
                return (
                  <button
                    key={s}
                    onClick={() => setAbaDeterminacao(s)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                      abaDeterminacao === s ? "bg-violet-500/20 text-violet-300" : "text-white/30 hover:text-white/50"
                    }`}
                  >
                    {s === "pendente" ? "Pendentes" : s === "em_andamento" ? "Em andamento" : "Concluídas"}
                    {cnt > 0 && (
                      <span className={`text-[9px] px-1 rounded-full ${abaDeterminacao === s ? "bg-violet-500/30 text-violet-200" : "bg-white/10 text-white/40"}`}>
                        {cnt}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {determinacoes.filter((d) => d.status === abaDeterminacao).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/25 text-sm">
                {abaDeterminacao === "pendente" ? "Nenhuma determinação pendente" :
                 abaDeterminacao === "em_andamento" ? "Nenhuma determinação em andamento" :
                 "Nenhuma determinação concluída ainda"}
              </p>
              {abaDeterminacao === "pendente" && (
                <p className="text-white/15 text-xs mt-1">Use os alertas territoriais para determinar providências</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {determinacoes.filter((d) => d.status === abaDeterminacao).map((det) => {
                const prazoDate = det.prazo?.toDate?.() ?? null;
                const diasRestantes = prazoDate ? Math.ceil((prazoDate.getTime() - Date.now()) / 86400000) : null;
                const prazoColor = diasRestantes === null ? "text-white/30"
                  : diasRestantes < 0 ? "text-red-400"
                  : diasRestantes <= 2 ? "text-amber-400"
                  : "text-emerald-400";
                return (
                  <div key={det.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-white/10 transition-colors">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      det.status === "pendente" ? "bg-red-400" :
                      det.status === "em_andamento" ? "bg-amber-400" : "bg-emerald-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80 font-medium truncate">{det.assunto}</p>
                      <p className="text-[11px] text-white/35 mt-0.5">{det.municipios?.join(", ") || det.territorio}</p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-[10px] text-white/25">Para: <span className="text-white/45">{det.destinatarioNome || "Assessor Executivo"}</span></span>
                        {prazoDate && (
                          <span className={`text-[10px] ${prazoColor}`}>
                            {diasRestantes! < 0 ? `Vencido há ${Math.abs(diasRestantes!)}d` :
                             diasRestantes === 0 ? "Vence hoje" :
                             `${diasRestantes}d restantes`}
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          det.prioridade === "Alta" ? "bg-red-500/15 text-red-300" :
                          det.prioridade === "Media" ? "bg-amber-500/15 text-amber-300" :
                          "bg-white/5 text-white/30"
                        }`}>{det.prioridade}</span>
                      </div>
                      {det.status === "concluida" && (
                        <div className="mt-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                          <p className="text-[10px] font-semibold text-emerald-400/60 uppercase tracking-wider mb-2">Prestação de Contas</p>
                          {(det.conclusaoItems as string[] | undefined)?.filter(Boolean).map((item, i) => (
                            <p key={i} className="text-[11px] text-emerald-300/75 flex items-start gap-1.5 mb-1">
                              <span className="text-emerald-500/60 shrink-0 mt-px">✓</span>{item}
                            </p>
                          ))}
                          {det.resultado && <p className="text-[11px] text-white/45 mt-2 italic">{det.resultado}</p>}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {det.destinatarioNome && (
                              <span className="text-[10px] text-white/30">Por: <span className="text-white/50">{det.destinatarioNome}</span></span>
                            )}
                            {det.tempoExecucaoDias != null && (
                              <span className="text-[10px] text-emerald-400/60">Concluído em {det.tempoExecucaoDias}d</span>
                            )}
                            {det.concluidoEm?.toDate && (
                              <span className="text-[10px] text-white/25">{det.concluidoEm.toDate().toLocaleDateString("pt-BR")}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      )}

      {/* MODAL DE DETERMINAÇÃO — P3 Sprint 20 */}
      {modalDeterminacao && (() => {
        const ae = usuarios.find((u) => u.role === "assessor_executivo");
        const prazoData = new Date(Date.now() + determinacaoForm.prazo * 86400000);
        const handleEnviarDeterminacao = async () => {
          if (!userData || !modalDeterminacao) return;
          if (!ae) {
            toast.error("Nenhum Assessor Executivo encontrado neste gabinete. Verifique se o AE foi cadastrado corretamente.");
            return;
          }
          setDeterminacaoEnviando(true);
          try {
            const campanhaId = userData.campanhaId || userData.gabineteId || "";
            const assunto = determinacaoForm.assunto || modalDeterminacao.acao;
            const municipios = modalDeterminacao.territorio.split(",").map((s) => s.trim()).filter(Boolean);
            await addDoc(collection(db, "determinacoes"), {
              campanhaId,
              criadoPorId:      userData.uid,
              criadoPorNome:    userData.nome,
              destinatarioId:   ae.uid,
              destinatarioNome: ae.nome,
              destinatarioRole: "assessor_executivo",
              municipios,
              assunto,
              descricao:        determinacaoForm.descricao,
              prioridade:       determinacaoForm.prioridade,
              prazo:            Timestamp.fromDate(prazoData),
              status:           "pendente",
              criadoEm:         Timestamp.now(),
              atualizadoEm:     Timestamp.now(),
            });
            // Notificar AE em tempo real
            await criarNotificacao({
              campanhaId,
              usuarioId:      ae.uid,
              tipo:           "determinacao",
              titulo:         "Nova determinação recebida",
              descricao:      `${assunto}${municipios.length ? ` · ${municipios[0]}` : ""} · Prioridade ${determinacaoForm.prioridade}`,
              link:           "/dashboard",
              prioridade:     determinacaoForm.prioridade === "Alta" ? "alta" : determinacaoForm.prioridade === "Critica" ? "critica" : "media",
              remetenteNome:  userData.nome,
              origemTipo:     "determinacao",
            });
            const snap = await getDocs(query(collection(db, "determinacoes"), where("campanhaId", "==", campanhaId), where("criadoPorId", "==", userData.uid)));
            setDeterminacoes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setModalDeterminacao(null);
            setDeterminacaoForm({ assunto: "", prioridade: "Alta", prazo: 7, descricao: "" });
            toast.success("Determinação enviada ao Assessor Executivo");
          } catch (e) {
            console.error(e);
            toast.error("Erro ao enviar determinação");
          } finally {
            setDeterminacaoEnviando(false);
          }
        };
        return (
          <div data-testid="modal-determinacao" className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setModalDeterminacao(null)}>
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-5" onClick={(e) => e.stopPropagation()}>
              {/* Cabeçalho */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                  <Crown size={18} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-xs text-white/30 uppercase tracking-wider">Nova Determinação</p>
                  <p className="text-lg font-bold text-white">Determinar Providência</p>
                </div>
              </div>

              {/* Destinatário */}
              <div className="p-3 rounded-xl bg-violet-500/[0.07] border border-violet-500/15">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Destinatário</p>
                <p className="text-sm font-medium text-white/80">{ae?.nome || "Assessor Executivo"}</p>
                <p className="text-[11px] text-white/30">Assessor Executivo</p>
              </div>

              {/* Municípios */}
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Municípios</p>
                <div className="flex flex-wrap gap-1.5">
                  {modalDeterminacao.territorio.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                    <span key={t} className="text-xs px-2 py-1 rounded-lg bg-white/[0.05] text-white/60 border border-white/[0.07]">• {t}</span>
                  ))}
                </div>
              </div>

              {/* Assunto */}
              <div>
                <label className="block text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Assunto</label>
                <input
                  data-testid="input-assunto-determinacao"
                  type="text"
                  value={determinacaoForm.assunto || modalDeterminacao.acao}
                  onChange={(e) => setDeterminacaoForm((f) => ({ ...f, assunto: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-violet-500/40 placeholder-white/20"
                  placeholder={modalDeterminacao.acao}
                />
              </div>

              {/* Prioridade + Prazo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Prioridade</label>
                  <select
                    data-testid="select-prioridade-determinacao"
                    value={determinacaoForm.prioridade}
                    onChange={(e) => setDeterminacaoForm((f) => ({ ...f, prioridade: e.target.value }))}
                    className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-violet-500/40"
                  >
                    <option value="Alta">Alta</option>
                    <option value="Media">Média</option>
                    <option value="Baixa">Baixa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Prazo (dias)</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={determinacaoForm.prazo}
                    onChange={(e) => setDeterminacaoForm((f) => ({ ...f, prazo: Number(e.target.value) }))}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-violet-500/40"
                  />
                </div>
              </div>
              <p className="text-[11px] text-white/25 -mt-3">Prazo: até {prazoData.toLocaleDateString("pt-BR")}</p>

              {/* Descrição */}
              <div>
                <label className="block text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Descrição (opcional)</label>
                <textarea
                  data-testid="textarea-descricao-determinacao"
                  rows={2}
                  value={determinacaoForm.descricao}
                  onChange={(e) => setDeterminacaoForm((f) => ({ ...f, descricao: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-violet-500/40 placeholder-white/20 resize-none"
                  placeholder="Contexto adicional para o assessor..."
                />
              </div>

              {/* Botões */}
              <div className="flex gap-3">
                <button
                  data-testid={!ae ? "badge-ae-nao-encontrado" : "btn-enviar-determinacao"}
                  onClick={handleEnviarDeterminacao}
                  disabled={determinacaoEnviando || !ae}
                  title={!ae ? "Nenhum Assessor Executivo encontrado neste gabinete" : undefined}
                  className="flex-1 py-3 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {determinacaoEnviando ? "Enviando..." : !ae ? "AE não encontrado" : "Enviar Determinação"}
                </button>
                <button
                  onClick={() => { setModalDeterminacao(null); setDeterminacaoForm({ assunto: "", prioridade: "Alta", prazo: 7, descricao: "" }); }}
                  className="px-5 py-3 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

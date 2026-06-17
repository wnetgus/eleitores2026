"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { ApoiadoresPorBairro } from "@/components/charts/ApoiadoresPorBairro";
import { CrescimentoDiario } from "@/components/charts/CrescimentoDiario";
import { RankingColaboradores } from "@/components/charts/RankingColaboradores";
import { ApoiadoresPorEstado } from "@/components/charts/ApoiadoresPorEstado";
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

  useEffect(() => {
    async function load() {
      try {
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
        // Assessorias criadas — para o motor perceber municípios com cobertura real
        if (isPolitico(userData)) {
          const aSnap = await getDocs(collection(db, "assessorias"));
          setAssessoriasCriadas(new Set(aSnap.docs.map((d) => d.data().municipio as string).filter(Boolean)));
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
    const pctForte = eleitoresFiltrados.filter((e) => e.grauApoio === "forte").length / total;
    const d30 = eleitoresFiltrados.filter((e) => parseDate(e.criadoEm).getTime() > Date.now() - 30 * 86400000).length;
    const qualidade      = Math.min(40, Math.round(pctForte * 100 * 0.4));
    const crescScore     = crescimento30dPolitico > 20 ? 25 : crescimento30dPolitico > 5 ? 18 : crescimento30dPolitico > 0 ? 10 : 0;
    const diversScore    = Math.round((1 - concentracaoRisco / 100) * 20);
    const atividadeScore = Math.min(15, Math.round((d30 / total) * 15));
    return Math.min(100, Math.round(qualidade + crescScore + diversScore + atividadeScore));
  })() : 0;

  const pendenciasDemo = isPolitico(userData) ? ordenarPendencias([
    criarPendencia({ tipo: "critica", titulo: "Designar Assessoria",  descricao: "Município possui eleitores mas não possui assessoria.",   territorio: "Surubim",   origem: "Força Territorial", destino: "/assessores",   acao: "Designar Assessoria" }),
    criarPendencia({ tipo: "alta",    titulo: "Recuperar Base",       descricao: "Base em risco.",                                          territorio: "Garanhuns", origem: "Base Eleitoral",   destino: "/relatorios",   acao: "Recuperar Base"      }),
    criarPendencia({ tipo: "media",   titulo: "Criar Coordenação",    descricao: "Assessor presente sem coordenação.",                      territorio: "Timbaúba",  origem: "Força Territorial", destino: "/coordenadores", acao: "Criar Coordenação"   }),
  ]) : [];
  const resumoPendencias = isPolitico(userData) ? getResumoPendencias(pendenciasDemo) : null;

  const eventosDemo: EventoMandato[] = isPolitico(userData) ? [
    { data: "03/03/2026", cidade: "Recife",    titulo: "Assessoria Regional Criada",  descricao: "Primeira estrutura oficial.",              responsavel: "Marcos Andrade", tipo: "estrutura"   },
    { data: "15/04/2026", cidade: "Olinda",    titulo: "Coordenação Implantada",       descricao: "Operação consolidada.",                    responsavel: "Marcos Andrade", tipo: "estrutura"   },
    { data: "02/05/2026", cidade: "Petrolina", titulo: "Plano de Recuperação",         descricao: "Base em risco entrou em recuperação.",     responsavel: "Pedro Coelho",   tipo: "recuperacao" },
    { data: "18/06/2026", cidade: "Surubim",   titulo: "Expansão Territorial",         descricao: "Novo município incluído.",                 responsavel: "Pedro Coelho",   tipo: "expansao"    },
    { data: "22/06/2026", cidade: "Recife",    titulo: "Meta Atingida",                descricao: "Meta regional alcançada.",                 responsavel: "Marcos Andrade", tipo: "meta"        },
  ] : [];

  const alertasDemo: AlertaExecutivo[] = isPolitico(userData) ? [
    { tipo: "critico",      titulo: "30 dias sem evolução",      descricao: "Garanhuns permanece sem recuperação.",  cidade: "Garanhuns", responsavel: "Carla Neves",    tempo: "há 2 horas", acao: "Abrir plano"           },
    { tipo: "oportunidade", titulo: "57 indecisos disponíveis",  descricao: "Recife apresenta alto potencial.",      cidade: "Recife",    responsavel: "Marcos Andrade", tempo: "há 4 horas", acao: "Intensificar conversão" },
    { tipo: "sucesso",      titulo: "Estrutura consolidada",     descricao: "Olinda atingiu estabilidade.",          cidade: "Olinda",    responsavel: "Marcos Andrade", tempo: "ontem",      acao: "Visualizar"            },
    { tipo: "atencao",      titulo: "Meta abaixo do esperado",   descricao: "Petrolina caiu para 8% de força.",     cidade: "Petrolina", responsavel: "Pedro Coelho",   tempo: "há 1 dia",   acao: "Revisar meta"          },
  ] : [];

  const agendaDemo: AgendaItem[] = isPolitico(userData) ? [
    { cidade: "Garanhuns", titulo: "Reunir Assessoria",     descricao: "Plano de recuperação parado.",  responsavel: "Carla Neves",    prioridade: "critica", status: "hoje"        },
    { cidade: "Surubim",   titulo: "Designar Assessoria",   descricao: "Município sem estrutura.",       responsavel: "Pedro Coelho",   prioridade: "alta",    status: "esta_semana" },
    { cidade: "Olinda",    titulo: "Estrutura Consolidada", descricao: "Nenhuma ação necessária.",       responsavel: "Marcos Andrade", prioridade: "normal",  status: "concluida"   },
  ] : [];

  const decisoesDemo: DecisaoPolitica[] = isPolitico(userData) ? [
    { cidade: "Surubim",   titulo: "Assessoria Regional Planejada", descricao: "Município sem cobertura política.", responsavel: "Pedro Coelho",   criadoEm: "15/06/2026", prazoDias: 15, status: "em_andamento", historico: ["Pendência criada", "Plano aprovado", "Assessoria em implantação"] },
    { cidade: "Garanhuns", titulo: "Plano de Recuperação",          descricao: "Baixa força política.",            responsavel: "Carla Neves",    criadoEm: "10/06/2026", prazoDias: 20, status: "atrasada",     historico: ["Plano criado",      "Meta definida",    "Sem evolução"               ] },
    { cidade: "Olinda",    titulo: "Estrutura Consolidada",         descricao: "Operação funcionando.",            responsavel: "Marcos Andrade", criadoEm: "05/06/2026", prazoDias: 5,  status: "concluida",    historico: ["Assessoria criada", "Coordenação criada", "Estrutura ativa"           ] },
  ] : [];

  const execucaoDemo: ExecucaoItem[] = isPolitico(userData) ? [
    { cidade: "Olinda",   status: "concluida",    responsavel: "Marcos Andrade", descricao: "Assessoria consolidada",          dias: 5  },
    { cidade: "Surubim",  status: "em_andamento", responsavel: "Pedro Coelho",   descricao: "Criando assessoria regional",     dias: 15 },
    { cidade: "Timbaúba", status: "atrasada",     responsavel: "Carlos Silva",   descricao: "Coordenação ainda não criada",    dias: 20 },
  ] : [];
  // territoriosDemo: dados representativos dos 10 municípios do cenário executivo.
  // Projetados para gerar pendencias=4, agenda=4, alertas=3, decisoes=4, memoria=4.
  const territoriosDemo: TerritorioPolitico[] = isPolitico(userData) ? [
    // Territórios saudáveis — nenhuma regra dispara
    { cidade: "Recife",    eleitores: 210, fortes: 60, medios: 80, indecisos: 50, fracos: 20, crescimento30d: 12,  possuiAssessoria: true,  possuiCoordenacao: true,  assessorResponsavel: "Marcos Andrade" },
    { cidade: "Caruaru",   eleitores: 95,  fortes: 18, medios: 35, indecisos: 28, fracos: 14, crescimento30d: 5,   possuiAssessoria: true,  possuiCoordenacao: true,  assessorResponsavel: "Ana Ferreira"   },
    { cidade: "Olinda",    eleitores: 78,  fortes: 30, medios: 25, indecisos: 15, fracos: 8,  crescimento30d: 22,  possuiAssessoria: true,  possuiCoordenacao: true,  assessorResponsavel: "Marcos Andrade" },
    { cidade: "Palmares",  eleitores: 25,  fortes: 6,  medios: 9,  indecisos: 7,  fracos: 3,  crescimento30d: 8,   possuiAssessoria: true,  possuiCoordenacao: true,  assessorResponsavel: "Sônia Barbosa"  },
    // Regra 3 — base forte < 10% → pendência alta
    { cidade: "Garanhuns", eleitores: 48,  fortes: 4,  medios: 12, indecisos: 24, fracos: 8,  crescimento30d: -5,  possuiAssessoria: true,  possuiCoordenacao: true,  assessorResponsavel: "Carla Neves"    },
    // Regra 1 — sem assessoria → pendência crítica + Regra 4 → alerta oportunidade
    { cidade: "Salgueiro", eleitores: 30,  fortes: 5,  medios: 10, indecisos: 10, fracos: 5,  crescimento30d: 120, possuiAssessoria: assessoriasCriadas.has("Salgueiro"), possuiCoordenacao: false, assessorResponsavel: ""               },
    // Regra 1 — sem assessoria → pendência crítica
    { cidade: "Surubim",   eleitores: 4,   fortes: 1,  medios: 2,  indecisos: 1,  fracos: 0,  crescimento30d: 0,   possuiAssessoria: assessoriasCriadas.has("Surubim"),   possuiCoordenacao: false, assessorResponsavel: "Pedro Coelho"   },
    // Regra 4 — crescimento > 100 → alerta oportunidade
    { cidade: "Caetés",    eleitores: 18,  fortes: 4,  medios: 7,  indecisos: 5,  fracos: 2,  crescimento30d: 200, possuiAssessoria: true,  possuiCoordenacao: true,  assessorResponsavel: "Fábio Lira"     },
    // Regra 5 — crescimento < -20 → alerta atenção
    { cidade: "Petrolina", eleitores: 60,  fortes: 10, medios: 20, indecisos: 18, fracos: 12, crescimento30d: -25, possuiAssessoria: true,  possuiCoordenacao: true,  assessorResponsavel: "Pedro Coelho"   },
    // Regra 2 — assessoria sem coordenação → pendência media
    { cidade: "Timbaúba",  eleitores: 12,  fortes: 2,  medios: 4,  indecisos: 4,  fracos: 2,  crescimento30d: 3,   possuiAssessoria: true,  possuiCoordenacao: false, assessorResponsavel: "Carlos Silva"   },
  ] : [];

  const motor = isPolitico(userData) ? executarMotorTerritorial(territoriosDemo) : null;

  if (process.env.NODE_ENV === "development" && motor) {
    console.log("[Motor Estratégico]", {
      pendencias: motor.pendencias.length,
      agenda:     motor.agenda.length,
      alertas:    motor.alertas.length,
      decisoes:   motor.decisoes.length,
      memoria:    motor.memoria.length,
    });
  }

  // Sprint 7 — substituição controlada: motor tem prioridade, demo é fallback
  const pendenciasMotor = motor?.pendencias ?? [];
  const pendenciasAtivas = pendenciasMotor.length > 0 ? pendenciasMotor : pendenciasDemo;
  const resumoPendenciasAtivas = isPolitico(userData) ? getResumoPendencias(pendenciasAtivas) : null;

  // Sprint 8 — Agenda Executiva via motor
  const agendaMotor = motor?.agenda ?? [];
  const agendaAtiva = agendaMotor.length > 0 ? agendaMotor : agendaDemo;

  // Sprint 9 — Central de Alertas via motor
  const alertasMotor = motor?.alertas ?? [];
  const alertasAtivos = alertasMotor.length > 0 ? alertasMotor : alertasDemo;

  // Sprint 10 — Central de Decisões via motor
  const decisoesMotor = motor?.decisoes ?? [];
  const decisoesAtivas = decisoesMotor.length > 0 ? decisoesMotor : decisoesDemo;

  // Sprint 11 — Memória do Mandato via motor
  const memoriaMotor = motor?.memoria ?? [];
  const memoriaAtiva = memoriaMotor.length > 0 ? memoriaMotor : eventosDemo;

  type PendenciaExtra = { responsavel: string; stats?: { label: string; value: string }[]; assessor?: string };
  const PENDENCIA_EXTRA: Record<string, PendenciaExtra> = {
    "Força Territorial-Surubim-Designar Assessoria": { responsavel: "Pedro Coelho", stats: [{ label: "Apoiadores", value: "4" }] },
    "Base Eleitoral-Garanhuns-Recuperar Base":        { responsavel: "Carla Neves",  stats: [{ label: "Base Forte", value: "8%" }, { label: "Indecisos", value: "24" }, { label: "Tendência", value: "+91%" }] },
    "Força Territorial-Timbaúba-Criar Coordenação":   { responsavel: "Carlos Silva", assessor: "Carlos Silva", stats: [{ label: "Apoiadores", value: "0" }] },
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
            <p className="text-xs text-white/40">{isPolitico(userData) ? "Político" : "Operador"}</p>
            <p className="text-sm text-white/80 font-medium">{userData.nome}</p>
            <p className={`text-xs ${roleInfo.text}`}>{roleInfo.label}</p>
          </div>
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
              <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2">Índice de Saúde Territorial</p>
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
                  <p className={`text-xs font-medium mt-0.5 ${indiceSaudeTerritorial >= 76 ? "text-emerald-400" : indiceSaudeTerritorial >= 51 ? "text-emerald-400" : indiceSaudeTerritorial >= 26 ? "text-amber-400" : "text-red-400"}`}>
                    {indiceSaudeTerritorial >= 76 ? "Forte" : indiceSaudeTerritorial >= 51 ? "Saudável" : indiceSaudeTerritorial >= 26 ? "Atenção" : "Crítico"}
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
            <div className="space-y-3">
              {prioridades.map((p, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03]">
                  <span className="text-xl shrink-0">{p.emoji}</span>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${p.cor}`}>{p.titulo}</p>
                    <p className="text-xs text-white/40 mt-0.5">{p.descricao}</p>
                  </div>
                </div>
              ))}
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

      {/* MOTOR ESTRATÉGICO — card de validação (somente leitura) */}
      {isPolitico(userData) && motor && (
        <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🧠</span>
            <h3 className="text-white font-semibold text-sm">Motor Estratégico</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/10">validação</span>
          </div>
          <div className="grid grid-cols-5 gap-2 text-center">
            {([
              { label: "Pendências", value: motor.pendencias.length },
              { label: "Agenda",     value: motor.agenda.length     },
              { label: "Alertas",    value: motor.alertas.length    },
              { label: "Decisões",   value: motor.decisoes.length   },
              { label: "Memória",    value: motor.memoria.length    },
            ] as const).map(({ label, value }) => (
              <div key={label} className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <p className="text-lg font-bold text-white">{value}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{label}</p>
              </div>
            ))}
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
                  {/* Badge Fase Operacional */}
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
                    <span className="text-sm shrink-0">⚡</span>
                    <div>
                      <p className="text-xs font-bold text-violet-400 tracking-wider">FASE OPERACIONAL</p>
                      <p className="text-[11px] text-white/40">Esta ação estará disponível na próxima etapa do sistema.</p>
                    </div>
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
                          onClick={() => { setModalPendencia(null); router.push(`/assessores?cidade=${p.territorio}&acao=nova`); }}
                          className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
                        >
                          Ir para Assessoria →
                        </button>
                        <button onClick={() => setModalPendencia(null)} className="px-5 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-colors">Cancelar</button>
                      </div>
                    </>
                  )}

                  {/* Modal: Recuperar Base (alta) — Plano Executivo */}
                  {p.tipo === "alta" && (
                    <>
                      {/* Título */}
                      <div>
                        <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">Recuperação de Base</p>
                        <p className="text-lg font-bold text-white uppercase tracking-wide">{p.territorio}</p>
                      </div>

                      {/* Seção 1 — Diagnóstico */}
                      <div>
                        <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Diagnóstico</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-center p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                            <p className="text-base font-bold text-amber-400">8%</p>
                            <p className="text-[10px] text-white/30 mt-0.5">Base Forte</p>
                          </div>
                          <div className="text-center p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                            <p className="text-base font-bold text-blue-400">24</p>
                            <p className="text-[10px] text-white/30 mt-0.5">Indecisos</p>
                          </div>
                          <div className="text-center p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                            <p className="text-base font-bold text-emerald-400">+91%</p>
                            <p className="text-[10px] text-white/30 mt-0.5">Tendência</p>
                          </div>
                          <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                            <span className="text-[10px] font-bold text-red-400 tracking-wider">INTERVENÇÃO</span>
                            <span className="text-[10px] font-bold text-red-400 tracking-wider">NECESSÁRIA</span>
                          </div>
                        </div>
                      </div>

                      {/* Seção 2 — Meta de Recuperação */}
                      <div>
                        <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Meta de Recuperação</p>
                        <div className="space-y-0">
                          {[
                            { label: "Atual",       value: "8%",  color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20"     },
                            { label: "Meta 30 dias", value: "15%", color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20"   },
                            { label: "Meta 60 dias", value: "20%", color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20"    },
                            { label: "Meta 90 dias", value: "30%", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
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

                      {/* Seção 3 — Plano de Ação */}
                      <div>
                        <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Plano de Ação</p>
                        <div className="space-y-1.5">
                          {[
                            "Reunir assessoria regional",
                            "Intensificar conversão dos indecisos",
                            "Reforçar coordenação",
                            "Criar meta de recuperação",
                            "Monitoramento semanal",
                          ].map((a) => (
                            <label key={a} className="flex items-center gap-2 cursor-not-allowed">
                              <input type="checkbox" defaultChecked disabled className="w-4 h-4 accent-red-500" />
                              <span className="text-sm text-white/50">{a}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Seção 4 — Responsável */}
                      <div className="flex items-center justify-between">
                        <div className="text-sm space-y-0.5">
                          <p className="text-white/35 text-xs uppercase tracking-wider">Responsável</p>
                          <p className="text-white/70 font-medium">{extra.responsavel}</p>
                          <p className="text-white/35 text-xs">Prazo: <span className="text-white/55">60 dias</span></p>
                        </div>
                        <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 tracking-wider">
                          CRÍTICA
                        </span>
                      </div>

                      {/* Seção 5 — Resumo Executivo */}
                      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                        <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Resumo Executivo</p>
                        <p className="text-sm text-white/50 leading-relaxed">
                          O município apresenta baixa força política e exige atuação imediata. A prioridade é recuperar a base forte, ampliar a conversão dos indecisos e fortalecer a coordenação local.
                        </p>
                      </div>

                      {/* Rodapé */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setModalPendencia(null); setModalEstabDash(true); }}
                          className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
                        >
                          Confirmar Plano
                        </button>
                        <button onClick={() => setModalPendencia(null)} className="px-5 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-colors">Cancelar</button>
                      </div>
                    </>
                  )}

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
                          onClick={() => { setModalPendencia(null); router.push(`/coordenadores?cidade=${encodeURIComponent(p.territorio)}&assessor=${encodeURIComponent(extra.assessor ?? "")}&acao=nova`); }}
                          className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
                        >
                          Ir para Coordenadores →
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
            <div className="space-y-2">
              {pendenciasAtivas.map((p) => {
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
                        </div>
                        <p className="text-xs text-white/40 mb-2">{p.descricao}</p>
                        <p className={`text-xs font-semibold ${b.text}`}>{ACAO_REC[p.tipo]}</p>
                        <p className="text-xs text-white/25 mt-1">Responsável: {extra.responsavel}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-white/25 mb-1.5">15 dias</p>
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
      {isPolitico(userData) && execucaoDemo.length > 0 && (
        <PainelExecucao items={execucaoDemo} />
      )}

      {/* CENTRAL DE DECISÕES — deputado */}
      {isPolitico(userData) && decisoesAtivas.length > 0 && (
        <CentralDecisoes decisoes={decisoesAtivas} />
      )}

      {/* AGENDA EXECUTIVA — deputado */}
      {isPolitico(userData) && agendaAtiva.length > 0 && (
        <AgendaExecutiva items={agendaAtiva} />
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

      {/* FILTROS TERRITORIAIS */}
      {(isSuperOrMaster(userData) || isPolitico(userData) || isPrefeito(userData) || isAssessor(userData)) && (estadosDisponiveis.length > 0 || bairrosDisponiveis.length > 0) && (
        <div className="flex items-center gap-3 flex-wrap">
          <Filter size={16} className="text-white/30" />
          {(isSuperOrMaster(userData) || isPolitico(userData)) && estadosDisponiveis.length > 0 && (
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
              <a
                href={`/coordenadores?alertaEstrutura=${municipiosSemCoordenador.map(({ cidade, assessorNome }) => `${encodeURIComponent(cidade)}|${encodeURIComponent(assessorNome)}`).join(",")}`}
                className="inline-flex items-center gap-1.5 text-xs text-amber-400/70 hover:text-amber-300 transition-colors"
              >
                <span>→</span> Ver coordenadores
              </a>
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

    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, getDoc, query, orderBy, where, addDoc, serverTimestamp, doc, updateDoc, getDocs as getDocs2 } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Eleitor, AppUser, Meta, ROLE_CONFIG } from "@/types";
import { getRoleConfig, isSuperOrMaster, isPolitico, isAssessor, isCoordenador, isColaborador } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate, parseDate } from "@/lib/utils";
import { TrendingUp, Target, Zap, Flag, Save, Users, MapPin, Crown } from "lucide-react";
import toast from "react-hot-toast";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const STATUS_CONFIG = {
  excelente: { label: "Excelente", color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30", bar: "bg-emerald-500" },
  no_ritmo:  { label: "No Ritmo",  color: "text-blue-400",    bg: "bg-blue-500/15",    border: "border-blue-500/30",    bar: "bg-blue-500"    },
  atencao:   { label: "Atenção",   color: "text-amber-400",   bg: "bg-amber-500/15",   border: "border-amber-500/30",   bar: "bg-amber-500"   },
  critico:   { label: "Crítico",   color: "text-red-400",     bg: "bg-red-500/15",     border: "border-red-500/30",     bar: "bg-red-500"     },
  sem_meta:  { label: "Sem Meta",  color: "text-white/30",    bg: "bg-white/5",        border: "border-white/10",       bar: "bg-white/20"    },
} as const;

function getCoordStatus(prog: number, metaTotal: number): keyof typeof STATUS_CONFIG {
  if (metaTotal === 0) return "sem_meta";
  if (prog >= 100) return "excelente";
  if (prog >= 80) return "no_ritmo";
  if (prog >= 50) return "atencao";
  return "critico";
}

function fmtAtividade(dias: number): string {
  if (dias === 999) return "Sem atividade";
  if (dias === 0) return "Hoje";
  return `${dias}d atrás`;
}

type ColabStat = Omit<AppUser, "status"> & {
  total: number; metaVal: number; metaTipo: "individual" | "padrao" | "sem_meta";
  prog: number; diasSemAtividade: number; status: keyof typeof STATUS_CONFIG;
};

export default function MetasPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [colaboradores, setColaboradores] = useState<AppUser[]>([]);
  const [metas, setMetas] = useState<Record<string, number>>({});
  const [metasDocs, setMetasDocs] = useState<any[]>([]);
  const [formMeta, setFormMeta] = useState({ colaboradorId: "", valor: "" });
  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);
  const [grauPill, setGrauPill] = useState<"" | "forte" | "medio" | "fraco" | "indeciso">("");
  const [metaPadraoEquipe, setMetaPadraoEquipe] = useState(0);
  const [valorPadrao, setValorPadrao] = useState("");
  const [salvandoPadrao, setSalvandoPadrao] = useState(false);
  // mapa de coordenadores do assessor: { coordId → { nome, metaPadrao } }
  const [coordInfoMap, setCoordInfoMap] = useState<Record<string, { nome: string; metaPadrao: number }>>({});
  const [perfPill, setPerfPill] = useState<"" | "excelente" | "no_ritmo" | "atencao" | "critico">("");
  const [politicoCoordAssessorMap, setPoliticoCoordAssessorMap] = useState<Record<string, string>>({});
  const [politicoAssessorNomes, setPoliticoAssessorNomes] = useState<Record<string, string>>({});

  const podeGerenciarMetas = isSuperOrMaster(userData) || isAssessor(userData) || isCoordenador(userData);

  useEffect(() => {
    if (!userData) return;
    load();
  }, [userData]);

  async function load() {
    try {
      // Assessor: dois passos — coordenadores próprios → eleitores/colaboradores desses coords
      if (isAssessor(userData!)) {
        const coordSnap = await getDocs(query(collection(db, "usuarios"), where("role", "==", "coordenador"), where("assessorId", "==", userData!.uid)));
        const coordIds = coordSnap.docs.map((d) => d.id);
        const infoMap: Record<string, { nome: string; metaPadrao: number }> = {};
        coordSnap.docs.forEach((d) => {
          infoMap[d.id] = { nome: d.data().nome || "", metaPadrao: (d.data().metaPadraoEquipe as number) || 0 };
        });
        setCoordInfoMap(infoMap);
        if (coordIds.length > 0) {
          const gabIdMetas = userData!.gabineteId || userData!.campanhaId;
          const eQuery = gabIdMetas
            ? query(collection(db, "eleitores"), where("coordenadorId", "in", coordIds), where("campanhaId", "==", gabIdMetas))
            : query(collection(db, "eleitores"), where("coordenadorId", "in", coordIds));
          const uQuery = gabIdMetas
            ? query(collection(db, "usuarios"), where("role", "==", "colaborador"), where("coordenadorId", "in", coordIds), where("campanhaId", "==", gabIdMetas))
            : query(collection(db, "usuarios"), where("role", "==", "colaborador"), where("coordenadorId", "in", coordIds));
          const [esnap, uSnap] = await Promise.all([getDocs(eQuery), getDocs(uQuery)]);
          setEleitores(esnap.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor)));
          setColaboradores(uSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
        } else {
          setEleitores([]); setColaboradores([]);
        }
      } else {
        const constraints: any[] = [orderBy("criadoEm", "desc")];
        if (isColaborador(userData!)) {
          constraints.unshift(where("colaboradorId", "==", userData!.uid));
        } else if (isCoordenador(userData!)) {
          constraints.unshift(where("coordenadorId", "==", userData!.uid));
        }
        if (!isSuperOrMaster(userData!) && userData?.campanhaId) {
          constraints.unshift(where("campanhaId", "==", userData.campanhaId));
        }
        const q = query(collection(db, "eleitores"), ...constraints);
        const snap = await getDocs(q);
        setEleitores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor)));

        const uConstraints: any[] = [where("role", "==", "colaborador")];
        if (isCoordenador(userData)) {
          uConstraints.push(where("coordenadorId", "==", userData!.uid));
        } else if (!isSuperOrMaster(userData) && userData?.campanhaId) {
          uConstraints.push(where("campanhaId", "==", userData.campanhaId));
        }
        const uSnap = await getDocs(query(collection(db, "usuarios"), ...uConstraints));
        setColaboradores(uSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));

        if (isPolitico(userData!)) {
          const gabIdPol = userData!.campanhaId || userData!.gabineteId;
          if (gabIdPol) {
            const [coordSnap, assessorSnap] = await Promise.all([
              getDocs(query(collection(db, "usuarios"), where("role", "==", "coordenador"), where("campanhaId", "==", gabIdPol))),
              getDocs(query(collection(db, "usuarios"), where("role", "==", "assessor"), where("campanhaId", "==", gabIdPol))),
            ]);
            const cm: Record<string, string> = {};
            coordSnap.docs.forEach((d) => { const dt = d.data(); if (dt.assessorId) cm[d.id] = dt.assessorId; });
            const am: Record<string, string> = {};
            assessorSnap.docs.forEach((d) => { am[d.id] = d.data().nome || "Assessor"; });
            setPoliticoCoordAssessorMap(cm);
            setPoliticoAssessorNomes(am);
          }
        }
      }

      const gabIdForMetas = userData!.gabineteId || userData!.campanhaId;
      const mSnap = isSuperOrMaster(userData!)
        ? await getDocs(query(collection(db, "metas"), orderBy("criadoEm", "desc")))
        : isColaborador(userData!)
          ? await getDocs(query(collection(db, "metas"), where("colaboradorId", "==", userData!.uid)))
          : gabIdForMetas
            ? await getDocs(query(collection(db, "metas"), where("gabineteId", "==", gabIdForMetas)))
            : { docs: [] };
      const metasMap: Record<string, number> = {};
      const metasGabMap: Record<string, number> = {};
      const metasInfo: Record<string, { nome: string; meta: number; gabineteId?: string }> = {};
      mSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.colaboradorId) {
          metasMap[data.colaboradorId] = data.meta;
          metasInfo[data.colaboradorId] = { nome: data.colaboradorNome || "Colaborador", meta: data.meta, gabineteId: data.gabineteId };
        }
        if (data.gabineteId) {
          metasGabMap[data.gabineteId] = data.meta;
          metasInfo[data.gabineteId] = { nome: data.colaboradorNome || "Gabinete", meta: data.meta, gabineteId: data.gabineteId };
        }
      });
      setMetas(metasMap);
      setMetasDocs(mSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // Assessor: lê metaPadraoEquipe do próprio documento (meta padrão da assessoria)
      if (isAssessor(userData!)) {
        const padrao = userData!.metaPadraoEquipe || 0;
        setMetaPadraoEquipe(padrao);
        if (padrao > 0) setValorPadrao(String(padrao));
      }
      // Coordenador: lê metaPadraoEquipe do próprio documento
      if (isCoordenador(userData!)) {
        const padrao = userData!.metaPadraoEquipe || 0;
        setMetaPadraoEquipe(padrao);
        if (padrao > 0) setValorPadrao(String(padrao));
      }
      // Colaborador: cadeia coord → assessor como fallback
      if (isColaborador(userData!) && userData!.coordenadorId) {
        const coordDocSnap = await getDoc(doc(db, "usuarios", userData!.coordenadorId));
        if (coordDocSnap.exists()) {
          const coordData = coordDocSnap.data();
          const coordPadrao = (coordData.metaPadraoEquipe as number) || 0;
          if (coordPadrao > 0) {
            setMetaPadraoEquipe(coordPadrao);
          } else if (coordData.assessorId) {
            const assessorSnap = await getDoc(doc(db, "usuarios", coordData.assessorId));
            setMetaPadraoEquipe((assessorSnap?.data()?.metaPadraoEquipe as number) || 0);
          }
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function definirMeta() {
    if (!formMeta.colaboradorId || !formMeta.valor) { toast.error("Selecione colaborador e valor"); return; }
    const gabIdMeta = userData?.gabineteId || userData?.campanhaId;
    if (!gabIdMeta && !isSuperOrMaster(userData)) {
      toast.error("Gabinete não identificado — não é possível definir meta");
      return;
    }
    setSavingMeta(true);
    try {
      // query escopada por gabineteId para evitar conflito cross-campaign
      const existingQuery = gabIdMeta
        ? query(collection(db, "metas"), where("colaboradorId", "==", formMeta.colaboradorId), where("gabineteId", "==", gabIdMeta))
        : query(collection(db, "metas"), where("colaboradorId", "==", formMeta.colaboradorId));
      const existingSnap = await getDocs(existingQuery);
      if (!existingSnap.empty) {
        await updateDoc(doc(db, "metas", existingSnap.docs[0].id), {
          meta: Number(formMeta.valor),
          ...(gabIdMeta ? { gabineteId: gabIdMeta } : {}),
        });
      } else {
        await addDoc(collection(db, "metas"), {
          colaboradorId: formMeta.colaboradorId,
          meta: Number(formMeta.valor),
          criadoEm: serverTimestamp(),
          ...(gabIdMeta ? { gabineteId: gabIdMeta } : {}),
        });
      }
      toast.success("Meta definida!");
      setFormMeta({ colaboradorId: "", valor: "" });
      load();
    } catch (e) { toast.error("Erro ao salvar meta"); } finally { setSavingMeta(false); }
  }

  function resolverMeta(colabId: string): { valor: number; tipo: "individual" | "padrao" | "sem_meta"; origem?: "coord" | "assessor" } {
    if (metas[colabId] > 0) return { valor: metas[colabId], tipo: "individual" };
    if (isAssessor(userData)) {
      const colab = colaboradores.find((c) => c.uid === colabId);
      const coordPadrao = colab?.coordenadorId ? (coordInfoMap[colab.coordenadorId]?.metaPadrao || 0) : 0;
      if (coordPadrao > 0) return { valor: coordPadrao, tipo: "padrao", origem: "coord" };
      if (metaPadraoEquipe > 0) return { valor: metaPadraoEquipe, tipo: "padrao", origem: "assessor" };
      return { valor: 0, tipo: "sem_meta" };
    }
    if (metaPadraoEquipe > 0) return { valor: metaPadraoEquipe, tipo: "padrao" };
    return { valor: 0, tipo: "sem_meta" };
  }

  async function salvarMetaPadrao() {
    const val = Number(valorPadrao);
    if (!val || val < 1) { toast.error("Informe um valor válido"); return; }
    setSalvandoPadrao(true);
    try {
      await updateDoc(doc(db, "usuarios", userData!.uid), { metaPadraoEquipe: val });
      setMetaPadraoEquipe(val);
      toast.success(`Meta padrão: ${val} cadastros aplicada a toda a equipe`);
    } catch { toast.error("Erro ao salvar meta padrão"); } finally { setSalvandoPadrao(false); }
  }

  async function limparMetaPadrao() {
    await updateDoc(doc(db, "usuarios", userData!.uid), { metaPadraoEquipe: 0 });
    setMetaPadraoEquipe(0);
    setValorPadrao("");
    toast.success("Meta padrão removida");
  }

  if (!userData) return null;
  const config = getRoleConfig(userData);
  const roleInfo = ROLE_CONFIG[userData.role];

  const gabineteId = userData?.gabineteId || userData?.campanhaId;

  const diasMap = eleitores.reduce<Record<string, number>>((acc, e) => {
    const d = parseDate(e.criadoEm);
    const key = d.toLocaleDateString("pt-BR");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const crescimentoData = Object.entries(diasMap).map(([dia, total]) => ({ dia, total })).sort((a, b) => {
    const [dA, mA, yA] = a.dia.split("/").map(Number);
    const [dB, mB, yB] = b.dia.split("/").map(Number);
    return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
  });

  const hoje = new Date().toLocaleDateString("pt-BR");
  const cadastrosHoje = eleitores.filter((e) => parseDate(e.criadoEm).toLocaleDateString("pt-BR") === hoje).length;
  const mediaDia = eleitores.length > 0 ? (eleitores.length / Math.max(crescimentoData.length, 1)).toFixed(1) : 0;
  const { valor: minhaMeta, tipo: tipoMinhaMeta } = isColaborador(userData)
    ? resolverMeta(userData.uid)
    : { valor: 0, tipo: "sem_meta" as const };
  const progressoMeta = minhaMeta > 0 ? Math.min(100, Math.round((eleitores.length / minhaMeta) * 100)) : 0;
  const cidadesExpansao = Object.entries(
    eleitores.reduce<Record<string, number>>((acc, e) => { acc[e.cidade] = (acc[e.cidade] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxExpansao = cidadesExpansao[0]?.[1] || 1;

  const colabBriefing: string[] = (() => {
    if (!isColaborador(userData)) return [];
    const total = eleitores.length;
    const frases: string[] = [];
    const fortesCt = eleitores.filter((e) => e.grauApoio === "forte").length;
    const faltam = minhaMeta > 0 ? Math.max(0, minhaMeta - total) : 0;
    if (total > 0) {
      frases.push(`✅ Você realizou ${total} ${total === 1 ? "cadastro" : "cadastros"}.`);
    } else {
      frases.push("📋 Nenhum cadastro realizado ainda.");
    }
    if (minhaMeta > 0) {
      if (faltam === 0) frases.push("🎯 Meta atingida! Continue cadastrando para superar o objetivo.");
      else frases.push(`🎯 Faltam ${faltam} para atingir sua meta.`);
    }
    if (total > 0) {
      const pctForte = Math.round((fortesCt / total) * 100);
      frases.push(`💪 ${pctForte}% da sua base é forte.`);
      const bairrosUnicos = [...new Set(eleitores.map((e) => e.bairro).filter(Boolean))];
      const cidadesUnicas = [...new Set(eleitores.map((e) => e.cidade).filter(Boolean))];
      if (bairrosUnicos.length === 1 && cidadesUnicas.length === 1) {
        frases.push(`📍 Todos os seus cadastros estão em ${bairrosUnicos[0]} · ${cidadesUnicas[0]}.`);
      } else if (cidadesUnicas.length === 1) {
        frases.push(`📍 Todos os seus cadastros estão em ${cidadesUnicas[0]}.`);
      }
    }
    if (cadastrosHoje === 0) {
      if (total > 0) frases.push("⚠ Nenhum cadastro realizado hoje.");
    } else {
      frases.push(`✅ ${cadastrosHoje} ${cadastrosHoje === 1 ? "cadastro realizado" : "cadastros realizados"} hoje.`);
    }
    return frases;
  })();

  const colabStats: ColabStat[] = isCoordenador(userData)
    ? colaboradores.map((c): ColabStat => {
        const { valor: metaVal, tipo: metaTipo } = resolverMeta(c.uid);
        const meus = eleitores.filter((e) => e.colaboradorId === c.uid);
        const total = meus.length;
        const prog = metaVal > 0 ? Math.round((total / metaVal) * 100) : 0;
        const lastTs = meus.reduce((max, e) => Math.max(max, parseDate(e.criadoEm).getTime()), 0);
        const diasSemAtividade = lastTs > 0 ? Math.floor((Date.now() - lastTs) / 86400000) : 999;
        return { ...c, total, metaVal, metaTipo, prog, diasSemAtividade, status: getCoordStatus(prog, metaVal) };
      }).sort((a, b) => b.prog - a.prog)
    : [];

  const coordBriefing: string[] = (() => {
    if (!isCoordenador(userData) || colabStats.length === 0) return [];
    const frases: string[] = [];
    const lider = colabStats[0];
    if (lider.metaVal > 0) frases.push(`🥇 ${lider.nome.split(" ")[0]} lidera com ${lider.prog}% da meta.`);
    const abaixo50 = colabStats.filter((c) => c.metaVal > 0 && c.prog < 50);
    if (abaixo50.length === 1) frases.push(`⚠ ${abaixo50[0].nome.split(" ")[0]} está abaixo de 50%.`);
    else if (abaixo50.length > 1) frases.push(`⚠ ${abaixo50.length} colaboradores estão abaixo de 50%.`);
    const topTerr = userData.bairro && userData.cidade ? `${userData.bairro} · ${userData.cidade}` : userData.cidade || "";
    if (topTerr) frases.push(`📍 ${topTerr} acumula ${eleitores.length} cadastros.`);
    if (cadastrosHoje === 0) frases.push(`⚠ Nenhum cadastro realizado hoje.`);
    else frases.push(`✅ ${cadastrosHoje} ${cadastrosHoje === 1 ? "cadastro" : "cadastros"} realizado${cadastrosHoje === 1 ? "" : "s"} hoje.`);
    return frases;
  })();

  // Coordinator-level performance stats — computed in memory for assessor view
  const coordStats: {
    coordId: string; nome: string; total: number; metaTotal: number;
    prog: number; diasSemAtividade: number; numColabs: number; rank: number;
  }[] = !isAssessor(userData) ? [] : Object.entries(coordInfoMap)
    .map(([coordId, ci]) => {
      const colabs = colaboradores.filter((c) => c.coordenadorId === coordId);
      const total = eleitores.filter((e) => e.coordenadorId === coordId).length;
      const metaTotal = colabs.reduce((sum, c) => sum + resolverMeta(c.uid).valor, 0);
      const prog = metaTotal > 0 ? Math.round((total / metaTotal) * 100) : 0;
      const lastTs = eleitores
        .filter((e) => e.coordenadorId === coordId)
        .map((e) => parseDate(e.criadoEm).getTime())
        .reduce((max, t) => Math.max(max, t), 0);
      const diasSemAtividade = lastTs > 0
        ? Math.floor((Date.now() - lastTs) / (1000 * 60 * 60 * 24))
        : 999;
      return { coordId, nome: ci.nome, total, metaTotal, prog, diasSemAtividade, numColabs: colabs.length, rank: 0 };
    })
    .sort((a, b) => b.prog - a.prog)
    .map((c, idx) => ({ ...c, rank: idx + 1 }));

  const liderCoord = coordStats[0] ?? null;
  const abaixo50Count = coordStats.filter((c) => c.metaTotal > 0 && c.prog < 50).length;
  const inativosCount = coordStats.filter((c) => c.diasSemAtividade >= 15).length;
  const allNoMeta = coordStats.length > 0 && coordStats.every((c) => c.metaTotal === 0);
  const coordStatsFiltrados = perfPill === ""
    ? coordStats
    : coordStats.filter((c) => getCoordStatus(c.prog, c.metaTotal) === perfPill);

  const assessorRanking = isPolitico(userData) ? (() => {
    const stats = eleitores.reduce<Record<string, { nome: string; total: number; fortes: number; territorios: Record<string, number> }>>((acc, e) => {
      const aId = e.coordenadorId ? politicoCoordAssessorMap[e.coordenadorId] : undefined;
      if (!aId) return acc;
      if (!acc[aId]) acc[aId] = { nome: politicoAssessorNomes[aId] || "Assessor", total: 0, fortes: 0, territorios: {} };
      acc[aId].total++;
      if (e.grauApoio === "forte") acc[aId].fortes++;
      const key = e.bairro ? `${e.bairro} · ${e.cidade}` : e.cidade;
      acc[aId].territorios[key] = (acc[aId].territorios[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(stats)
      .map(([id, s]) => {
        const myCoordIds = Object.entries(politicoCoordAssessorMap)
          .filter(([, aId]) => aId === id)
          .map(([coordId]) => coordId);
        const myColabs = colaboradores.filter((c) => c.coordenadorId && myCoordIds.includes(c.coordenadorId));
        const metaTotal = myColabs.reduce((sum, c) => sum + (metas[c.uid] || 0), 0);
        const prog = metaTotal > 0 ? Math.round((s.total / metaTotal) * 100) : 0;
        return {
          id, nome: s.nome, total: s.total, fortes: s.fortes,
          pctForte: s.total > 0 ? Math.round((s.fortes / s.total) * 100) : 0,
          topTerr: Object.entries(s.territorios).sort((a, b) => b[1] - a[1])[0]?.[0] || "-",
          metaTotal, prog,
        };
      })
      .sort((a, b) => b.total - a.total);
  })() : [] as { id: string; nome: string; total: number; fortes: number; pctForte: number; topTerr: string; metaTotal: number; prog: number }[];

  const maxAssessorTotal = assessorRanking[0]?.total || 1;

  const politicoBriefing: string[] = isPolitico(userData) ? (() => {
    const frases: string[] = [];
    const lider = assessorRanking[0];
    if (lider) frases.push(`🥇 ${lider.nome.split(" ")[0]} lidera a operação com ${lider.total} ${lider.total === 1 ? "cadastro" : "cadastros"}.`);
    if (assessorRanking.length > 1) {
      const ultimo = assessorRanking[assessorRanking.length - 1];
      const diff = (lider?.total || 0) - ultimo.total;
      if (diff > 0) frases.push(`⚠ ${ultimo.nome.split(" ")[0]} está ${diff} ${diff === 1 ? "registro" : "registros"} atrás do líder.`);
    }
    if (cidadesExpansao[0] && eleitores.length > 0) {
      const pctCidade = Math.round((cidadesExpansao[0][1] / eleitores.length) * 100);
      frases.push(`📍 ${cidadesExpansao[0][0]} concentra ${pctCidade}% da base atual.`);
    }
    if (cidadesExpansao.length > 1) {
      frases.push(`🎯 ${cidadesExpansao[cidadesExpansao.length - 1][0]} apresenta a melhor oportunidade de expansão.`);
    }
    const comMeta = assessorRanking.filter((a) => a.metaTotal > 0);
    if (comMeta.length > 0) {
      const atingiram = comMeta.filter((a) => a.prog >= 100).length;
      if (atingiram > 0) frases.push(`🎯 ${atingiram} ${atingiram === 1 ? "assessoria já atingiu sua meta." : "assessorias já atingiram suas metas."}`);
      const abaixo50 = comMeta.filter((a) => a.prog < 50).length;
      if (abaixo50 > 0) frases.push(`⚠ ${abaixo50} ${abaixo50 === 1 ? "assessoria está abaixo de 50%." : "assessorias estão abaixo de 50%."}`);
    }
    return frases;
  })() : [];

  const numTerritorios = isPolitico(userData)
    ? new Set(eleitores.map((e) => (e.bairro ? `${e.bairro} · ${e.cidade}` : e.cidade))).size
    : 0;

  if (loading) return <div className="flex justify-center py-20"><svg className="animate-spin h-8 w-8" style={{ color: roleInfo.text.replace("text-", "") } as React.CSSProperties} viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleInfo.gradient} flex items-center justify-center text-lg`}>{roleInfo.icon}</div>
        <div>
          <h1 className="text-2xl font-bold text-white">{isPolitico(userData) ? "Metas de Expansão" : "Metas"}</h1>
          <p className={`text-sm ${roleInfo.text}`}>{isPolitico(userData) ? "Evolução territorial da base política" : "Acompanhe sua produtividade"}</p>
        </div>
      </div>

      {/* Metas por Gabinete (super/admin) */}
      {isSuperOrMaster(userData) && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4"><Flag size={18} className="text-amber-400" /><h3 className="text-white font-semibold">Metas por Estrutura</h3></div>
          <div className="space-y-2">
            {metasDocs.filter((m: any) => m.gabineteId).length > 0 ? metasDocs.filter((m: any) => m.gabineteId).map((m: any) => {
              const total = eleitores.filter((e) => e.campanhaId === m.gabineteId).length;
              const prog = Math.min(100, Math.round((total / m.meta) * 100));
              return (
                <div key={m.id} className="flex items-center gap-3 p-2 bg-white/[0.03] rounded-xl">
                  <span className="text-sm text-white/80 w-48 truncate">{m.colaboradorNome || "Gabinete"}</span>
                  <span className="text-xs text-white/50">{total}/{m.meta}</span>
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${prog >= 100 ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${prog}%` }} />
                  </div>
                  <span className={`text-xs font-bold ${prog >= 100 ? "text-emerald-400" : "text-amber-400"}`}>{prog}%</span>
                </div>
              );
            }) : <p className="text-sm text-white/30 italic">Nenhuma meta definida para os gabinetes</p>}
          </div>
        </GlassCard>
      )}

      {/* ═══ PERFIL POLÍTICO — CENTRAL DE GESTÃO ESTRATÉGICA ═══ */}
      {isPolitico(userData) && (
        <>
          {/* P1 — BRIEFING ESTRATÉGICO */}
          {politicoBriefing.length > 0 && (
            <GlassCard className="p-5 border-violet-500/10">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={16} className="text-violet-400" />
                <h3 className="text-white font-semibold">Briefing Estratégico</h3>
              </div>
              <div className="space-y-1.5">
                {politicoBriefing.map((frase, i) => (
                  <p key={i} className="text-sm text-white/70 leading-relaxed">{frase}</p>
                ))}
              </div>
            </GlassCard>
          )}

          {/* P5 — KPIs GERENCIAIS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <GlassCard className="p-5 text-center">
              <Users size={24} className="mx-auto mb-2 text-violet-400" />
              <p className="text-3xl font-bold text-white">{Object.keys(politicoAssessorNomes).length || assessorRanking.length}</p>
              <p className="text-xs text-white/40">Assessorias</p>
            </GlassCard>
            <GlassCard className="p-5 text-center">
              <Target size={24} className="mx-auto mb-2 text-blue-400" />
              <p className="text-3xl font-bold text-white">{numTerritorios}</p>
              <p className="text-xs text-white/40">Territórios</p>
            </GlassCard>
            <GlassCard className="p-5 text-center">
              <MapPin size={24} className="mx-auto mb-2 text-emerald-400" />
              <p className="text-3xl font-bold text-white">{cidadesExpansao.length}</p>
              <p className="text-xs text-white/40">Cidades</p>
            </GlassCard>
            <GlassCard className="p-5 text-center">
              <TrendingUp size={24} className="mx-auto mb-2 text-emerald-400" />
              <p className="text-3xl font-bold text-white">{eleitores.length}</p>
              <p className="text-xs text-white/40">Eleitores</p>
            </GlassCard>
          </div>

          {/* P2 + P3 + P4 — RANKING DAS ASSESSORIAS */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-5">
              <Crown size={16} className="text-violet-400" />
              <h3 className="text-white font-semibold">Ranking das Assessorias</h3>
              {assessorRanking.length > 0 && (
                <span className="text-xs text-white/30 ml-1">{assessorRanking.length} assessorias</span>
              )}
            </div>

            {assessorRanking.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-white/30 italic">Nenhuma assessoria com cadastros registrados ainda.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {assessorRanking.map((a, idx) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  const rank = idx < 3 ? medals[idx] : `${idx + 1}º`;
                  const pct = Math.round((a.total / maxAssessorTotal) * 100);
                  const corForte = a.pctForte >= 50 ? "text-emerald-400" : a.pctForte >= 30 ? "text-amber-400" : "text-red-400";
                  const statusKey = a.metaTotal > 0 ? getCoordStatus(a.prog, a.metaTotal) : "sem_meta";
                  const sc = STATUS_CONFIG[statusKey];
                  return (
                    <div key={a.id} className="flex items-start gap-3">
                      <span className="text-lg w-8 shrink-0 text-center mt-0.5">{rank}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-white">{a.nome}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${sc.bg} ${sc.color} ${sc.border}`}>
                                {sc.label}
                              </span>
                            </div>
                            <p className="text-xs text-white/40 mt-0.5 truncate">{a.topTerr}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-white">{a.total}</p>
                            <p className={`text-xs ${corForte}`}>{a.pctForte}% fortes</p>
                          </div>
                        </div>
                        {a.metaTotal > 0 ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-white/30">{a.total}/{a.metaTotal}</span>
                              <span className={`font-bold ${sc.color}`}>{Math.min(a.prog, 100)}%</span>
                            </div>
                            <div className="w-full bg-white/[0.04] rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${sc.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </div>
                        ) : (
                          <div className="w-full bg-white/[0.04] rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {assessorRanking.every((a) => a.metaTotal === 0) && (
              <p className="text-xs text-white/20 mt-5 pt-4 border-t border-white/[0.05] italic">
                Defina metas para acompanhar a evolução da estrutura.
              </p>
            )}
          </GlassCard>
        </>
      )}

      {/* CARD PRINCIPAL DE META — colaborador */}
      {isColaborador(userData) && (() => {
        const status = getCoordStatus(progressoMeta, minhaMeta);
        const sc = STATUS_CONFIG[status];
        const faltam = minhaMeta > 0 ? Math.max(0, minhaMeta - eleitores.length) : 0;
        return (
          <GlassCard className={`p-6 border ${sc.border}`}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${sc.bg}`}>
                  <Target size={20} className={sc.color} />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Minha Meta</h3>
                  {minhaMeta > 0 && tipoMinhaMeta === "padrao" && (
                    <span className="text-[10px] text-white/30">Padrão da equipe</span>
                  )}
                </div>
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
                  <span className={`text-5xl font-bold ${sc.color}`}>{eleitores.length}</span>
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

      {/* BRIEFING DA PRODUÇÃO — colaborador */}
      {isColaborador(userData) && colabBriefing.length > 0 && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-emerald-400" />
            <h3 className="text-white font-semibold">Resumo da Produção</h3>
          </div>
          <div className="space-y-1.5">
            {colabBriefing.map((frase, i) => (
              <p key={i} className="text-sm text-white/70 leading-relaxed">{frase}</p>
            ))}
          </div>
        </GlassCard>
      )}

      {/* RESUMO DA EQUIPE — coordenador */}
      {isCoordenador(userData) && coordBriefing.length > 0 && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-blue-400" />
            <h3 className="text-white font-semibold">Resumo da Equipe</h3>
          </div>
          <div className="space-y-1.5">
            {coordBriefing.map((frase, i) => (
              <p key={i} className="text-sm text-white/70 leading-relaxed">{frase}</p>
            ))}
          </div>
        </GlassCard>
      )}

      {/* BULK PANEL — somente coordenador */}
      {isCoordenador(userData) && colaboradores.length > 0 && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-blue-400" />
            <h3 className="text-white font-semibold">Meta padrão da equipe</h3>
          </div>

          {/* Input + botão aplicar */}
          <div className="flex items-end gap-3 mb-4 flex-wrap">
            <div className="w-36">
              <Input
                label="Cadastros / meta"
                type="number"
                value={valorPadrao}
                onChange={(e) => setValorPadrao(e.target.value)}
                placeholder="Ex: 30"
                min={1}
              />
            </div>
            <Button onClick={salvarMetaPadrao} loading={salvandoPadrao}>
              <Users size={14} />
              {salvandoPadrao ? "Aplicando..." : "Aplicar a todos"}
            </Button>
            {metaPadraoEquipe > 0 && (
              <button
                onClick={limparMetaPadrao}
                className="text-xs text-white/30 hover:text-white/60 transition-colors pb-2"
              >
                Limpar padrão
              </button>
            )}
          </div>

          {/* Resumo ativo */}
          {metaPadraoEquipe > 0 && (
            <p className="text-xs text-white/40 mb-4">
              Meta padrão ativa: <span className="text-blue-400 font-medium">{metaPadraoEquipe} cadastros</span>
              {" · "}
              {colaboradores.filter((c) => metas[c.uid] > 0).length > 0
                ? `${colaboradores.filter((c) => metas[c.uid] > 0).length} com override individual`
                : "todos herdando o padrão"}
            </p>
          )}

          {/* Lista de colaboradores com meta resolvida */}
          <div className="space-y-2">
            {colaboradores.map((c) => {
              const { valor, tipo } = resolverMeta(c.uid);
              const stat = colabStats.find((s) => s.uid === c.uid);
              const total = stat?.total ?? eleitores.filter((e) => e.colaboradorId === c.uid).length;
              const prog = valor > 0 ? Math.round((total / valor) * 100) : 0;
              const dias = stat?.diasSemAtividade ?? 999;
              const ativCor = dias <= 5 ? "text-emerald-400" : dias <= 10 ? "text-amber-400" : dias <= 20 ? "text-orange-400" : "text-red-400";
              return (
                <div key={c.uid} className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                  <div className="flex items-start gap-2 justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium text-white/90 truncate">{c.nome}</span>
                        {tipo === "padrao" && (
                          <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full border border-white/10">Padrão</span>
                        )}
                        {tipo === "individual" && (
                          <span className="text-[10px] text-blue-400/80 bg-blue-500/10 px-1.5 py-0.5 rounded-full">Override</span>
                        )}
                        {tipo === "individual" && (
                          <button
                            onClick={async () => {
                              const gabIdReset = userData?.gabineteId || userData?.campanhaId;
                              const resetQuery = gabIdReset
                                ? query(collection(db, "metas"), where("colaboradorId", "==", c.uid), where("gabineteId", "==", gabIdReset))
                                : query(collection(db, "metas"), where("colaboradorId", "==", c.uid));
                              const snap = await getDocs2(resetQuery);
                              if (!snap.empty) {
                                const { deleteDoc, doc: fsDoc } = await import("firebase/firestore");
                                await deleteDoc(fsDoc(db, "metas", snap.docs[0].id));
                                setMetas((prev) => { const n = { ...prev }; delete n[c.uid]; return n; });
                                toast.success(`Override de ${c.nome.split(" ")[0]} removido → voltou ao padrão`);
                              }
                            }}
                            className="text-[10px] text-white/20 hover:text-red-400 transition-colors ml-1"
                            title="Remover override e voltar ao padrão"
                          >
                            ↩ resetar
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-white/50">
                          {total} cadastros{valor > 0 ? ` · Meta: ${valor}` : ""}
                        </span>
                        <span className={`text-xs ${ativCor}`}>{fmtAtividade(dias)}</span>
                      </div>
                      {valor > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${prog >= 100 ? "bg-emerald-500" : prog >= 80 ? "bg-blue-500" : prog >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${Math.min(100, prog)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold w-10 text-right shrink-0 ${prog >= 100 ? "text-emerald-400" : prog >= 80 ? "text-blue-400" : prog >= 50 ? "text-amber-400" : "text-red-400"}`}>
                            {prog}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* RANKING DE PERFORMANCE — coordenador */}
      {isCoordenador(userData) && colabStats.length > 0 && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} className="text-blue-400" />
            <h3 className="text-white font-semibold">Ranking de Performance</h3>
            <span className="text-xs text-white/30 ml-1">{colabStats.length} colaboradores</span>
          </div>
          <div className="space-y-2">
            {colabStats.map((c, idx) => {
              const medals = ["🥇", "🥈", "🥉"];
              const medal = idx < 3 ? medals[idx] : `#${idx + 1}`;
              const sc = STATUS_CONFIG[c.status];
              return (
                <div key={c.uid} className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                  <div className="w-8 text-base text-center shrink-0">{medal}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-white/90 truncate">{c.nome}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${sc.bg} ${sc.color} ${sc.border}`}>
                        {sc.label}
                      </span>
                    </div>
                    {c.metaVal > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${sc.bar}`} style={{ width: `${Math.min(100, c.prog)}%` }} />
                        </div>
                        <span className="text-xs text-white/30 shrink-0">{c.total}/{c.metaVal}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-white/20">{c.total} cadastros · sem meta</span>
                    )}
                  </div>
                  <div className="shrink-0 text-right min-w-[3rem]">
                    <div className={`text-lg font-bold leading-tight ${c.metaVal > 0 ? sc.color : "text-white/20"}`}>
                      {c.metaVal > 0 ? `${c.prog}%` : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* BRIEFING DE PERFORMANCE — assessor */}
      {isAssessor(userData) && coordStats.length > 0 && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-purple-400" />
            <h3 className="text-white font-semibold">Resumo da Operação</h3>
          </div>

          {allNoMeta ? (
            <p className="text-sm text-white/40 italic">
              Defina a meta padrão abaixo para ativar o ranking de performance da equipe.
            </p>
          ) : (
            <div className="space-y-1.5 mb-4">
              {liderCoord && liderCoord.metaTotal > 0 && (
                <p className="text-sm text-white/70">
                  <span className="text-white font-medium">{liderCoord.nome.split(" ")[0]}</span>{" "}
                  lidera a equipe com{" "}
                  <span className={`font-semibold ${STATUS_CONFIG[getCoordStatus(liderCoord.prog, liderCoord.metaTotal)].color}`}>
                    {liderCoord.prog}%
                  </span>{" "}
                  da meta atingida.
                </p>
              )}
              {abaixo50Count > 0 && (
                <p className="text-sm text-white/70">
                  <span className="text-amber-400 font-medium">
                    {abaixo50Count} {abaixo50Count === 1 ? "coordenador está" : "coordenadores estão"}
                  </span>{" "}
                  abaixo de 50% da meta.
                </p>
              )}
              {inativosCount > 0 && (
                <p className="text-sm text-white/70">
                  <span className="text-red-400 font-medium">
                    {inativosCount} {inativosCount === 1 ? "coordenador está" : "coordenadores estão"}
                  </span>{" "}
                  sem atividade nos últimos 15 dias.
                </p>
              )}
            </div>
          )}

          {/* Alertas compactos */}
          {!allNoMeta && (abaixo50Count > 0 || inativosCount > 0 || (liderCoord && liderCoord.metaTotal > 0)) && (
            <div className="space-y-1.5 border-t border-white/[0.05] pt-3">
              {abaixo50Count > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-xs text-white/45">
                    {abaixo50Count} {abaixo50Count === 1 ? "coordenador abaixo" : "coordenadores abaixo"} de 50% da meta
                  </span>
                </div>
              )}
              {inativosCount > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <span className="text-xs text-white/45">
                    {inativosCount} {inativosCount === 1 ? "coordenador" : "coordenadores"} sem atividade nos últimos 15 dias
                  </span>
                </div>
              )}
              {liderCoord && liderCoord.metaTotal > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-xs text-white/45">
                    {liderCoord.nome.split(" ")[0]} lidera a operação com {liderCoord.prog}% da meta
                  </span>
                </div>
              )}
            </div>
          )}
        </GlassCard>
      )}

      {/* META PADRÃO DA ASSESSORIA — mantida intacta */}
      {isAssessor(userData) && colaboradores.length > 0 && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users size={18} className="text-purple-400" />
            <h3 className="text-white font-semibold">Meta padrão da assessoria</h3>
          </div>
          <p className="text-xs text-white/30 mb-4">
            Define o valor base para toda a equipe. Coordenadores podem sobrescrever para suas equipes e colaboradores têm override individual.
          </p>

          <div className="flex items-end gap-3 mb-4 flex-wrap">
            <div className="w-36">
              <Input
                label="Cadastros / meta"
                type="number"
                value={valorPadrao}
                onChange={(e) => setValorPadrao(e.target.value)}
                placeholder="Ex: 40"
                min={1}
              />
            </div>
            <Button onClick={salvarMetaPadrao} loading={salvandoPadrao}>
              <Users size={14} />
              {salvandoPadrao ? "Aplicando..." : "Aplicar a toda equipe"}
            </Button>
            {metaPadraoEquipe > 0 && (
              <button onClick={limparMetaPadrao} className="text-xs text-white/30 hover:text-white/60 transition-colors pb-2">
                Limpar padrão
              </button>
            )}
          </div>

          {metaPadraoEquipe > 0 && (
            <p className="text-xs text-white/40">
              Meta padrão ativa: <span className="text-purple-400 font-medium">{metaPadraoEquipe} cadastros</span>
              {" · "}
              {colaboradores.filter((c) => metas[c.uid] > 0).length > 0
                ? `${colaboradores.filter((c) => metas[c.uid] > 0).length} com override individual`
                : "todos herdando o padrão"}
              {Object.values(coordInfoMap).filter((ci) => ci.metaPadrao > 0).length > 0 && (
                <> · <span className="text-purple-300/60">{Object.values(coordInfoMap).filter((ci) => ci.metaPadrao > 0).length} coord. com padrão próprio</span></>
              )}
            </p>
          )}
        </GlassCard>
      )}

      {/* RANKING DE COORDENADORES — assessor */}
      {isAssessor(userData) && coordStats.length > 0 && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} className="text-purple-400" />
            <h3 className="text-white font-semibold">Ranking de Entrega</h3>
            <span className="text-xs text-white/30 ml-1">{coordStats.length} coordenadores</span>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            {([
              { key: ""           as const, label: "Todos",      count: coordStats.length },
              { key: "excelente"  as const, label: "Excelentes", count: coordStats.filter((c) => getCoordStatus(c.prog, c.metaTotal) === "excelente").length },
              { key: "no_ritmo"   as const, label: "No Ritmo",   count: coordStats.filter((c) => getCoordStatus(c.prog, c.metaTotal) === "no_ritmo").length },
              { key: "atencao"    as const, label: "Atenção",    count: coordStats.filter((c) => getCoordStatus(c.prog, c.metaTotal) === "atencao").length },
              { key: "critico"    as const, label: "Críticos",   count: coordStats.filter((c) => getCoordStatus(c.prog, c.metaTotal) === "critico").length },
            ] as const).map(({ key, label, count }) =>
              (key === "" || count > 0) ? (
                <button
                  key={key}
                  onClick={() => setPerfPill(perfPill === key ? "" : key)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all border ${
                    perfPill === key
                      ? key === ""         ? "bg-white/10 text-white border-white/20"
                      : key === "excelente" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : key === "no_ritmo"  ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                      : key === "atencao"   ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : "bg-red-500/15 text-red-400 border-red-500/30"
                      : "text-white/30 border-white/[0.07] hover:text-white/55 hover:border-white/20"
                  }`}
                >
                  {label} <span className="opacity-60">·{count}</span>
                </button>
              ) : null
            )}
          </div>

          {/* Coordinator ranking cards */}
          <div className="space-y-2">
            {coordStatsFiltrados.length === 0 && (
              <p className="text-sm text-white/30 italic text-center py-4">Nenhum coordenador neste filtro</p>
            )}
            {coordStatsFiltrados.map((coord) => {
              const status = getCoordStatus(coord.prog, coord.metaTotal);
              const sc = STATUS_CONFIG[status];
              return (
                <div key={coord.coordId} className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                  {/* Rank badge */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    coord.rank <= 3 ? "bg-purple-500/20 text-purple-300" : "bg-white/5 text-white/35"
                  }`}>
                    #{coord.rank}
                  </div>

                  {/* Center: name + status badge + bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-white/90 truncate">{coord.nome}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${sc.bg} ${sc.color} ${sc.border}`}>
                        {sc.label}
                      </span>
                      {coord.diasSemAtividade >= 15 && coord.diasSemAtividade < 999 && (
                        <span className="text-[10px] text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                          {coord.diasSemAtividade}d sem atividade
                        </span>
                      )}
                      {coord.diasSemAtividade === 999 && coord.total === 0 && (
                        <span className="text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded-full border border-white/10">
                          sem atividade
                        </span>
                      )}
                    </div>
                    {coord.metaTotal > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${sc.bar}`} style={{ width: `${Math.min(100, coord.prog)}%` }} />
                        </div>
                        <span className="text-xs text-white/30 shrink-0">{coord.total}/{coord.metaTotal}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-white/20">{coord.total} cadastros · sem meta definida</span>
                    )}
                  </div>

                  {/* Right: % + colabs count */}
                  <div className="shrink-0 text-right min-w-[3.5rem]">
                    <div className={`text-lg font-bold leading-tight ${coord.metaTotal > 0 ? sc.color : "text-white/20"}`}>
                      {coord.metaTotal > 0 ? `${coord.prog}%` : "—"}
                    </div>
                    <div className="text-[10px] text-white/25">{coord.numColabs} colab.</div>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* OVERRIDE INDIVIDUAL — assessor, super admin e coordenador (secundário) */}
      {podeGerenciarMetas && colaboradores.length > 0 && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} className="text-emerald-400" />
            <h3 className="text-white font-semibold">{isCoordenador(userData) ? "Override individual" : "Definir Metas"}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <Select
              label="Colaborador"
              value={formMeta.colaboradorId}
              onChange={(e) => setFormMeta({ ...formMeta, colaboradorId: e.target.value })}
              options={colaboradores.map((c) => ({ value: c.uid, label: c.nome }))}
            />
            <Input label="Meta (cadastros)" type="number" value={formMeta.valor} onChange={(e) => setFormMeta({ ...formMeta, valor: e.target.value })} placeholder="Ex: 100" min={1} />
            <Button onClick={definirMeta} loading={savingMeta}><Save size={16} /> {savingMeta ? "Salvando..." : "Definir Meta"}</Button>
          </div>
          {colaboradores.filter((c) => metas[c.uid]).length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-white/50 font-medium">Metas definidas:</p>
              {colaboradores.filter((c) => metas[c.uid]).map((c) => {
                const total = eleitores.filter((e) => e.colaboradorId === c.uid).length;
                const progresso = Math.min(100, Math.round((total / metas[c.uid]) * 100));
                return (
                  <div key={c.uid} className="flex items-center gap-3 p-2 bg-white/[0.03] rounded-xl">
                    <span className="text-sm text-white/80 w-40 truncate">{c.nome}</span>
                    <span className="text-xs text-white/50">{total}/{metas[c.uid]}</span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${progresso >= 100 ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${progresso}%` }} />
                    </div>
                    <span className={`text-xs font-bold ${progresso >= 100 ? "text-emerald-400" : "text-amber-400"}`}>{progresso}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      )}

      {isCoordenador(userData) ? (() => {
        const colabsComMeta = colabStats.filter((c) => c.metaVal > 0);
        const metaMedia = colabsComMeta.length > 0
          ? Math.round(colabsComMeta.reduce((sum, c) => sum + c.prog, 0) / colabsComMeta.length)
          : 0;
        const acimaDaMeta = colabsComMeta.filter((c) => c.prog >= 100).length;
        const criticosCount = colabStats.filter((c) => c.status === "critico").length;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <GlassCard className="p-5 text-center">
              <Users size={24} className="mx-auto mb-2 text-blue-400" />
              <p className="text-3xl font-bold text-white">{colabStats.length}</p>
              <p className="text-xs text-white/40">Colaboradores</p>
            </GlassCard>
            <GlassCard className="p-5 text-center">
              <Target size={24} className="mx-auto mb-2 text-emerald-400" />
              <p className={`text-3xl font-bold ${colabsComMeta.length === 0 ? "text-white/30" : metaMedia >= 80 ? "text-emerald-400" : metaMedia >= 50 ? "text-amber-400" : "text-red-400"}`}>
                {colabsComMeta.length === 0 ? "—" : `${metaMedia}%`}
              </p>
              <p className="text-xs text-white/40">Meta Média</p>
            </GlassCard>
            <GlassCard className="p-5 text-center">
              <TrendingUp size={24} className="mx-auto mb-2 text-emerald-400" />
              <p className={`text-3xl font-bold ${acimaDaMeta > 0 ? "text-emerald-400" : "text-white/30"}`}>{acimaDaMeta}</p>
              <p className="text-xs text-white/40">Acima da Meta</p>
            </GlassCard>
            <GlassCard className="p-5 text-center">
              <Zap size={24} className="mx-auto mb-2 text-red-400" />
              <p className={`text-3xl font-bold ${criticosCount > 0 ? "text-red-400" : "text-white/30"}`}>{criticosCount}</p>
              <p className="text-xs text-white/40">Críticos</p>
            </GlassCard>
          </div>
        );
      })() : isColaborador(userData) ? (() => {
        const fortesKpi = eleitores.filter((e) => e.grauApoio === "forte").length;
        const fracosKpi = eleitores.filter((e) => e.grauApoio === "fraco").length;
        const faltamKpi = minhaMeta > 0 ? Math.max(0, minhaMeta - eleitores.length) : 0;
        const scKpi = STATUS_CONFIG[getCoordStatus(progressoMeta, minhaMeta)];
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <GlassCard className="p-5 text-center">
              <Target size={24} className={`mx-auto mb-2 ${minhaMeta > 0 ? scKpi.color : "text-white/30"}`} />
              <p className={`text-3xl font-bold ${minhaMeta > 0 ? scKpi.color : "text-white/30"}`}>
                {minhaMeta > 0 ? `${progressoMeta}%` : "—"}
              </p>
              <p className="text-xs text-white/40">Meta</p>
            </GlassCard>
            <GlassCard className="p-5 text-center">
              <Flag size={24} className={`mx-auto mb-2 ${minhaMeta > 0 ? (faltamKpi > 0 ? "text-amber-400" : "text-emerald-400") : "text-white/30"}`} />
              <p className={`text-3xl font-bold ${minhaMeta > 0 ? (faltamKpi > 0 ? "text-amber-400" : "text-emerald-400") : "text-white/30"}`}>
                {minhaMeta > 0 ? faltamKpi : "—"}
              </p>
              <p className="text-xs text-white/40">Faltam</p>
            </GlassCard>
            <GlassCard className="p-5 text-center">
              <TrendingUp size={24} className={`mx-auto mb-2 ${fortesKpi > 0 ? "text-emerald-400" : "text-white/30"}`} />
              <p className={`text-3xl font-bold ${fortesKpi > 0 ? "text-emerald-400" : "text-white/30"}`}>{fortesKpi}</p>
              <p className="text-xs text-white/40">Fortes</p>
            </GlassCard>
            <GlassCard className="p-5 text-center">
              <Zap size={24} className={`mx-auto mb-2 ${fracosKpi > 0 ? "text-red-400" : "text-white/30"}`} />
              <p className={`text-3xl font-bold ${fracosKpi > 0 ? "text-red-400" : "text-white/30"}`}>{fracosKpi}</p>
              <p className="text-xs text-white/40">Fracos</p>
            </GlassCard>
          </div>
        );
      })() : isPolitico(userData) ? null : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GlassCard className="p-5 text-center">
            <Target size={24} className={`mx-auto mb-2 ${roleInfo.text}`} />
            <p className="text-3xl font-bold text-white">{eleitores.length}</p>
            <p className="text-xs text-white/40">Total de Cadastros</p>
          </GlassCard>
          <GlassCard className="p-5 text-center">
            <Zap size={24} className={`mx-auto mb-2 ${roleInfo.text}`} />
            <p className="text-3xl font-bold text-white">{cadastrosHoje}</p>
            <p className="text-xs text-white/40">Cadastros Hoje</p>
          </GlassCard>
          <GlassCard className="p-5 text-center">
            <TrendingUp size={24} className={`mx-auto mb-2 ${roleInfo.text}`} />
            <p className="text-3xl font-bold text-white">{mediaDia}</p>
            <p className="text-xs text-white/40">Média por Dia</p>
          </GlassCard>
        </div>
      )}

      {crescimentoData.length > 0 && (
        <GlassCard className="p-5">
          <h3 className="text-white font-semibold mb-4">Evolução Diária</h3>
          <div className="h-64 min-w-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={crescimentoData}>
                <defs>
                  <linearGradient id="metaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="dia" stroke="rgba(255,255,255,0.1)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} />
                <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, color: "#fff" }} />
                <Area type="monotone" dataKey="total" stroke="#10b981" fillOpacity={1} fill="url(#metaGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      {isPolitico(userData) ? (
        cidadesExpansao.length > 0 && (
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-5">
              <MapPin size={16} className="text-emerald-400" />
              <h3 className="text-white font-semibold">Expansão Territorial</h3>
            </div>
            <div className="space-y-3">
              {cidadesExpansao.map(([cidade, total]) => {
                const pct = eleitores.length > 0 ? Math.round((total / eleitores.length) * 100) : 0;
                return (
                  <div key={cidade}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white/80 truncate">{cidade}</span>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-sm text-white/50">{total}</span>
                        <span className="text-xs text-white/30 w-9 text-right">{pct}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-white/[0.04] rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.round((total / maxExpansao) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        )
      ) : (
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-white font-semibold">
              {isColaborador(userData) ? "Meus Cadastros" : "Cadastros"}
            </h3>
            {eleitores.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {([
                  { key: "",         label: "Todos",     count: eleitores.length },
                  { key: "forte",    label: "Fortes",    count: eleitores.filter((e) => e.grauApoio === "forte").length },
                  { key: "medio",    label: "Médios",    count: eleitores.filter((e) => e.grauApoio === "medio").length },
                  { key: "indeciso", label: "Indecisos", count: eleitores.filter((e) => e.grauApoio === "indeciso").length },
                  { key: "fraco",    label: "Fracos",    count: eleitores.filter((e) => e.grauApoio === "fraco").length },
                ] as const).map(({ key, label, count }) => {
                  const ativoClass =
                    key === "" ? "bg-white/10 text-white border-white/20" :
                    key === "forte" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                    key === "medio" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                    key === "indeciso" ? "bg-blue-500/15 text-blue-400 border-blue-500/30" :
                    "bg-red-500/15 text-red-400 border-red-500/30";
                  return (
                    <button
                      key={key}
                      onClick={() => setGrauPill(grauPill === key ? "" : key)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all border ${
                        grauPill === key ? ativoClass : "text-white/30 border-white/[0.07] hover:text-white/55 hover:border-white/20"
                      }`}
                    >
                      {label} <span className="opacity-60">·{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 border-b border-white/[0.06]">
                  <th className="text-left py-2 px-2 font-medium">Nome</th>
                  <th className="text-left py-2 px-2 font-medium">Localidade</th>
                  <th className="text-left py-2 px-2 font-medium">Grau</th>
                  <th className="text-left py-2 px-2 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {(grauPill ? eleitores.filter((e) => e.grauApoio === grauPill) : eleitores).map((e) => (
                  <tr key={e.id} className="border-b border-white/[0.03]">
                    <td className="py-2 px-2 text-white/70">{e.nomeCompleto}</td>
                    <td className="py-2 px-2 text-white/50">{e.bairro ? `${e.bairro} · ${e.cidade}` : e.cidade}</td>
                    <td className="py-2 px-2">
                      <Badge variant={e.grauApoio === "forte" ? "success" : e.grauApoio === "medio" ? "warning" : e.grauApoio === "fraco" ? "danger" : "info"}>{e.grauApoio}</Badge>
                    </td>
                    <td className="py-2 px-2 text-white/40 text-xs">{formatDate(e.criadoEm)}</td>
                  </tr>
                ))}
                {eleitores.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-white/30">Nenhum cadastro ainda</td></tr>}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

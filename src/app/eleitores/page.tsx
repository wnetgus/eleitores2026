"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cadastrarEleitor, buscarEleitores, verificarDocumentoDuplicado, registrarAtividade, excluirEleitor, buscarCandidatos } from "@/lib/firestore";
import { estados, getCidades, getBairros } from "@/lib/estados-cidades";
import { Eleitor, Candidato, AppUser } from "@/types";
import { formatDate, parseDate, mascaraCPF, mascaraTelefone, mascaraCEP, mascaraDocumento } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { BuscaGlobal } from "@/components/ui/BuscaGlobal";
import { BuscaOperacional, FiltrosOperacionais } from "@/components/ui/BuscaOperacional";
import { UserPlus, Trash2, Loader2, Pencil } from "lucide-react";
import { EditarEleitorModal } from "@/components/forms/EditarEleitorModal";
import { EmptyState } from "@/components/ui/EmptyState";

import toast from "react-hot-toast";
import { isSuperOrMaster, isAssessor, isCoordenador, isColaborador, isPolitico } from "@/lib/permissions";

const grauOptions = [
  { value: "forte", label: "Forte" },
  { value: "medio", label: "Médio" },
  { value: "fraco", label: "Fraco" },
  { value: "indeciso", label: "Indeciso" },
];

const tipoDocOptions = [
  { value: "titulo", label: "Título de Eleitor" },
  { value: "cpf", label: "CPF" },
  { value: "rg", label: "RG" },
];

const MOTIVOS_PRINCIPAIS = [
  { value: "", label: "Selecione (opcional)..." },
  { value: "nao_conhece", label: "Não conhece o candidato" },
  { value: "apoia_outro", label: "Já apoia outro candidato" },
  { value: "nao_gosta", label: "Não gosta do político" },
  { value: "partido", label: "Insatisfação com o partido" },
  { value: "reeleicao", label: "Não vota em reeleição" },
  { value: "presenca", label: "Falta presença no bairro" },
  { value: "promessa", label: "Promessa não cumprida" },
  { value: "sem_interesse", label: "Sem interesse político" },
  { value: "outro", label: "Outro" },
];

const formInitial = {
  nomeCompleto: "", tipoDocumento: "titulo" as const, documento: "",
  telefone: "", cep: "", logradouro: "", numero: "", complemento: "",
  estado: "", cidade: "", bairro: "", grauApoio: "", voto: "", candidatoId: "",
  motivoPrincipal: "", observacoes: "",
};

function salvarRascunho(dados: typeof formInitial) {
  try { localStorage.setItem("rascunho_eleitor", JSON.stringify(dados)); } catch {}
}

function carregarRascunho(): typeof formInitial | null {
  try {
    const raw = localStorage.getItem("rascunho_eleitor");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function limparRascunho() {
  try { localStorage.removeItem("rascunho_eleitor"); } catch {}
}

const opcoesVoto = [
  { value: "sim", label: "Votará no candidato" },
  { value: "branco", label: "Branco" },
  { value: "nulo", label: "Nulo" },
  { value: "indeciso", label: "Indeciso" },
  { value: "nao_informou", label: "Não informou" },
];

export default function EleitoresPage() {
  const { userData } = useAuth();
  const [form, setForm] = useState(() => carregarRascunho() || formInitial);
  const [cidadesDisponiveis, setCidadesDisponiveis] = useState<string[]>([]);
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [editingEleitor, setEditingEleitor] = useState<Eleitor | null>(null);
  const [filtros, setFiltros] = useState<FiltrosOperacionais>({ texto: "" });
  const [todosAssessores, setTodosAssessores] = useState<AppUser[]>([]);
  const [todosCoordenadores, setTodosCoordenadores] = useState<AppUser[]>([]);
  const [todosColaboradores, setTodosColaboradores] = useState<AppUser[]>([]);

  useEffect(() => { loadEleitores(); loadUsuarios(); }, [userData]);

  async function loadUsuarios() {
    if (!userData) return;
    try {
      if (isSuperOrMaster(userData)) {
        const [aSnap, cSnap, colSnap] = await Promise.all([
          getDocs(query(collection(db, "usuarios"), where("role", "==", "assessor"))),
          getDocs(query(collection(db, "usuarios"), where("role", "==", "coordenador"))),
          getDocs(query(collection(db, "usuarios"), where("role", "==", "colaborador"))),
        ]);
        setTodosAssessores(aSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
        setTodosCoordenadores(cSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
        setTodosColaboradores(colSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
      } else if (isCoordenador(userData)) {
        const colSnap = await getDocs(query(collection(db, "usuarios"), where("coordenadorId", "==", userData.uid)));
        setTodosColaboradores(colSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
      } else if (!isColaborador(userData)) {
        const gabId = userData?.gabineteId || userData?.campanhaId;
        if (!gabId) return;
        const [aSnap, cSnap, colSnap] = await Promise.all([
          getDocs(query(collection(db, "usuarios"), where("role", "==", "assessor"), where("campanhaId", "==", gabId))),
          getDocs(query(collection(db, "usuarios"), where("role", "==", "coordenador"), where("campanhaId", "==", gabId))),
          getDocs(query(collection(db, "usuarios"), where("role", "==", "colaborador"), where("campanhaId", "==", gabId))),
        ]);
        setTodosAssessores(aSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
        setTodosCoordenadores(cSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
        setTodosColaboradores(colSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
      }
    } catch (e) { console.error(e); }
  }

  useEffect(() => {
    const id = userData?.gabineteId || userData?.campanhaId;
    if (id) {
      buscarCandidatos(id).then(setCandidatos).catch(() => {});
    }
  }, [userData]);

  useEffect(() => { salvarRascunho(form); }, [form]);

  async function loadEleitores() {
    setLoading(true);
    try {
      const campanhaId = isSuperOrMaster(userData) ? undefined : userData?.campanhaId;
      const colaboradorId = isColaborador(userData) ? userData?.uid : undefined;
      const data = await buscarEleitores(campanhaId, colaboradorId);
      setEleitores(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  const isOperacional = !!(userData && (isColaborador(userData) || isCoordenador(userData) || isAssessor(userData) || isSuperOrMaster(userData)));

  function handleEstadoChange(sigla: string) {
    setForm((f) => ({ ...f, estado: sigla, cidade: "", bairro: "" }));
    setCidadesDisponiveis(getCidades(sigla));
  }

  async function buscarCep(cep: string) {
    const cepLimpo = cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        const siglaEstado = data.uf || "";
        setForm((f) => ({
          ...f, cep: cepLimpo,
          logradouro: data.logradouro || f.logradouro,
          bairro: data.bairro || (siglaEstado && siglaEstado !== f.estado ? "" : f.bairro),
          cidade: data.localidade || f.cidade,
          estado: siglaEstado || f.estado,
        }));
        if (siglaEstado) setCidadesDisponiveis(getCidades(siglaEstado));
      }
    } catch {} finally { setBuscandoCep(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userData) return;
    if (!form.nomeCompleto || !form.grauApoio) {
      toast.error("Preencha o nome e o grau de apoio");
      return;
    }
    setSaving(true);
    try {
      if (form.documento) {
        const duplicado = await verificarDocumentoDuplicado(form.documento, userData?.gabineteId || userData?.campanhaId);
        if (duplicado) { toast.error("Documento já cadastrado!"); setSaving(false); return; }
      }
      const eleitorData: Record<string, any> = {
        campanhaId: userData?.gabineteId || userData?.campanhaId || "",
        nomeCompleto: form.nomeCompleto,
        tipoDocumento: form.tipoDocumento, documento: form.documento,
        estado: form.estado, cidade: form.cidade, bairro: form.bairro,
        grauApoio: form.grauApoio,
        observacoes: form.observacoes,
        colaboradorId: userData.uid, colaboradorNome: userData.nome,
        coordenadorId: userData.coordenadorId || "",
      };
      if (form.telefone) eleitorData.telefone = form.telefone;
      if (form.cep) eleitorData.cep = form.cep;
      if (form.logradouro) eleitorData.logradouro = form.logradouro;
      if (form.numero) eleitorData.numero = form.numero;
      if (form.complemento) eleitorData.complemento = form.complemento;
      if (form.voto) eleitorData.voto = form.voto;
      if (form.candidatoId) eleitorData.candidatoId = form.candidatoId;
      if (form.motivoPrincipal) eleitorData.motivoPrincipal = form.motivoPrincipal;
      if (userData.role === "coordenador") eleitorData.coordenadorNome = userData.nome;
      await cadastrarEleitor(eleitorData);
      await registrarAtividade({ acao: "cadastro_eleitor", usuarioId: userData.uid, usuarioNome: userData.nome, usuarioRole: userData.role, detalhes: `Cadastrou o eleitor ${form.nomeCompleto}` });
      toast.success("Eleitor cadastrado com sucesso!");
      setForm({ ...formInitial });
      limparRascunho();
      setCidadesDisponiveis([]);
      loadEleitores();
    } catch (e) { console.error("ERRO AO CADASTRAR ELEITOR:", e); toast.error("Erro ao cadastrar eleitor"); } finally { setSaving(false); }
  }

  async function handleExcluir(id: string, nome: string) {
    if (!confirm(`Excluir ${nome}?`)) return;
    try { await excluirEleitor(id); toast.success("Eleitor excluído"); loadEleitores(); } catch (e) { toast.error("Erro ao excluir"); }
  }

  const docLabel = form.tipoDocumento === "titulo" ? "Título Eleitoral" : form.tipoDocumento === "cpf" ? "CPF" : "RG";

  const eleitoresFiltrados = useMemo(() => {
    let lista = eleitores;
    if (filtros.texto) {
      const q = filtros.texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      lista = lista.filter((e) =>
        e.nomeCompleto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) ||
        e.cidade?.toLowerCase().includes(q)
      );
    }
    if (filtros.coordenadorId) {
      lista = lista.filter((e) => e.coordenadorId === filtros.coordenadorId);
    }
    if (filtros.colaboradorId) {
      lista = lista.filter((e) => e.colaboradorId === filtros.colaboradorId);
    }
    if (filtros.gabineteId) {
      lista = lista.filter((e) => e.campanhaId === filtros.gabineteId);
    }
    if (filtros.assessorId) {
      const gabId = todosAssessores.find((a) => a.uid === filtros.assessorId)?.gabineteId;
      if (gabId) lista = lista.filter((e) => e.campanhaId === gabId);
    }
    return lista;
  }, [eleitores, filtros, todosAssessores]);

  // Deputado federal: visão analítica executiva — sem formulário operacional
  if (userData && isPolitico(userData)) {
    const agora = Date.now();
    const totalBase = eleitores.length;
    const fortes    = eleitores.filter((e) => e.grauApoio === "forte").length;
    const medios    = eleitores.filter((e) => e.grauApoio === "medio").length;
    const fracos    = eleitores.filter((e) => e.grauApoio === "fraco").length;
    const indecisos = eleitores.filter((e) => e.grauApoio === "indeciso").length;
    const ultimos30    = eleitores.filter((e) => parseDate(e.criadoEm).getTime() > agora - 30 * 86400000).length;
    const anteriores30 = eleitores.filter((e) => { const t = parseDate(e.criadoEm).getTime(); return t > agora - 60 * 86400000 && t <= agora - 30 * 86400000; }).length;
    const crescimento30d = anteriores30 > 0 ? Math.round(((ultimos30 - anteriores30) / anteriores30) * 100) : ultimos30 > 0 ? 100 : 0;

    const cidadeStats = Object.entries(
      eleitores.reduce<Record<string, { total: number; fortes: number; fracos: number; indecisos: number; recentes: number }>>((acc, e) => {
        if (!acc[e.cidade]) acc[e.cidade] = { total: 0, fortes: 0, fracos: 0, indecisos: 0, recentes: 0 };
        acc[e.cidade].total++;
        if (e.grauApoio === "forte")    acc[e.cidade].fortes++;
        if (e.grauApoio === "fraco")    acc[e.cidade].fracos++;
        if (e.grauApoio === "indeciso") acc[e.cidade].indecisos++;
        if (parseDate(e.criadoEm).getTime() > agora - 30 * 86400000) acc[e.cidade].recentes++;
        return acc;
      }, {})
    ).map(([cidade, s]) => ({
      cidade, ...s,
      forca: s.total > 0 ? Math.round((s.fortes / s.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total).slice(0, 15);

    const zonasQuentes = cidadeStats.filter((c) => c.recentes > 0 && c.forca >= 40);
    const zonasFrias   = cidadeStats.filter((c) => c.recentes === 0 && c.total > 0);

    const qualidade = [
      { label: "Base Forte", value: fortes,    cor: "text-emerald-400", bg: "bg-emerald-500" },
      { label: "Apoio Médio", value: medios,   cor: "text-amber-400",   bg: "bg-amber-500"   },
      { label: "Indecisos",   value: indecisos, cor: "text-blue-400",   bg: "bg-blue-500"    },
      { label: "Rejeição",    value: fracos,    cor: "text-red-400",    bg: "bg-red-500"     },
    ];

    const projecaoEleitoral = totalBase > 0 ? Math.round(fortes * 0.9 + medios * 0.6 + indecisos * 0.25 + fracos * 0.05) : 0;
    const concentracaoTop3 = totalBase >= 10 ? (() => {
      const top3 = cidadeStats.slice(0, 3).reduce((s, c) => s + c.total, 0);
      return Math.round((top3 / totalBase) * 100);
    })() : 0;

    return (
      <div className="space-y-6 animate-in">
        <div>
          <h1 className="text-2xl font-bold text-white">Base Eleitoral</h1>
          <p className="text-white/50 text-sm mt-1">Visão analítica territorial da sua base de apoio</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="animate-spin h-8 w-8 text-violet-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <>
            {/* KPIs executivos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <GlassCard className="p-4 text-center">
                <p className="text-3xl font-bold text-white">{totalBase.toLocaleString("pt-BR")}</p>
                <p className="text-xs text-white/40 mt-1">Apoiadores registrados</p>
              </GlassCard>
              <GlassCard className="p-4 text-center">
                <p className={`text-3xl font-bold ${totalBase > 0 && fortes / totalBase > 0.4 ? "text-emerald-400" : "text-amber-400"}`}>
                  {totalBase > 0 ? Math.round((fortes / totalBase) * 100) : 0}%
                </p>
                <p className="text-xs text-white/40 mt-1">Base forte</p>
              </GlassCard>
              <GlassCard className="p-4 text-center">
                <p className="text-3xl font-bold text-blue-400">{indecisos}</p>
                <p className="text-xs text-white/40 mt-1">Indecisos convertíveis</p>
              </GlassCard>
              <GlassCard className="p-4 text-center">
                <p className={`text-3xl font-bold ${crescimento30d >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {crescimento30d > 0 ? "+" : ""}{crescimento30d}%
                </p>
                <p className="text-xs text-white/40 mt-1">Crescimento 30 dias</p>
              </GlassCard>
            </div>

            {/* Projeção eleitoral + concentração de risco */}
            {(projecaoEleitoral > 0 || concentracaoTop3 > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {projecaoEleitoral > 0 && (
                  <GlassCard className="p-4 border-violet-500/10">
                    <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2">Projeção Eleitoral Estimada</p>
                    <p className="text-3xl font-bold text-violet-400">{projecaoEleitoral.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-white/30 mt-1">votos · conversão ponderada por grau</p>
                    <p className="text-[11px] text-white/20 mt-3">Forte ×0.9 · Médio ×0.6 · Indeciso ×0.25 · Fraco ×0.05</p>
                  </GlassCard>
                )}
                {concentracaoTop3 > 0 && (
                  <GlassCard className={`p-4 ${concentracaoTop3 > 70 ? "border-red-500/20" : "border-white/[0.06]"}`}>
                    <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2">Concentração Territorial</p>
                    <p className={`text-3xl font-bold ${concentracaoTop3 > 70 ? "text-red-400" : concentracaoTop3 > 50 ? "text-amber-400" : "text-emerald-400"}`}>
                      {concentracaoTop3}%
                    </p>
                    <p className="text-xs text-white/30 mt-1">da base nos 3 territórios principais</p>
                    <p className={`text-[11px] mt-3 ${concentracaoTop3 > 70 ? "text-red-400/60" : "text-white/20"}`}>
                      {concentracaoTop3 > 70 ? "⚠ Alta dependência territorial" : concentracaoTop3 > 50 ? "Atenção à diversificação" : "Distribuição saudável"}
                    </p>
                  </GlassCard>
                )}
              </div>
            )}

            {/* Composição qualitativa */}
            <GlassCard className="p-5">
              <h3 className="text-white font-semibold mb-4">Composição Qualitativa da Base</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                {qualidade.map(({ label, value, cor }) => (
                  <div key={label} className="text-center p-3 rounded-xl bg-white/[0.03]">
                    <p className={`text-2xl font-bold ${cor}`}>{value}</p>
                    <p className="text-xs text-white/40 mt-1">{label}</p>
                    {totalBase > 0 && <p className={`text-xs mt-0.5 ${cor}`}>{Math.round((value / totalBase) * 100)}%</p>}
                  </div>
                ))}
              </div>
              {totalBase > 0 && (
                <div className="flex h-2 rounded-full overflow-hidden">
                  {qualidade.map(({ label, value, bg }) => (
                    <div key={label} className={`${bg} transition-all`} style={{ width: `${Math.round((value / totalBase) * 100)}%` }} />
                  ))}
                </div>
              )}
            </GlassCard>

            {/* Zonas quentes e frias */}
            {(zonasQuentes.length > 0 || zonasFrias.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {zonasQuentes.length > 0 && (
                  <GlassCard className="p-4 border-emerald-500/10">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">🔥</span>
                      <h3 className="text-white font-semibold text-sm">Territórios em Ascensão</h3>
                    </div>
                    <div className="space-y-2">
                      {zonasQuentes.slice(0, 5).map((z) => (
                        <div key={z.cidade} className="flex items-center justify-between">
                          <span className="text-sm text-white/80">{z.cidade}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-emerald-400">+{z.recentes} novos</span>
                            <span className="text-xs text-white/30">{z.forca}% forte</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )}
                {zonasFrias.length > 0 && (
                  <GlassCard className="p-4 border-red-500/10">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">❄️</span>
                      <h3 className="text-white font-semibold text-sm">Territórios sem Movimento</h3>
                    </div>
                    <div className="space-y-2">
                      {zonasFrias.slice(0, 5).map((z) => (
                        <div key={z.cidade} className="flex items-center justify-between">
                          <span className="text-sm text-white/80">{z.cidade}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/40">{z.total} apoia.</span>
                            <span className={`text-xs ${z.forca < 20 ? "text-red-400" : "text-amber-400"}`}>{z.forca}% forte</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )}
              </div>
            )}

            {/* Ranking territorial */}
            {cidadeStats.length > 0 && (
              <GlassCard className="p-5">
                <h3 className="text-white font-semibold mb-4">Distribuição Territorial por Cidade</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/40 border-b border-white/[0.06]">
                        <th className="text-left py-3 px-2 font-medium">Cidade</th>
                        <th className="text-right py-3 px-2 font-medium">Total</th>
                        <th className="text-right py-3 px-2 font-medium">Fortes</th>
                        <th className="text-right py-3 px-2 font-medium">Indecisos</th>
                        <th className="text-right py-3 px-2 font-medium">Fracos</th>
                        <th className="text-right py-3 px-2 font-medium">30d</th>
                        <th className="text-left py-3 px-2 font-medium">Força</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cidadeStats.map((c) => (
                        <tr key={c.cidade} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-2 text-white/80 font-medium">{c.cidade}</td>
                          <td className="py-3 px-2 text-white/60 text-right">{c.total}</td>
                          <td className="py-3 px-2 text-emerald-400 text-right">{c.fortes}</td>
                          <td className="py-3 px-2 text-blue-400 text-right">{c.indecisos}</td>
                          <td className="py-3 px-2 text-red-400 text-right">{c.fracos}</td>
                          <td className="py-3 px-2 text-right">
                            <span className={`text-xs ${c.recentes > 0 ? "text-emerald-400" : "text-white/30"}`}>
                              {c.recentes > 0 ? `+${c.recentes}` : "—"}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-white/[0.04] rounded-full h-1.5">
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Cadastro de Eleitores</h1>
          <p className="text-white/50 text-sm mt-1">Cadastro rápido e simplificado para equipes de rua</p>
        </div>
        <BuscaGlobal userData={userData} />
      </div>
      <GlassCard className="p-4 md:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input label="Nome Completo *" value={form.nomeCompleto} onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })} placeholder="Nome do eleitor" />
            <Select label="Tipo de Documento" value={form.tipoDocumento} onChange={(e) => setForm({ ...form, tipoDocumento: e.target.value as any, documento: "" })} options={tipoDocOptions} />
            <Input label={docLabel} value={form.documento} onChange={(e) => setForm({ ...form, documento: mascaraDocumento(form.tipoDocumento, e.target.value) })} placeholder={`Número do ${docLabel}`} maxLength={14} />
            <Input label="Telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: mascaraTelefone(e.target.value) })} placeholder="(99) 99999-9999" maxLength={15} />
            <Input label="CEP" value={form.cep} onChange={(e) => setForm({ ...form, cep: mascaraCEP(e.target.value) })} onBlur={(e) => buscarCep(e.target.value)} placeholder="00000-000" maxLength={9} />
            <Input label="Logradouro" value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} placeholder="Rua, Av..." />
            <Input label="Número" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="Nº" />
            <Select label="Complemento" value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} options={[{ value: "", label: "Selecione..." }, { value: "Casa", label: "Casa" }, { value: "Apartamento", label: "Apartamento" }, { value: "Sala Comercial", label: "Sala Comercial" }, { value: "Kitnet", label: "Kitnet" }, { value: "Cobertura", label: "Cobertura" }, { value: "Flat", label: "Flat" }, { value: "Loft", label: "Loft" }, { value: "Condomínio", label: "Condomínio" }, { value: "Sítio", label: "Sítio" }, { value: "Chácara", label: "Chácara" }, { value: "Fazenda", label: "Fazenda" }, { value: "__outro__", label: "Outro (digitar)" }]} />
            {form.complemento === "__outro__" && (
              <Input label="Digite o complemento" value={""} onChange={(e) => setForm({ ...form, complemento: e.target.value })} placeholder="Ex: Fundos, 2º andar..." />
            )}
            <Select label="Estado" value={form.estado} onChange={(e) => handleEstadoChange(e.target.value)} options={estados.map((e) => ({ value: e.sigla, label: `${e.sigla} - ${e.nome}` }))} />
            <Select label="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value, bairro: "" })} options={cidadesDisponiveis.map((c) => ({ value: c, label: c }))} disabled={!form.estado} />
            {isOperacional ? (
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Bairro</label>
                <input
                  list="bairros-datalist"
                  value={form.bairro}
                  onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                  placeholder="Digite ou selecione o bairro"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                />
                <datalist id="bairros-datalist">
                  {getBairros(form.cidade).map((b) => (
                    <option key={`${form.cidade}-${b}`} value={b} />
                  ))}
                </datalist>
              </div>
            ) : (
              <Input label="Bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} placeholder="Bairro" />
            )}
            <Select label="Grau de Apoio *" value={form.grauApoio} onChange={(e) => setForm({ ...form, grauApoio: e.target.value })} options={grauOptions} />
            <Select label="Intenção de Voto" value={form.voto} onChange={(e) => setForm({ ...form, voto: e.target.value, candidatoId: "" })} options={opcoesVoto} />
            {form.voto === "sim" && candidatos.length > 0 && (
              <Select label="Candidato" value={form.candidatoId} onChange={(e) => setForm({ ...form, candidatoId: e.target.value })} options={candidatos.map((c) => ({ value: c.id!, label: `${c.nome} (${c.partido})` }))} />
            )}
            {form.voto === "sim" && candidatos.length === 0 && (
              <p className="text-sm text-amber-400 flex items-center gap-2 self-end pb-2">Cadastre candidatos primeiro na página Candidatos</p>
            )}
            {isOperacional && (
              <Select label="Motivo Principal" value={form.motivoPrincipal} onChange={(e) => setForm({ ...form, motivoPrincipal: e.target.value })} options={MOTIVOS_PRINCIPAIS} />
            )}
            {isOperacional ? (
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-white/70 mb-1.5">Observações</label>
                <textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Detalhes adicionais (opcional)"
                  rows={2}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none"
                />
              </div>
            ) : (
              <div className="md:col-span-2 lg:col-span-1">
                <Input label="Observações" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Observações (opcional)" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving} className="w-full md:w-auto">
              <UserPlus size={18} />{saving ? "Salvando..." : "Cadastrar Eleitor"}
            </Button>
            {buscandoCep && <span className="text-sm text-white/40 animate-pulse">Buscando CEP...</span>}
          </div>
        </form>
      </GlassCard>
      <BuscaOperacional
        pagina="eleitores"
        userData={userData}
        assessores={todosAssessores}
        coordenadores={todosCoordenadores}
        colaboradores={todosColaboradores}
        onFilter={setFiltros}
      />
      <div className="flex items-center gap-3">
        <span className="text-sm text-white/40">{eleitoresFiltrados.length} registros</span>
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-emerald-500" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 border-b border-white/[0.06]">
                <th className="text-left py-3 px-2 font-medium">Nome</th>
                <th className="text-left py-3 px-2 font-medium">Documento</th>
                <th className="text-left py-3 px-2 font-medium">Telefone</th>
                <th className="text-left py-3 px-2 font-medium">Cidade/Estado</th>
                <th className="text-left py-3 px-2 font-medium">Grau</th>
                <th className="text-left py-3 px-2 font-medium">Colaborador</th>
                <th className="text-left py-3 px-2 font-medium">Data</th>
                {(isAssessor(userData) || isSuperOrMaster(userData) || isCoordenador(userData)) && <th className="text-left py-3 px-2 font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {eleitoresFiltrados.map((eleitor) => (
                <tr key={eleitor.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-2 text-white/80">{eleitor.nomeCompleto}</td>
                  <td className="py-3 px-2 text-white/60 text-xs">{eleitor.tipoDocumento?.toUpperCase()}: {eleitor.documento}</td>
                  <td className="py-3 px-2 text-white/60">{eleitor.telefone || "-"}</td>
                  <td className="py-3 px-2 text-white/60">{eleitor.cidade}/{eleitor.estado}</td>
                  <td className="py-3 px-2"><Badge variant={eleitor.grauApoio === "forte" ? "success" : eleitor.grauApoio === "medio" ? "warning" : eleitor.grauApoio === "fraco" ? "danger" : "info"}>{eleitor.grauApoio}</Badge></td>
                  <td className="py-3 px-2 text-white/60">{eleitor.colaboradorNome}</td>
                  <td className="py-3 px-2 text-white/40 text-xs">{formatDate(eleitor.criadoEm)}</td>
                  {(isAssessor(userData) || isSuperOrMaster(userData) || isCoordenador(userData)) && (
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditingEleitor(eleitor)} className="text-white/30 hover:text-emerald-400 transition-colors" title="Editar">
                          <Pencil size={16} />
                        </button>
                        {(isAssessor(userData) || isSuperOrMaster(userData)) && (
                          <button onClick={() => handleExcluir(eleitor.id!, eleitor.nomeCompleto)} className="text-white/30 hover:text-red-400 transition-colors" title="Excluir">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {eleitoresFiltrados.length === 0 && <tr><td colSpan={8} className="py-4"><EmptyState icon={filtros.texto ? "🔍" : "📋"} title={filtros.texto ? "Nenhum resultado encontrado" : "Nenhum eleitor cadastrado"} description={filtros.texto ? "Tente buscar por nome ou cidade diferente" : "Colaboradores ainda não cadastraram eleitores"} /></td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {editingEleitor && (
        <EditarEleitorModal
          eleitor={editingEleitor}
          open={!!editingEleitor}
          onClose={() => setEditingEleitor(null)}
          onSaved={loadEleitores}
        />
      )}
    </div>
  );
}
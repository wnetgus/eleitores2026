"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy, where, doc, setDoc, getDoc, updateDoc, deleteDoc, deleteField, serverTimestamp } from "firebase/firestore";
import { createAuthUser, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Eleitor, AppUser, Gabinete, UserRole, ROLE_CONFIG } from "@/types";
import { getRoleConfig, isAssessor, isCoordenador, isColaborador, canManageColaboradores, canViewColaboradores, isSuperOrMaster } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatDate, parseDate, mascaraTelefone, mascaraCEP, mascaraDocumento, sugerirEmail } from "@/lib/utils";
import { estados, getCidades } from "@/lib/estados-cidades";
import { BuscaGlobal } from "@/components/ui/BuscaGlobal";
import { BuscaOperacional, FiltrosOperacionais } from "@/components/ui/BuscaOperacional";
import { Users, Trophy, TrendingUp, Calendar, UserPlus, Zap, Mail, MapPin, Building2, ChevronRight, Trash2, Pencil, Search } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import toast from "react-hot-toast";
import { registrarAtividade } from "@/lib/firestore";
import { calcularSaudeColaborador, SaudeStatus } from "@/lib/inteligencia";


export default function ColaboradoresPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const gabineteIdParam = searchParams.get("gabineteId");
  const assessorIdParam = searchParams.get("assessorId");
  const [gabineteContexto, setGabineteContexto] = useState<{ id: string; nome: string; cargo: string } | null>(null);
  const [assessorContexto, setAssessorContexto] = useState<{ id: string; nome: string } | null>(null);
  const [coordenadoresDisponiveis, setCoordenadoresDisponiveis] = useState<AppUser[]>([]);
  const [todosGabinetes, setTodosGabinetes] = useState<Gabinete[]>([]);
  const [todosAssessores, setTodosAssessores] = useState<AppUser[]>([]);
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [colaboradores, setColaboradores] = useState<AppUser[]>([]);
  const [selectedColaborador, setSelectedColaborador] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: "", password: "", nome: "", telefone: "", tipoDocumento: "", documento: "", cep: "", logradouro: "", numero: "", bairro: "", estado: "", cidade: "", observacoes: "", coordenadorId: "", gabineteVinculoId: "" });
  const [cidadesDisponiveis, setCidadesDisponiveis] = useState<string[]>([]);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [emailManual, setEmailManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editModal, setEditModal] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", email: "" });
  const [excluirModal, setExcluirModal] = useState<AppUser | null>(null);
  const [excluirSaving, setExcluirSaving] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosOperacionais>({ texto: "" });
  const [correcaoModal, setCorrecaoModal] = useState<AppUser | null>(null);
  const [correcaoForm, setCorrecaoForm] = useState({ nome: "", email: "", telefone: "", tipoDocumento: "", documento: "", bairro: "", estado: "", cidade: "", observacoes: "" });
  const [correcaoCidades, setCorrecaoCidades] = useState<string[]>([]);
  const [correcaoSaving, setCorrecaoSaving] = useState(false);

  useEffect(() => {
    if (userData && !canViewColaboradores(userData)) { router.push(isColaborador(userData) ? "/eleitores" : "/dashboard"); return; }
    loadData();
  }, [userData]);

  useEffect(() => {
    if (form.nome && !emailManual) {
      const sugestao = sugerirEmail(form.nome, "colaborador");
      if (sugestao) setForm((f) => ({ ...f, email: sugestao }));
    }
  }, [form.nome]);

  async function loadData() {
    try {
      if (isSuperOrMaster(userData)) {
        const [gSnap, aSnap, cSnap] = await Promise.all([
          getDocs(collection(db, "campanhas")),
          getDocs(query(collection(db, "usuarios"), where("role", "==", "assessor"))),
          getDocs(query(collection(db, "usuarios"), where("role", "==", "coordenador"))),
        ]);
        setTodosGabinetes(gSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Gabinete)));
        setTodosAssessores(aSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
        setCoordenadoresDisponiveis(cSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
        if (gabineteIdParam) {
          const gDoc = await getDoc(doc(db, "campanhas", gabineteIdParam));
          if (gDoc.exists()) {
            const g = gDoc.data() as Gabinete;
            setGabineteContexto({ id: gabineteIdParam, nome: g.nome, cargo: g.cargo?.replace(/_/g, " ") });
          }
          if (assessorIdParam) {
            const assessorDoc = await getDoc(doc(db, "usuarios", assessorIdParam));
            if (assessorDoc.exists()) {
              const a = assessorDoc.data() as AppUser;
              setAssessorContexto({ id: assessorIdParam, nome: a.nome });
            }
          }
        }
      }
      // Assessor: coordenadores próprios + todos colaboradores/eleitores do gabinete
      if (isAssessor(userData)) {
        const gabId = userData!.campanhaId || userData!.gabineteId || "";
        const [coordSnap, usnap, esnap] = await Promise.all([
          getDocs(query(collection(db, "usuarios"), where("role", "==", "coordenador"), where("assessorId", "==", userData!.uid))),
          gabId ? getDocs(query(collection(db, "usuarios"), where("role", "==", "colaborador"), where("campanhaId", "==", gabId))) : Promise.resolve({ docs: [] as any[] }),
          gabId ? getDocs(query(collection(db, "eleitores"), where("campanhaId", "==", gabId), orderBy("criadoEm", "desc"))) : Promise.resolve({ docs: [] as any[] }),
        ]);
        setCoordenadoresDisponiveis(coordSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
        setColaboradores(usnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
        setEleitores(esnap.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor)));
        return;
      }

      const eConstraints: any[] = [orderBy("criadoEm", "desc")];
      if (isCoordenador(userData)) {
        eConstraints.unshift(where("coordenadorId", "==", userData!.uid));
      } else if (!isSuperOrMaster(userData)) {
        const campanhaId = userData?.campanhaId || userData?.gabineteId;
        if (campanhaId) eConstraints.unshift(where("campanhaId", "==", campanhaId));
      }
      const eq = query(collection(db, "eleitores"), ...eConstraints);
      const snap = await getDocs(eq);
      setEleitores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor)));

      const uConstraints: any[] = [where("role", "==", "colaborador")];
      if (isCoordenador(userData)) uConstraints.push(where("coordenadorId", "==", userData!.uid));
      else if (!isSuperOrMaster(userData)) {
        const campanhaId = userData?.campanhaId || userData?.gabineteId;
        if (campanhaId) uConstraints.push(where("campanhaId", "==", campanhaId));
      }
      const uq = query(collection(db, "usuarios"), ...uConstraints);
      const usnap = await getDocs(uq);
      setColaboradores(usnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  function handleEstadoChange(sigla: string) {
    setForm((f) => ({ ...f, estado: sigla, cidade: "" }));
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
        const siglaEstado = data.uf;
        setForm((f) => ({
          ...f, cep: cepLimpo,
          logradouro: data.logradouro || f.logradouro,
          bairro: data.bairro || f.bairro,
          cidade: data.localidade || f.cidade,
          estado: siglaEstado || f.estado,
        }));
        setCidadesDisponiveis(getCidades(siglaEstado));
      }
    } catch {} finally { setBuscandoCep(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!userData) return;
    if (!form.email || !form.nome) { toast.error("Preencha nome e email", { duration: 4000 }); return; }
    if (!isCoordenador(userData) && (!form.password || form.password.length < 6)) { toast.error("Senha deve ter no mínimo 6 caracteres", { duration: 4000 }); return; }
    if (isAssessor(userData) && !form.coordenadorId) { toast.error("Selecione um Coordenador Responsável", { duration: 4000 }); return; }
    if (isSuperOrMaster(userData) && !gabineteIdParam && !form.gabineteVinculoId) { toast.error("Selecione o gabinete para vincular o colaborador", { duration: 4000 }); return; }
    setSaving(true);
    try {
      const campanhaVinculo = gabineteIdParam || form.gabineteVinculoId || userData.gabineteId || userData.campanhaId || "";
      const dados: Record<string, any> = {
        email: form.email, nome: form.nome, role: "colaborador",
        gabineteId: campanhaVinculo,
        campanhaId: campanhaVinculo,
        criadoPor: userData.uid,
        criadoEm: serverTimestamp(),
      };
      if (form.telefone) dados.telefone = form.telefone;
      if (form.cep) dados.cep = form.cep;
      if (form.logradouro) dados.logradouro = form.logradouro;
      if (form.numero) dados.numero = form.numero;
      if (form.bairro) dados.bairro = form.bairro;
      if (form.estado) dados.estado = form.estado;
      if (form.cidade) dados.cidade = form.cidade;
      if (form.observacoes) dados.observacoes = form.observacoes;
      if (form.tipoDocumento) dados.tipoDocumento = form.tipoDocumento;
      if (form.documento) dados.documento = form.documento;
      if (isCoordenador(userData)) {
        dados.coordenadorId = userData.uid;
        dados.status = "pendente";
        dados.ativo = false;
        dados.solicitadoPor = userData.uid;
        dados.solicitadoPorNome = userData.nome;
        await setDoc(doc(db, "usuarios", `pendente_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`), dados);
        await registrarAtividade({
          acao: "solicitou_colaborador", usuarioId: userData.uid, usuarioNome: userData.nome,
          usuarioRole: userData.role, detalhes: `Solicitou colaborador ${form.nome}`,
        });
        toast.success("Colaborador solicitado! Aguardando aprovação do assessor.", { duration: 4000 });
      } else if (gabineteIdParam && isSuperOrMaster(userData)) {
        if (form.coordenadorId) dados.coordenadorId = form.coordenadorId;
        dados.gabineteId = gabineteIdParam;
        dados.campanhaId = gabineteIdParam;
        dados.status = "ativo";
        dados.ativo = true;
        await createAuthUser(form.email, form.password, dados);
        await registrarAtividade({
          acao: "criar_colaborador", usuarioId: userData.uid, usuarioNome: userData.nome,
          usuarioRole: userData.role, detalhes: `Criou colaborador ${form.nome} via contexto`,
        });
        toast.success("Colaborador criado!", { duration: 4000 });
      } else {
        if (form.coordenadorId) dados.coordenadorId = form.coordenadorId;
        dados.status = "ativo";
        dados.ativo = true;
        await createAuthUser(form.email, form.password, dados);
        await registrarAtividade({
          acao: "criar_colaborador", usuarioId: userData.uid, usuarioNome: userData.nome,
          usuarioRole: userData.role, detalhes: `Criou colaborador ${form.nome}`,
        });
        toast.success("Colaborador criado!", { duration: 4000 });
      }
      setForm({ email: "", password: "", nome: "", telefone: "", tipoDocumento: "", documento: "", cep: "", logradouro: "", numero: "", bairro: "", estado: "", cidade: "", observacoes: "", coordenadorId: "", gabineteVinculoId: "" });
      setCidadesDisponiveis([]);
      loadData();
    } catch (error: any) { console.error("ERRO AO CRIAR COLABORADOR:", error); toast.error(error.code === "auth/email-already-in-use" ? "Email já está em uso" : `Erro: ${error.message || "Erro ao criar"}`, { duration: 5000 }); } finally { setSaving(false); }
  }

  function openEditColab(c: AppUser) {
    setEditForm({ nome: c.nome, email: c.email });
    setEditModal(c);
  }

  async function handleEditColab() {
    if (!editModal) return;
    try {
      await updateDoc(doc(db, "usuarios", editModal.uid), { nome: editForm.nome, email: editForm.email });
      toast.success("Colaborador atualizado!"); setEditModal(null); loadData();
    } catch (e) { toast.error("Erro ao atualizar"); }
  }

  async function handleToggleColabStatus(uid: string, ativo: boolean) {
    try { await updateDoc(doc(db, "usuarios", uid), { ativo: !ativo }); toast.success(`Colaborador ${ativo ? "desativado" : "ativado"}`); loadData(); } catch (e) { toast.error("Erro"); }
  }

  async function handleExcluirColab() {
    if (!excluirModal) return;
    setExcluirSaving(true);
    try {
      await deleteDoc(doc(db, "usuarios", excluirModal.uid));
      toast.success("Colaborador excluído!");
      setExcluirModal(null);
      loadData();
    } catch (e) { toast.error("Erro ao excluir"); } finally { setExcluirSaving(false); }
  }

  function openCorrecao(c: AppUser) {
    setCorrecaoForm({
      nome: c.nome || "",
      email: c.email || "",
      telefone: c.telefone || "",
      tipoDocumento: c.tipoDocumento || "",
      documento: c.documento || "",
      bairro: c.bairro || "",
      estado: c.estado || "",
      cidade: c.cidade || "",
      observacoes: c.observacoes || "",
    });
    if (c.estado) setCorrecaoCidades(getCidades(c.estado));
    setCorrecaoModal(c);
  }

  async function handleCorrigir() {
    if (!correcaoModal) return;
    setCorrecaoSaving(true);
    try {
      await updateDoc(doc(db, "usuarios", correcaoModal.uid), {
        nome: correcaoForm.nome,
        email: correcaoForm.email,
        telefone: correcaoForm.telefone || deleteField(),
        tipoDocumento: correcaoForm.tipoDocumento || deleteField(),
        documento: correcaoForm.documento || deleteField(),
        bairro: correcaoForm.bairro || deleteField(),
        estado: correcaoForm.estado || deleteField(),
        cidade: correcaoForm.cidade || deleteField(),
        observacoes: correcaoForm.observacoes || deleteField(),
        status: "pendente",
        ativo: false,
        recusaMotivo: deleteField(),
        recusaJustificativa: deleteField(),
        dataRecusa: deleteField(),
        recusadoPor: deleteField(),
        recusadoPorNome: deleteField(),
        tentativas: (correcaoModal.tentativas ?? 0) + 1,
        reenviadoEm: serverTimestamp(),
      });
      await registrarAtividade({
        acao: "reenviou_solicitacao", usuarioId: userData!.uid, usuarioNome: userData!.nome,
        usuarioRole: userData!.role, detalhes: `Corrigiu e reenviou solicitação de ${correcaoForm.nome}`,
      });
      toast.success("Solicitação reenviada! Aguardando aprovação do assessor.");
      setCorrecaoModal(null);
      loadData();
    } catch (e) {
      toast.error("Erro ao reenviar solicitação");
    } finally {
      setCorrecaoSaving(false);
    }
  }

  const coordMapFull = useMemo(() => {
    const map: Record<string, AppUser> = {};
    coordenadoresDisponiveis.forEach((c) => { map[c.uid] = c; });
    return map;
  }, [coordenadoresDisponiveis]);

  const assessorNomeMap = useMemo(() => {
    const map: Record<string, string> = {};
    todosAssessores.forEach((a) => { map[a.uid] = a.nome; });
    if (isAssessor(userData) && userData) map[userData.uid] = userData.nome;
    return map;
  }, [todosAssessores, userData]);

  const colaboradoresFiltrados = useMemo(() => {
    let lista = colaboradores;
    if (filtros.texto) {
      const q = filtros.texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      lista = lista.filter((c) =>
        c.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    }
    if (filtros.coordenadorId) {
      lista = lista.filter((c) => c.coordenadorId === filtros.coordenadorId);
    }
    if (filtros.gabineteId) {
      lista = lista.filter((c) => (c.gabineteId || c.campanhaId) === filtros.gabineteId);
    }
    if (filtros.assessorId) {
      const coordsDoAssessor = coordenadoresDisponiveis
        .filter((c) => c.assessorId === filtros.assessorId)
        .map((c) => c.uid);
      lista = lista.filter((c) => coordsDoAssessor.includes(c.coordenadorId || ""));
    }
    return lista;
  }, [colaboradores, filtros, coordenadoresDisponiveis]);

  const saudeMap = useMemo(() => {
    const map: Record<string, SaudeStatus> = {};
    for (const c of colaboradoresFiltrados) {
      if (c.status !== "pendente" && c.status !== "recusado") {
        map[c.uid] = calcularSaudeColaborador(c.ultimaAtividade, c.criadoEm);
      }
    }
    return map;
  }, [colaboradoresFiltrados]);

  const bairroByColab = useMemo(() => {
    const map: Record<string, string> = {};
    colaboradores.forEach((c) => {
      if (c.bairro || c.cidade) map[c.uid] = [c.bairro, c.cidade].filter(Boolean).join(" · ");
    });
    return map;
  }, [colaboradores]);

  if (!userData || !canViewColaboradores(userData)) return null;
  const podeGerenciar = canManageColaboradores(userData);
  const config = getRoleConfig(userData);
  const roleInfo = ROLE_CONFIG[userData.role];

  const colaboradoresIds = new Set(colaboradores.map((c) => c.uid));
  const ranking = eleitores.filter((e) => e.colaboradorId && colaboradoresIds.has(e.colaboradorId)).reduce<Record<string, { nome: string; total: number; id: string }>>((acc, e) => {
    if (!acc[e.colaboradorId]) acc[e.colaboradorId] = { nome: e.colaboradorNome, total: 0, id: e.colaboradorId };
    acc[e.colaboradorId].total++;
    return acc;
  }, {});
  const rankingArray = Object.values(ranking).sort((a, b) => b.total - a.total);
  const top3 = rankingArray.slice(0, 3);

  const colaboradoresAtivos = colaboradores.filter((c) => c.status !== "pendente" && c.status !== "recusado");
  const saudeAtivosCount = colaboradoresAtivos.filter((c) => {
    const s = saudeMap[c.uid];
    return s && (s.status === "ativo" || s.status === "iniciando" || s.status === "atencao");
  }).length;
  const colabsSemAtividadeCount = Object.values(saudeMap).filter(
    (s) => s.status === "inativo" || s.status === "sem_atividade"
  ).length;
  const cadastros7d = eleitores.filter((e) => parseDate(e.criadoEm).getTime() > Date.now() - 7 * 86400000).length;
  const topTerritorio = (() => {
    if (eleitores.length === 0) return null;
    const map: Record<string, number> = {};
    eleitores.forEach((e) => { const k = e.bairro || e.cidade; if (k) map[k] = (map[k] || 0) + 1; });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return null;
    return { nome: sorted[0][0], pct: Math.round((sorted[0][1] / eleitores.length) * 100) };
  })();

  const selectedEleitores = selectedColaborador ? eleitores.filter((e) => e.colaboradorId === selectedColaborador) : [];
  const diasMap = selectedEleitores.reduce<Record<string, number>>((acc, e) => {
    const d = parseDate(e.criadoEm); const key = d.toLocaleDateString("pt-BR"); acc[key] = (acc[key] || 0) + 1; return acc;
  }, {});
  const crescimentoData = Object.entries(diasMap).map(([dia, total]) => ({ dia, total })).sort((a, b) => {
    const [dA, mA, yA] = a.dia.split("/").map(Number); const [dB, mB, yB] = b.dia.split("/").map(Number);
    return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
  });

  if (loading) return <div className="flex justify-center py-20"><svg className="animate-spin h-8 w-8 text-emerald-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;

  return (
    <div className="space-y-6 animate-in">
      {/* BREADCRUMB CONTEXTUAL */}
      {gabineteContexto && (
        <div className="flex items-center gap-2 text-sm text-white/50 flex-wrap">
          <Building2 size={14} className="text-white/30" />
          <span className="text-white/70">{gabineteContexto.nome}</span>
          {assessorContexto && (
            <>
              <ChevronRight size={12} className="text-white/20" />
              <span className="text-white/70">{assessorContexto.nome}</span>
            </>
          )}
          <ChevronRight size={12} className="text-white/20" />
          <span className="text-emerald-400">Criar Colaborador</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleInfo.gradient} flex items-center justify-center text-lg`}>{roleInfo.icon}</div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{gabineteContexto ? `Colaboradores — ${gabineteContexto.nome}` : "Colaboradores"}</h1>
          <p className={`text-sm ${roleInfo.text}`}>{gabineteContexto ? "Criação contextual rápida" : isAssessor(userData) ? "Gerencie todos os colaboradores" : "Sua equipe de campo"}</p>
        </div>
        <BuscaGlobal userData={userData} />
      </div>

      {podeGerenciar && (
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><UserPlus size={18} className={roleInfo.text} /><h3 className="text-white font-semibold">Criar Colaborador</h3></div>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isSuperOrMaster(userData) && !gabineteIdParam && (
              <Select
                label="Vincular ao gabinete"
                value={form.gabineteVinculoId}
                onChange={(e) => setForm({ ...form, gabineteVinculoId: e.target.value })}
                options={[{ value: "", label: "Selecione o gabinete..." }, ...todosGabinetes.map((g) => ({ value: g.id!, label: `${g.nome} (${g.cargo?.replace(/_/g, " ")})` }))]}
              />
            )}
            {(isAssessor(userData) || gabineteContexto) && coordenadoresDisponiveis.length > 0 && (
              <Select
                label="Coordenador Responsável *"
                value={form.coordenadorId}
                onChange={(e) => setForm({ ...form, coordenadorId: e.target.value })}
                options={[{ value: "", label: "Selecione o coordenador..." }, ...coordenadoresDisponiveis.map((c) => ({ value: c.uid, label: c.nome }))]}
              />
            )}
            <Input label="Nome Completo *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do colaborador" />
            <Input label="Email *" type="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setEmailManual(true); }} onFocus={() => setEmailManual(true)} placeholder="email@exemplo.com" />
            {!isCoordenador(userData) && (
              <Input label="Senha *" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
            )}
            <Input label="Telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: mascaraTelefone(e.target.value) })} placeholder="(99) 99999-9999" maxLength={15} />
            <Select label="Tipo de Documento" value={form.tipoDocumento} onChange={(e) => setForm({ ...form, tipoDocumento: e.target.value, documento: "" })} options={[{ value: "", label: "Selecione..." }, { value: "titulo", label: "Título de Eleitor" }, { value: "cpf", label: "CPF" }, { value: "rg", label: "RG" }]} />
            <Input label="Nº do Documento" value={form.documento} onChange={(e) => setForm({ ...form, documento: mascaraDocumento(form.tipoDocumento, e.target.value) })} placeholder="Número do documento" maxLength={14} />
            <Input label="CEP" value={form.cep} onChange={(e) => setForm({ ...form, cep: mascaraCEP(e.target.value) })} onBlur={(e) => buscarCep(e.target.value)} placeholder="00000-000" maxLength={9} />
            <Input label="Logradouro" value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} placeholder="Rua, Av..." />
            <Input label="Número" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="Nº" />
            <Select label="Estado" value={form.estado} onChange={(e) => handleEstadoChange(e.target.value)} options={estados.map((e) => ({ value: e.sigla, label: `${e.sigla} - ${e.nome}` }))} />
            <Select label="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} options={cidadesDisponiveis.map((c) => ({ value: c, label: c }))} disabled={!form.estado} />
            <Input label="Bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} placeholder="Bairro" />
            <div className="md:col-span-2 lg:col-span-1">
              <Input label="Observações" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Observações (opcional)" />
            </div>
          </div>
          {isAssessor(userData) && coordenadoresDisponiveis.length === 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-400">⚠ Cadastre ao menos um Coordenador antes de criar Mobilizadores.</p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving} disabled={isAssessor(userData) && coordenadoresDisponiveis.length === 0}><UserPlus size={18} />{saving ? "Salvando..." : "Criar Colaborador"}</Button>
            {buscandoCep && <span className="text-sm text-white/40 animate-pulse">Buscando CEP...</span>}
            {isCoordenador(userData) && <span className="text-xs text-amber-400/70">O colaborador ficará pendente até o assessor aprovar</span>}
          </div>
        </form>
      </GlassCard>
      )}

      {isCoordenador(userData) ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard title="Colaboradores" value={colaboradoresAtivos.length} icon={<Users size={20} />} delay={0} />
          <StatCard title="Total Cadastros" value={eleitores.length} icon={<TrendingUp size={20} />} delay={100} />
          <StatCard title="Equipe Ativa" value={`${saudeAtivosCount}/${colaboradoresAtivos.length}`} icon={<Zap size={20} />} delay={200} />
          <StatCard title="Cadastros (7d)" value={cadastros7d} icon={<Calendar size={20} />} delay={300} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="Total Colaboradores" value={colaboradores.length} icon={<Users size={20} />} delay={0} />
          <StatCard title="Total Cadastros" value={eleitores.length} icon={<TrendingUp size={20} />} delay={100} />
          <StatCard title="Média p/ Colaborador" value={colaboradores.length > 0 ? Math.round(eleitores.length / colaboradores.length) : 0} icon={<Calendar size={20} />} delay={200} />
        </div>
      )}

      {isCoordenador(userData) && (
        <GlassCard className="p-5 border-blue-500/10">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={15} className="text-blue-400" />
            <span className="text-xs text-blue-400 font-semibold uppercase tracking-wider">Resumo da Equipe</span>
          </div>
          <div className="space-y-2">
            {rankingArray.length > 0 && eleitores.length > 0 && (
              <p className="text-sm text-white/80">
                🥇 <span className="text-white font-medium">{rankingArray[0].nome.split(" ")[0]}</span> lidera a equipe com{" "}
                <span className="text-white font-medium">{rankingArray[0].total}</span> cadastros.
              </p>
            )}
            {colabsSemAtividadeCount > 0 && (
              <p className="text-sm text-amber-400/80">
                ⚠ {colabsSemAtividadeCount} colaborador{colabsSemAtividadeCount > 1 ? "es" : ""} sem atividade há mais de 10 dias.
              </p>
            )}
            {topTerritorio && (
              <p className="text-sm text-white/60">
                📍 <span className="text-white/80">{topTerritorio.nome}</span> concentra{" "}
                <span className="text-white/80">{topTerritorio.pct}%</span> da produção da equipe.
              </p>
            )}
            {cadastros7d === 0 && eleitores.length > 0 && (
              <p className="text-sm text-red-400/80">
                ⚠ Nenhum cadastro registrado nos últimos 7 dias.
              </p>
            )}
            {cadastros7d > 0 && colabsSemAtividadeCount === 0 && (
              <p className="text-sm text-emerald-400/80">
                ✅ Equipe em ritmo ativo — {cadastros7d} cadastro{cadastros7d !== 1 ? "s" : ""} nos últimos 7 dias.
              </p>
            )}
            {eleitores.length === 0 && (
              <p className="text-sm text-white/40">Nenhum cadastro ainda. Acione sua equipe.</p>
            )}
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><Trophy size={20} className="text-amber-400" /><h3 className="text-white font-semibold">Ranking de Colaboradores</h3></div>
        <div className="h-72 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rankingArray} layout="vertical">
              <XAxis type="number" stroke="rgba(255,255,255,0.1)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} />
              <YAxis dataKey="nome" type="category" stroke="rgba(255,255,255,0.1)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} width={140} />
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, color: "#fff" }} />
              <Bar dataKey="total" fill="#10b981" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {top3.map((col, idx) => {
          const s = saudeMap[col.id];
          const territorio = bairroByColab[col.id];
          return (
            <GlassCard key={col.id} className="p-5 cursor-pointer hover:border-white/12 transition-all" onClick={() => setSelectedColaborador(col.id)}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${idx === 0 ? "bg-amber-500/20 text-amber-400" : idx === 1 ? "bg-gray-400/20 text-gray-300" : "bg-amber-700/20 text-amber-600"}`}>{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{col.nome}</p>
                  <p className="text-xs text-white/40">{col.total} cadastros</p>
                </div>
                {s && (
                  <div className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-lg shrink-0 ${s.bg} ${s.cor}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                    <span className="font-medium whitespace-nowrap">{s.label}</span>
                  </div>
                )}
              </div>
              {territorio && (
                <p className="flex items-center gap-1 text-xs text-white/35 mb-3">
                  <MapPin size={10} className="shrink-0" />
                  {territorio}
                </p>
              )}
              <div className="w-full bg-white/5 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${(col.total / rankingArray[0].total) * 100}%` }} />
              </div>
            </GlassCard>
          );
        })}
      </div>

      {selectedColaborador && (
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Detalhes: {ranking[selectedColaborador]?.nome || "Colaborador"}</h3>
            <button onClick={() => setSelectedColaborador(null)} className="text-white/40 hover:text-white text-sm">Fechar</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <GlassCard className="p-4 text-center"><p className="text-2xl font-bold text-white">{selectedEleitores.length}</p><p className="text-xs text-white/40">Total</p></GlassCard>
            <GlassCard className="p-4 text-center"><p className="text-2xl font-bold text-emerald-400">{crescimentoData.length > 0 ? crescimentoData[crescimentoData.length - 1].total : 0}</p><p className="text-xs text-white/40">Último dia</p></GlassCard>
            <GlassCard className="p-4 text-center"><p className="text-2xl font-bold text-blue-400">{selectedEleitores.length > 0 ? (selectedEleitores.length / Math.max(crescimentoData.length, 1)).toFixed(1) : 0}</p><p className="text-xs text-white/40">Média/dia</p></GlassCard>
          </div>
          {crescimentoData.length > 0 && (
            <div className="h-48 mb-6 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={crescimentoData}>
                  <defs><linearGradient id="colabGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="dia" stroke="rgba(255,255,255,0.1)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} />
                  <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, color: "#fff" }} />
                  <Area type="monotone" dataKey="total" stroke="#10b981" fillOpacity={1} fill="url(#colabGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-white/40 border-b border-white/[0.06]"><th className="text-left py-2 px-2 font-medium">Nome</th><th className="text-left py-2 px-2 font-medium">Cidade</th><th className="text-left py-2 px-2 font-medium">Grau</th><th className="text-left py-2 px-2 font-medium">Data</th></tr></thead>
              <tbody>{selectedEleitores.map((e) => (
                <tr key={e.id} className="border-b border-white/[0.03]"><td className="py-2 px-2 text-white/70">{e.nomeCompleto}</td><td className="py-2 px-2 text-white/50">{e.cidade}</td><td className="py-2 px-2"><Badge variant={e.grauApoio === "forte" ? "success" : e.grauApoio === "medio" ? "warning" : e.grauApoio === "fraco" ? "danger" : "info"}>{e.grauApoio}</Badge></td><td className="py-2 px-2 text-white/40 text-xs">{formatDate(e.criadoEm)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </GlassCard>
      )}

      <BuscaOperacional
        pagina="colaboradores"
        userData={userData}
        assessores={todosAssessores}
        coordenadores={coordenadoresDisponiveis}
        colaboradores={colaboradores}
        gabinetes={todosGabinetes}
        onFilter={setFiltros}
      />
      <GlassCard className="p-5">
        <div className="mb-4">
          <h3 className="text-white font-semibold">
            {isAssessor(userData) ? "Todos os Colaboradores" : "Meus Colaboradores"}
            <span className="ml-2 text-sm font-normal text-white/40">({colaboradoresFiltrados.length})</span>
          </h3>
          {filtros.assessorId && assessorNomeMap[filtros.assessorId] && (
            <p className="text-xs text-emerald-400/60 mt-0.5">Equipe de <span className="text-emerald-400">{assessorNomeMap[filtros.assessorId]}</span></p>
          )}
          {filtros.coordenadorId && coordMapFull[filtros.coordenadorId] && (
            <p className="text-xs text-emerald-400/60 mt-0.5">Coord. <span className="text-emerald-400">{coordMapFull[filtros.coordenadorId].nome}</span></p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {colaboradoresFiltrados.map((c) => (
            <div key={c.uid} className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-sm">{c.nome.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{c.nome}</p>
                  <p className="text-xs text-white/40 truncate">{c.email}</p>
                </div>
                <div className="flex items-center gap-1">
                  {podeGerenciar && <button onClick={() => openEditColab(c)} className="text-white/30 hover:text-emerald-400 transition-colors" title="Editar"><Pencil size={12} /></button>}
                  {podeGerenciar && (
                    <button onClick={() => setExcluirModal(c)} className="text-white/30 hover:text-red-400 transition-colors" title="Excluir"><Trash2 size={12} /></button>
                  )}
                </div>
                {saudeMap[c.uid] ? (
                  <div className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-lg shrink-0 ${saudeMap[c.uid].bg} ${saudeMap[c.uid].cor}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${saudeMap[c.uid].dot}`} />
                    <span className="font-medium whitespace-nowrap">{saudeMap[c.uid].label}</span>
                  </div>
                ) : (
                  <Badge variant={c.status === "pendente" ? "warning" : "danger"}>
                    {c.status === "pendente" ? "Pendente" : "Recusado"}
                  </Badge>
                )}
              </div>
              {c.status === "recusado" && c.recusaMotivo && (
                <p className="text-xs text-red-400/70 mt-1">Motivo: {c.recusaMotivo === "incompleto" ? "Cadastro incompleto" : c.recusaMotivo === "inconsistente" ? "Dados inconsistentes" : c.recusaMotivo === "duplicado" ? "Cadastro duplicado" : c.recusaMotivo === "invalido" ? "Informações inválidas" : c.recusaMotivo === "regiao" ? "Região não definida" : c.recusaMotivo === "perfil" ? "Perfil não aprovado" : c.recusaMotivo === "correcao" ? "Necessita correção" : c.recusaMotivo === "alinhamento" ? "Aguardando alinhamento" : c.recusaMotivo === "reprovado" ? "Reprovado pela coordenação" : c.recusaMotivo}</p>
              )}
              {c.coordenadorId && coordMapFull[c.coordenadorId] ? (
                <p className="flex items-center gap-1.5 text-xs text-white/60 mt-1.5 truncate">
                  <span className="text-white/35">Coordenador:</span>
                  <span className="text-white/80 font-medium truncate">{coordMapFull[c.coordenadorId].nome}</span>
                </p>
              ) : isAssessor(userData) ? (
                <p className="text-xs text-amber-400/60 mt-1.5">Sem coordenador</p>
              ) : null}
              {(c.bairro || c.cidade) && (
                <p className="flex items-center gap-1 text-[10px] text-white/30 mt-1 truncate">
                  <MapPin size={9} className="shrink-0 text-white/20" />
                  <span>{[c.bairro, c.cidade].filter(Boolean).join(" · ")}</span>
                </p>
              )}
              {isCoordenador(userData) && saudeMap[c.uid] && (
                <p className="text-[10px] text-white/30 mt-1">
                  Última atividade:{" "}
                  <span className={saudeMap[c.uid].cor}>
                    {saudeMap[c.uid].dias === 999 ? "sem registro" : saudeMap[c.uid].dias === 0 ? "hoje" : `${saudeMap[c.uid].dias}d atrás`}
                  </span>
                </p>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] mt-1">
                <div className="flex items-center gap-1.5 text-xs text-white/40">
                  <Users size={11} />
                  <span>{ranking[c.uid]?.total ?? 0} eleitores</span>
                </div>
                {c.status === "recusado" && isCoordenador(userData) && c.coordenadorId === userData?.uid ? (
                  <button onClick={() => openCorrecao(c)} className="text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium">
                    Corrigir Solicitação
                  </button>
                ) : podeGerenciar && c.status !== "pendente" && c.status !== "recusado" ? (
                  <button onClick={() => handleToggleColabStatus(c.uid, c.ativo)} className={`text-xs ${c.ativo ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"} transition-colors`}>
                    {c.ativo ? "Desativar" : "Ativar"}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {colaboradoresFiltrados.length === 0 && <p className="col-span-full text-center text-white/30 py-8">{filtros.texto ? "Nenhum colaborador encontrado" : "Nenhum colaborador"}</p>}
        </div>
      </GlassCard>

      {/* EDITAR COLABORADOR */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Editar Colaborador">
        <div className="space-y-4">
          <Input label="Nome" value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
          <Input label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <div className="flex gap-3 pt-2">
            <Button onClick={handleEditColab} className="flex-1">Salvar</Button>
            <Button variant="ghost" onClick={() => setEditModal(null)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* CORRIGIR SOLICITAÇÃO */}
      <Modal open={!!correcaoModal} onClose={() => setCorrecaoModal(null)} title="Corrigir Solicitação">
        <div className="space-y-4">
          {correcaoModal?.recusaMotivo && (
            <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
              <p className="text-xs text-red-400 font-medium mb-0.5">Motivo da recusa:</p>
              <p className="text-sm text-red-300">{correcaoModal.recusaMotivo}</p>
              {correcaoModal.recusaJustificativa && (
                <p className="text-xs text-red-400/70 mt-1 italic">"{correcaoModal.recusaJustificativa}"</p>
              )}
              {correcaoModal.recusadoPorNome && (
                <p className="text-xs text-white/30 mt-1">Recusado por: {correcaoModal.recusadoPorNome}</p>
              )}
            </div>
          )}
          <Input label="Nome completo" value={correcaoForm.nome} onChange={(e) => setCorrecaoForm({ ...correcaoForm, nome: e.target.value })} />
          <Input label="Email" type="email" value={correcaoForm.email} onChange={(e) => setCorrecaoForm({ ...correcaoForm, email: e.target.value })} />
          <Input label="Telefone" value={correcaoForm.telefone} onChange={(e) => setCorrecaoForm({ ...correcaoForm, telefone: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tipo de documento"
              value={correcaoForm.tipoDocumento}
              onChange={(e) => setCorrecaoForm({ ...correcaoForm, tipoDocumento: e.target.value })}
              options={[{ value: "titulo", label: "Título de Eleitor" }, { value: "cpf", label: "CPF" }, { value: "rg", label: "RG" }]}
            />
            <Input label="Documento" value={correcaoForm.documento} onChange={(e) => setCorrecaoForm({ ...correcaoForm, documento: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Estado"
              value={correcaoForm.estado}
              onChange={(e) => { setCorrecaoForm({ ...correcaoForm, estado: e.target.value, cidade: "" }); setCorrecaoCidades(getCidades(e.target.value)); }}
              options={estados.map((s) => ({ value: s.sigla, label: s.nome }))}
            />
            <Select
              label="Cidade"
              value={correcaoForm.cidade}
              onChange={(e) => setCorrecaoForm({ ...correcaoForm, cidade: e.target.value })}
              options={correcaoCidades.map((c) => ({ value: c, label: c }))}
            />
          </div>
          <Input label="Bairro" value={correcaoForm.bairro} onChange={(e) => setCorrecaoForm({ ...correcaoForm, bairro: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Observações</label>
            <textarea
              value={correcaoForm.observacoes}
              onChange={(e) => setCorrecaoForm({ ...correcaoForm, observacoes: e.target.value })}
              placeholder="Informações adicionais..."
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all min-h-[60px]"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleCorrigir} loading={correcaoSaving} disabled={!correcaoForm.nome || !correcaoForm.email} className="flex-1 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">
              Reenviar Solicitação
            </Button>
            <Button variant="ghost" onClick={() => setCorrecaoModal(null)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* EXCLUIR COLABORADOR */}
      <Modal open={!!excluirModal} onClose={() => setExcluirModal(null)} title="Excluir Colaborador">
        <div className="space-y-4">
          <p className="text-white/60 text-sm">
            Tem certeza que deseja excluir <strong className="text-white">{excluirModal?.nome}</strong>?
          </p>
          <p className="text-red-400/70 text-xs">Esta ação remove o usuário do Firestore. Não é reversível.</p>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleExcluirColab} loading={excluirSaving} className="flex-1 bg-red-500/20 text-red-400 hover:bg-red-500/30">Excluir</Button>
            <Button variant="ghost" onClick={() => setExcluirModal(null)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


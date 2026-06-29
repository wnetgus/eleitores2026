"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy, where, doc, setDoc, updateDoc, getDoc, deleteDoc, addDoc } from "firebase/firestore";
import { createAuthUser, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { AppUser, UserRole, ROLE_CONFIG, Gabinete } from "@/types";
import { getRoleConfig, isSuperOrMaster, isAssessor, isAssessorExecutivo, isPolitico, canViewCoordenadores, canManageUsers } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { BuscaGlobal } from "@/components/ui/BuscaGlobal";
import { BuscaOperacional, FiltrosOperacionais } from "@/components/ui/BuscaOperacional";
import { Target, UserPlus, Shield, Mail, MapPin, Pencil, Power, Users, Filter, X, Building2, ChevronRight, Trash2, Search, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { formatDate, sugerirEmail } from "@/lib/utils";
import { registrarAtividade, registrarMemoriaAutomatica } from "@/lib/firestore";
import { estados, getCidades } from "@/lib/estados-cidades";
import { Modal } from "@/components/ui/Modal";


export default function CoordenadoresPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filtroAtivo = searchParams.get("filtro") === "sem-colaboradores";
  const gabineteIdParam = searchParams.get("gabineteId");
  const assessorIdParam = searchParams.get("assessorId");
  const assessorNomeParam = searchParams.get("assessorNome");
  const cidadeParam = searchParams.get("cidade");
  const assessorParam = searchParams.get("assessor");
  const acaoParam = searchParams.get("acao");
  const alertaEstruturaParam = searchParams.get("alertaEstrutura");
  const alertaEstruturaMunicipios = alertaEstruturaParam
    ? alertaEstruturaParam.split(",").map((par) => {
        const [cidade, assessorNome] = par.split("|").map(decodeURIComponent);
        return { cidade, assessorNome: assessorNome || "" };
      }).filter(({ cidade }) => !!cidade)
    : [] as { cidade: string; assessorNome: string }[];
  const [gabineteContexto, setGabineteContexto] = useState<{ id: string; nome: string; cargo: string } | null>(null);
  const [assessoresDisponiveis, setAssessoresDisponiveis] = useState<AppUser[]>([]);
  const [coordenadores, setCoordenadores] = useState<AppUser[]>([]);
  const [colaboradoresCount, setColaboradoresCount] = useState<Record<string, number>>({});
  const [todosGabinetes, setTodosGabinetes] = useState<Gabinete[]>([]);
  const [form, setForm] = useState({ email: "", password: "", nome: "", estado: "", cidadePrincipal: "", regiao: "", assessorId: "", gabineteVinculoId: "" });
  const [cidadesDisponiveis, setCidadesDisponiveis] = useState<string[]>([]);
  const [cidadesEditDisponiveis, setCidadesEditDisponiveis] = useState<string[]>([]);
  const [emailManual, setEmailManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", email: "", estado: "", cidadePrincipal: "", regiao: "" });
  const [excluirModal, setExcluirModal] = useState<AppUser | null>(null);
  const [excluirSaving, setExcluirSaving] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosOperacionais>({ texto: "" });
  const [modalCriarCoord, setModalCriarCoord] = useState(false);
  const [modalEstabCoord, setModalEstabCoord] = useState(false);
  const [salvandoCoord, setSalvandoCoord] = useState(false);
  const [formCoord, setFormCoord] = useState({ nomeCoord: "" });
  const [metaInicialCoord, setMetaInicialCoord] = useState<10 | 25 | 50 | 100>(25);

  useEffect(() => {
    if (userData && !canViewCoordenadores(userData)) { router.push("/dashboard"); return; }
    loadCoordenadores();
  }, [userData]);

  useEffect(() => {
    if (form.nome && !emailManual) {
      const sugestao = sugerirEmail(form.nome, "coordenador");
      if (sugestao) setForm((f) => ({ ...f, email: sugestao }));
    }
  }, [form.nome, emailManual]);

  async function loadCoordenadores() {
    try {
      if (isSuperOrMaster(userData)) {
        const [gSnap, aSnap] = await Promise.all([
          getDocs(collection(db, "campanhas")),
          getDocs(query(collection(db, "usuarios"), where("role", "==", "assessor"))),
        ]);
        setTodosGabinetes(gSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Gabinete)));
        setAssessoresDisponiveis(aSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
        if (gabineteIdParam) {
          const gDoc = await getDoc(doc(db, "campanhas", gabineteIdParam));
          if (gDoc.exists()) {
            const g = gDoc.data() as Gabinete;
            setGabineteContexto({ id: gabineteIdParam, nome: g.nome, cargo: g.cargo?.replace(/_/g, " ") });
          }
        }
      } else if (isAssessorExecutivo(userData) && userData?.campanhaId) {
        // Executivo vê assessores da sua campanha para poder transferir coordenadores
        const aSnap = await getDocs(
          query(collection(db, "usuarios"), where("role", "==", "assessor"), where("campanhaId", "==", userData.campanhaId))
        );
        setAssessoresDisponiveis(aSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
      }
      const constraints: any[] = [where("role", "==", "coordenador")];
      if (isAssessorExecutivo(userData) && userData?.campanhaId) {
        // Executivo vê todos os coordenadores da campanha
        constraints.push(where("campanhaId", "==", userData.campanhaId));
        constraints.push(orderBy("criadoEm", "desc"));
      } else if (isAssessor(userData) && userData?.uid) {
        constraints.push(where("assessorId", "==", userData.uid));
      } else if (!isSuperOrMaster(userData) && userData?.campanhaId) {
        constraints.push(where("campanhaId", "==", userData.campanhaId));
        constraints.push(orderBy("criadoEm", "desc"));
      } else {
        constraints.push(orderBy("criadoEm", "desc"));
      }
      const q = query(collection(db, "usuarios"), ...constraints);
      const snap = await getDocs(q);
      const coords = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser));
      setCoordenadores(coords);
      const gabIdScope = userData?.gabineteId || userData?.campanhaId;
      const colabQuery = isSuperOrMaster(userData) || !gabIdScope
        ? query(collection(db, "usuarios"), where("role", "==", "colaborador"))
        : query(collection(db, "usuarios"), where("role", "==", "colaborador"), where("campanhaId", "==", gabIdScope));
      const colabSnap = await getDocs(colabQuery);
      const count: Record<string, number> = {};
      colabSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.coordenadorId) count[data.coordenadorId] = (count[data.coordenadorId] || 0) + 1;
      });
      setColaboradoresCount(count);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function salvarCoordenacao() {
    if (!podeGerenciar) { toast.error("Ação restrita ao assessor executivo", { duration: 4000 }); return; }
    if (!formCoord.nomeCoord.trim()) { toast.error("Informe o nome do coordenador responsável", { duration: 4000 }); return; }
    if (!cidadeParam) { toast.error("Município não identificado", { duration: 4000 }); return; }
    setSalvandoCoord(true);
    try {
      await addDoc(collection(db, "coordenacoes"), {
        municipio: cidadeParam,
        campanhaId: userData?.campanhaId || userData?.gabineteId || "",
        coordenadorId: userData?.uid ?? "",
        coordenadorNome: formCoord.nomeCoord.trim(),
        metaInicial: metaInicialCoord,
        status: "ativa",
        criadoEm: new Date(),
        criadoPor: userData?.uid ?? "",
      });
      toast.success("Coordenação criada");
      await registrarMemoriaAutomatica({
        campanhaId: userData?.campanhaId || userData?.gabineteId || "",
        tipo: "conquista",
        titulo: `Coordenação criada em ${cidadeParam}`,
        descricao: `Coordenação territorial estabelecida em ${cidadeParam} por ${formCoord.nomeCoord.trim()}.`,
        prioridade: "media",
        status: "aberto",
        cidade: cidadeParam ?? undefined,
        responsavelId: userData?.uid,
        responsavelNome: userData?.nome,
      });
      setModalCriarCoord(false);
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar. Tente novamente", { duration: 4000 });
    } finally {
      setSalvandoCoord(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password || !form.nome) { toast.error("Preencha todos os campos", { duration: 4000 }); return; }
    if (isSuperOrMaster(userData) && !gabineteIdParam && !form.gabineteVinculoId) { toast.error("Selecione o gabinete para vincular o coordenador", { duration: 4000 }); return; }
    if (gabineteIdParam && isSuperOrMaster(userData) && !form.assessorId) { toast.error("Selecione o assessor responsável", { duration: 4000 }); return; }
    setSaving(true);
    try {
      const campanhaId = gabineteIdParam || form.gabineteVinculoId || userData?.gabineteId || userData?.campanhaId || "";
      await createAuthUser(form.email, form.password, {
        email: form.email, nome: form.nome, role: "coordenador", estado: form.estado, cidadePrincipal: form.cidadePrincipal, regiao: form.regiao,
        campanhaId, gabineteId: campanhaId, criadoEm: new Date(), ativo: true, criadoPor: userData?.uid,
        ...(isAssessor(userData) ? { assessorId: userData!.uid }
           : isAssessorExecutivo(userData) && form.assessorId ? { assessorId: form.assessorId }
           : form.assessorId ? { assessorId: form.assessorId }
           : {}),
      });
      await registrarAtividade({ acao: "criar_coordenador", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Criou coordenador ${form.nome}` });
      toast.success("Coordenador criado");
      setForm({ email: "", password: "", nome: "", estado: "", cidadePrincipal: "", regiao: "", assessorId: "", gabineteVinculoId: "" });
      setEmailManual(false);
      setCidadesDisponiveis([]);
      loadCoordenadores();
    } catch (error: any) { toast.error(error.code === "auth/email-already-in-use" ? "E-mail já está em uso" : "Erro ao criar", { duration: 4000 }); } finally { setSaving(false); }
  }

  async function handleToggleStatus(uid: string, ativo: boolean) {
    if (!podeGerenciar) { toast.error("Sem permissão para esta ação", { duration: 4000 }); return; }
    try { await updateDoc(doc(db, "usuarios", uid), { ativo: !ativo }); toast.success(`Coordenador ${ativo ? "desativado" : "ativado"}`); loadCoordenadores(); } catch (e) { toast.error("Erro", { duration: 4000 }); }
  }

  function openEdit(c: AppUser) {
    setEditForm({ nome: c.nome, email: c.email, estado: c.estado || "", cidadePrincipal: c.cidadePrincipal || "", regiao: c.regiao || "" });
    setCidadesEditDisponiveis(c.estado ? getCidades(c.estado) : []);
    setEditModal(c);
  }

  async function handleEdit() {
    if (!editModal) return;
    if (isAssessor(userData) && editModal.assessorId !== userData!.uid) {
      toast.error("Você só pode editar coordenadores da sua equipe."); return;
    }
    try {
      await updateDoc(doc(db, "usuarios", editModal.uid), { nome: editForm.nome, email: editForm.email, estado: editForm.estado, cidadePrincipal: editForm.cidadePrincipal, regiao: editForm.regiao });
      await registrarAtividade({ acao: "editou_coordenador", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Editou coordenador ${editModal.nome}` });
      toast.success("Coordenador atualizado"); setEditModal(null); loadCoordenadores();
    } catch (e) { toast.error("Erro ao atualizar", { duration: 4000 }); }
  }

  async function handleExcluir() {
    if (!excluirModal) return;
    if (isAssessor(userData) && excluirModal.assessorId !== userData!.uid) {
      toast.error("Você só pode excluir coordenadores da sua equipe."); setExcluirModal(null); return;
    }
    setExcluirSaving(true);
    try {
      // Verificar dependentes antes de excluir (cascade guard)
      const colabsSnap = await getDocs(query(collection(db, "usuarios"), where("coordenadorId", "==", excluirModal.uid), where("role", "==", "colaborador")));
      if (colabsSnap.size > 0) {
        toast.error(`Não é possível excluir: ${colabsSnap.size} colaborador(es) vinculado(s). Transfira ou exclua-os primeiro.`, { duration: 5000 });
        setExcluirModal(null);
        return;
      }
      await deleteDoc(doc(db, "usuarios", excluirModal.uid));
      await registrarAtividade({ acao: "excluiu_coordenador", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Excluiu coordenador ${excluirModal.nome}` });
      toast.success("Coordenador excluído");
      setExcluirModal(null);
      loadCoordenadores();
    } catch (e) { toast.error("Erro ao excluir", { duration: 4000 }); } finally { setExcluirSaving(false); }
  }

  const assessorMap = useMemo(() => {
    const map: Record<string, string> = {};
    assessoresDisponiveis.forEach((a) => { map[a.uid] = a.nome; });
    return map;
  }, [assessoresDisponiveis]);

  const coordenadoresFiltrados = useMemo(() => {
    let lista = coordenadores;
    if (filtros.texto) {
      const q = filtros.texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      lista = lista.filter((c) =>
        c.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    }
    if (filtros.gabineteId) {
      lista = lista.filter((c) => (c.gabineteId || c.campanhaId) === filtros.gabineteId);
    }
    const effectiveAssessorId = filtros.assessorId || assessorIdParam || "";
    if (effectiveAssessorId) {
      lista = lista.filter((c) => c.assessorId === effectiveAssessorId || c.criadoPor === effectiveAssessorId);
    }
    return lista;
  }, [coordenadores, filtros, assessorIdParam]);

  if (!userData || !canViewCoordenadores(userData)) return null;
  const podeGerenciar = isSuperOrMaster(userData) || isAssessorExecutivo(userData);
  const config = getRoleConfig(userData);

  return (
    <div className="space-y-6 animate-in">
      {/* BREADCRUMB CONTEXTUAL */}
      {gabineteContexto && (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Building2 size={14} className="text-white/30" />
          <span className="text-white/70">{gabineteContexto.nome}</span>
          <ChevronRight size={12} className="text-white/20" />
          <span className="text-purple-400">Criar Coordenador</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-lg`}>🎯</div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">
            {gabineteContexto ? `Coordenadores — ${gabineteContexto.nome}` : isAssessor(userData) ? "Estrutura Regional" : "Coordenadores"}
          </h1>
          <p className="text-sm text-purple-400">
            {gabineteContexto ? `Vincule coordenadores ao gabinete ${gabineteContexto.nome}` : isAssessor(userData) ? "Coordenadores da sua equipe" : "Gerencie os coordenadores da campanha"}
          </p>
          {isAssessor(userData) && (userData?.cidades?.length || userData?.cidade) && (
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin size={11} className="text-white/25 shrink-0" />
              <span className="text-xs text-white/35">
                {(userData?.cidades?.length ? userData.cidades : [userData?.cidade ?? ""]).join(" · ")}
              </span>
            </div>
          )}
        </div>
        <BuscaGlobal userData={userData} />
      </div>

      {assessorIdParam && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 text-sm">
          <Shield size={14} className="text-amber-400 shrink-0" />
          <span className="text-white/60">
            Coordenadores de <span className="text-amber-300 font-medium">{assessorNomeParam || "assessor selecionado"}</span>
          </span>
          <a href="/coordenadores" className="ml-auto text-xs text-white/30 hover:text-white/60 transition-colors shrink-0">
            × Limpar filtro
          </a>
        </div>
      )}

      {alertaEstruturaMunicipios.length > 0 && (
        <GlassCard className="p-4 border-amber-500/20">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-amber-400" />
            <h3 className="text-white font-semibold text-sm">Estrutura Territorial Incompleta</h3>
            <span className="ml-auto text-xs text-amber-400/60 px-2 py-0.5 rounded-full bg-amber-500/10">
              {alertaEstruturaMunicipios.length} {alertaEstruturaMunicipios.length === 1 ? "município" : "municípios"}
            </span>
          </div>
          <p className="text-sm text-white/60 mb-3">
            Os municípios abaixo possuem assessor responsável, mas ainda não possuem coordenação operacional ativa.
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {alertaEstruturaMunicipios.map(({ cidade, assessorNome }) => (
              <span key={cidade} className="text-xs px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400/80">
                • {cidade}{assessorNome && <span className="text-white/25"> — {assessorNome}</span>}
              </span>
            ))}
          </div>
          <p className="text-xs text-white/40">
            Ação recomendada: criar ou atribuir coordenadores para estes territórios.
          </p>
        </GlassCard>
      )}

      {podeGerenciar && (
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><UserPlus size={18} className="text-purple-400" /><h3 className="text-white font-semibold">Criar Coordenador</h3></div>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isSuperOrMaster(userData) && !gabineteIdParam && (
            <Select
              label="Vincular ao gabinete"
              value={form.gabineteVinculoId}
              onChange={(e) => setForm({ ...form, gabineteVinculoId: e.target.value })}
              options={[{ value: "", label: "Selecione o gabinete..." }, ...todosGabinetes.map((g) => ({ value: g.id!, label: `${g.nome} (${g.cargo?.replace(/_/g, " ")})` }))]}
            />
          )}
          {gabineteContexto && assessoresDisponiveis.filter((a) => (a.gabineteId || a.campanhaId) === gabineteIdParam).length > 0 && (
            <Select
              label="Assessor responsável"
              value={form.assessorId}
              onChange={(e) => setForm({ ...form, assessorId: e.target.value })}
              options={[{ value: "", label: "Selecione o assessor..." }, ...assessoresDisponiveis.filter((a) => (a.gabineteId || a.campanhaId) === gabineteIdParam).map((a) => ({ value: a.uid, label: a.nome }))]}
            />
          )}
          <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do coordenador" />
          <Input label="Email" type="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setEmailManual(true); }} onFocus={() => setEmailManual(true)} placeholder="email@exemplo.com" />
          <Input label="Senha" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
          <Select label="Estado" value={form.estado} onChange={(e) => { setForm({ ...form, estado: e.target.value, cidadePrincipal: "" }); setCidadesDisponiveis(getCidades(e.target.value)); }} options={estados.map((e) => ({ value: e.sigla, label: `${e.sigla} - ${e.nome}` }))} />
          <Select label="Cidade Principal" value={form.cidadePrincipal} onChange={(e) => setForm({ ...form, cidadePrincipal: e.target.value })} options={cidadesDisponiveis.map((c) => ({ value: c, label: c }))} disabled={!form.estado} />
          <Input label="Região" value={form.regiao} onChange={(e) => setForm({ ...form, regiao: e.target.value })} placeholder="Ex: Zona Sul" />
          <div className="flex items-end"><Button type="submit" loading={saving}><UserPlus size={18} />{saving ? "Criando..." : "Criar Coordenador"}</Button></div>
        </form>
      </GlassCard>
      )}

      <BuscaOperacional
        pagina="coordenadores"
        userData={userData}
        assessores={assessoresDisponiveis}
        coordenadores={coordenadores}
        gabinetes={todosGabinetes}
        onFilter={setFiltros}
      />
      {/* Modal pequeno ESTABILIZAÇÃO */}
      {modalEstabCoord && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setModalEstabCoord(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <span className="text-sm shrink-0">⚡</span>
              <div>
                <p className="text-xs font-bold text-violet-400 tracking-wider">ESTABILIZAÇÃO</p>
                <p className="text-[11px] text-white/40">A criação real das coordenações será habilitada após a homologação final.</p>
              </div>
            </div>
            <button onClick={() => setModalEstabCoord(false)} className="w-full py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-semibold hover:bg-white/10 transition-colors">
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* Modal grande — pré-formulário Criar Coordenação */}
      {modalCriarCoord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setModalCriarCoord(false)}>
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 w-full max-w-2xl space-y-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

            {/* Badge */}
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <span className="text-sm shrink-0">⚡</span>
              <div>
                <p className="text-xs font-bold text-violet-400 tracking-wider">COORDENAÇÃO TERRITORIAL</p>
                <p className="text-[11px] text-white/40">Os dados serão salvos no Firestore em tempo real.</p>
              </div>
            </div>

            {/* Coordenador Responsável */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Coordenador Responsável</p>
              <Input
                placeholder="Nome do coordenador"
                value={formCoord.nomeCoord}
                onChange={(e) => setFormCoord({ nomeCoord: e.target.value })}
              />
            </div>

            {/* Município + Assessor + Situação */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-white/3 border border-white/6 space-y-0.5">
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Município</p>
                <p className="text-sm font-semibold text-white/70">{cidadeParam ?? "—"}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/3 border border-white/6 space-y-0.5">
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Assessor</p>
                <p className="text-sm font-semibold text-white/70">{assessorParam || "—"}</p>
              </div>
              <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-[10px] font-bold text-red-400 tracking-wider">SEM</p>
                <p className="text-[10px] font-bold text-red-400 tracking-wider">ESTRUTURA</p>
              </div>
            </div>

            {/* Meta Inicial */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Meta Inicial</p>
              <div className="grid grid-cols-4 gap-2">
                {([10, 25, 50, 100] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setMetaInicialCoord(v)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors ${
                    v === metaInicialCoord ? "bg-orange-500/10 border-orange-500/30" : "bg-white/[0.02] border-white/[0.06] hover:border-white/20"
                  }`}>
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      v === metaInicialCoord ? "border-orange-500" : "border-white/20"
                    }`}>
                      {v === metaInicialCoord && <div className="w-2 h-2 rounded-full bg-orange-500" />}
                    </div>
                    <span className={`text-sm font-medium ${v === metaInicialCoord ? "text-orange-400" : "text-white/30"}`}>{v}</span>
                  </button>
                ))}
              </div>
            </div>


            {/* Cronograma */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Cronograma</p>
              <div className="space-y-0">
                {[
                  { label: "Hoje",                    color: "text-white/60",    dot: "bg-white/30"       },
                  { label: "Designar Coordenador",    color: "text-blue-400",    dot: "bg-blue-500"       },
                  { label: "Criar Núcleo",            color: "text-amber-400",   dot: "bg-amber-500"      },
                  { label: "Primeiros 25 apoiadores", color: "text-orange-400",  dot: "bg-orange-500"     },
                  { label: "Estrutura Ativa",         color: "text-emerald-400", dot: "bg-emerald-500"    },
                ].map(({ label, color, dot }, idx, arr) => (
                  <div key={label} className="flex items-start gap-2">
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${dot}`} />
                      {idx < arr.length - 1 && <div className="w-px h-5 bg-white/8 my-0.5" />}
                    </div>
                    <p className={`text-sm mt-0 ${color}`}>{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Rodapé */}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setModalCriarCoord(false)} className="px-5 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-colors">
                Cancelar
              </button>
              <button
                onClick={salvarCoordenacao}
                disabled={salvandoCoord}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {salvandoCoord ? "Salvando…" : "Confirmar Coordenação"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner contextual — vindo da Central de Pendências */}
      {acaoParam === "nova" && cidadeParam && (
        <div className="bg-orange-950/40 border border-orange-500/30 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <span className="text-base shrink-0 mt-0.5">🟠</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{cidadeParam} ainda não possui coordenação territorial.</p>
                <p className="text-xs text-white/40 mt-0.5">Recomendação estratégica da Central de Pendências.</p>
              </div>
            </div>
            <button
              onClick={() => setModalCriarCoord(true)}
              className="shrink-0 px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors"
            >
              Criar Coordenação
            </button>
          </div>
        </div>
      )}

      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-blue-400" />
            <h3 className="text-white font-semibold">Coordenadores Ativos <span className="ml-2 text-sm font-normal text-white/40">({coordenadoresFiltrados.length})</span></h3>
            {filtros.assessorId && assessorMap[filtros.assessorId] && (
              <p className="text-xs text-purple-400/60 mt-0.5">Equipe de <span className="text-purple-400">{assessorMap[filtros.assessorId]}</span></p>
            )}
          </div>
          {filtroAtivo && (
            <button onClick={() => router.push("/coordenadores")} className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 transition-all">
              <Filter size={12} />
              Filtrando: sem colaboradores
              <X size={12} className="ml-1" />
            </button>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><svg className="animate-spin h-6 w-6 text-purple-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {coordenadoresFiltrados
              .filter((c) => !filtroAtivo || (colaboradoresCount[c.uid] || 0) === 0)
              .map((c) => {
                const qtdColab = colaboradoresCount[c.uid] || 0;
                return (
              <div key={c.uid} className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06] space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold shrink-0">{c.nome.charAt(0)}</div>
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">{c.nome}</p>
                      <div className="flex items-center gap-1"><Mail size={12} className="text-white/30 shrink-0" /><p className="text-xs text-white/40 truncate">{c.email}</p></div>
                      {(c.cidadePrincipal || c.cidade) && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin size={11} className="text-white/20 shrink-0" />
                          <p className="text-[11px] text-white/35 truncate">
                            {(c.bairro || c.regiao) ? `${c.bairro || c.regiao} · ` : ""}{c.cidadePrincipal || c.cidade}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {podeGerenciar && <button onClick={() => openEdit(c)} className="text-white/30 hover:text-blue-400 transition-colors" title="Editar"><Pencil size={14} /></button>}
                    {podeGerenciar && userData?.uid !== c.uid && (
                      <button onClick={() => setExcluirModal(c)} className="text-white/30 hover:text-red-400 transition-colors" title="Excluir"><Trash2 size={14} /></button>
                    )}
                    {!c.ativo ? (
                      <Badge variant="default">Inativo</Badge>
                    ) : qtdColab >= 2 ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">🟢 Operacional</span>
                    ) : qtdColab === 1 ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 whitespace-nowrap">🟡 Estrutura Mínima</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 whitespace-nowrap">🔴 Sem Equipe</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/50"><MapPin size={12} />{(c.bairro || c.regiao) ? `${c.bairro || c.regiao} · ` : ""}{c.cidadePrincipal || c.cidade || "N/I"}</div>
                <div className="flex items-center gap-2 text-xs">
                  <Users size={12} className="text-white/30" />
                  <span className={qtdColab === 0 ? "text-amber-400/70" : "text-white/50"}>{qtdColab} colaborador{qtdColab !== 1 ? "es" : ""}</span>
                </div>
                {c.assessorId && assessorMap[c.assessorId] && (
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Shield size={12} className="text-purple-400/50" />
                    <span>Assessor: <span className="text-purple-300/70">{assessorMap[c.assessorId]}</span></span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">Criado em: {formatDate(c.criadoEm)}</span>
                  {podeGerenciar && userData?.uid !== c.uid && (
                    <button onClick={() => handleToggleStatus(c.uid, c.ativo)} className={`${c.ativo ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"} transition-colors`}>
                      {c.ativo ? "Desativar" : "Ativar"}
                    </button>
                  )}
                </div>
              </div>
                );
              })}
            {coordenadoresFiltrados.length === 0 && (
              <div className="col-span-full text-center py-10">
                <p className="text-white/40 font-medium text-sm">
                  {(filtros.texto || filtros.assessorId || filtros.coordenadorId || filtros.colaboradorId || filtros.gabineteId)
                    ? "Nenhum resultado para os filtros aplicados"
                    : "Nenhum coordenador cadastrado"}
                </p>
                <p className="text-white/25 text-xs mt-1">
                  {(filtros.texto || filtros.assessorId || filtros.coordenadorId || filtros.colaboradorId || filtros.gabineteId)
                    ? "Tente ajustar ou limpar os filtros."
                    : "Cadastre coordenadores para organizar as equipes."}
                </p>
              </div>
            )}
            {filtroAtivo && coordenadoresFiltrados.filter((c) => (colaboradoresCount[c.uid] || 0) === 0).length === 0 && (
              <p className="col-span-full text-center text-emerald-400/70 py-8">Todos os coordenadores possuem colaboradores vinculados 🎉</p>
            )}
          </div>
        )}
      </GlassCard>
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Editar Coordenador">
        <div className="space-y-4">
          <Input label="Nome" value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
          <Input label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <Select label="Estado" value={editForm.estado} onChange={(e) => { setEditForm({ ...editForm, estado: e.target.value, cidadePrincipal: "" }); setCidadesEditDisponiveis(getCidades(e.target.value)); }} options={estados.map((e) => ({ value: e.sigla, label: `${e.sigla} - ${e.nome}` }))} />
          <Select label="Cidade Principal" value={editForm.cidadePrincipal} onChange={(e) => setEditForm({ ...editForm, cidadePrincipal: e.target.value })} options={cidadesEditDisponiveis.map((c) => ({ value: c, label: c }))} disabled={!editForm.estado} />
          <Input label="Região" value={editForm.regiao} onChange={(e) => setEditForm({ ...editForm, regiao: e.target.value })} />
          <div className="flex gap-3 pt-2">
            <Button onClick={handleEdit} className="flex-1">Salvar</Button>
            <Button variant="ghost" onClick={() => setEditModal(null)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* EXCLUIR COORDENADOR */}
      <Modal open={!!excluirModal} onClose={() => setExcluirModal(null)} title="Excluir Coordenador">
        <div className="space-y-4">
          <p className="text-white/60 text-sm">
            Tem certeza que deseja excluir <strong className="text-white">{excluirModal?.nome}</strong>?
          </p>
          <p className="text-amber-400/70 text-xs">
            Coordenadores com colaboradores vinculados não podem ser excluídos. Transfira ou remova os colaboradores primeiro.
          </p>
          <p className="text-red-400/70 text-xs">Esta ação remove o usuário do Firestore. Não é reversível.</p>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleExcluir} loading={excluirSaving} className="flex-1 bg-red-500/20 text-red-400 hover:bg-red-500/30">Excluir</Button>
            <Button variant="ghost" onClick={() => setExcluirModal(null)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

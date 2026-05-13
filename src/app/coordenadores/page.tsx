"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy, where, doc, setDoc, updateDoc, getDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { AppUser, UserRole, ROLE_CONFIG, Gabinete } from "@/types";
import { getRoleConfig, isSuperOrMaster, isAssessor, isPolitico, canViewCoordenadores, canManageUsers } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { BuscaGlobal } from "@/components/ui/BuscaGlobal";
import { BuscaOperacional, FiltrosOperacionais } from "@/components/ui/BuscaOperacional";
import { Target, UserPlus, Shield, Mail, MapPin, Pencil, Power, Users, Filter, X, Building2, ChevronRight, Trash2, Search } from "lucide-react";
import toast from "react-hot-toast";
import { formatDate, sugerirEmail } from "@/lib/utils";
import { registrarAtividade } from "@/lib/firestore";
import { estados, cidades } from "@/lib/estados-cidades";
import { Modal } from "@/components/ui/Modal";


export default function CoordenadoresPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filtroAtivo = searchParams.get("filtro") === "sem-colaboradores";
  const gabineteIdParam = searchParams.get("gabineteId");
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

  useEffect(() => {
    if (userData && !canViewCoordenadores(userData)) { router.push("/dashboard"); return; }
    loadCoordenadores();
  }, [userData]);

  useEffect(() => {
    if (form.nome && !emailManual) {
      const sugestao = sugerirEmail(form.nome, "coordenador");
      if (sugestao) setForm((f) => ({ ...f, email: sugestao }));
    }
  }, [form.nome]);

  async function loadCoordenadores() {
    try {
      if (isSuperOrMaster(userData)) {
        const gSnap = await getDocs(collection(db, "campanhas"));
        setTodosGabinetes(gSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Gabinete)));
        if (gabineteIdParam) {
          const gDoc = await getDoc(doc(db, "campanhas", gabineteIdParam));
          if (gDoc.exists()) {
            const g = gDoc.data() as Gabinete;
            setGabineteContexto({ id: gabineteIdParam, nome: g.nome, cargo: g.cargo?.replace(/_/g, " ") });
          }
          const aSnap = await getDocs(query(collection(db, "usuarios"), where("role", "==", "assessor"), where("campanhaId", "==", gabineteIdParam)));
          setAssessoresDisponiveis(aSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
        }
      }
      const constraints: any[] = [where("role", "==", "coordenador")];
      if (!isSuperOrMaster(userData) && userData?.campanhaId) constraints.push(where("campanhaId", "==", userData.campanhaId));
      constraints.push(orderBy("criadoEm", "desc"));
      const q = query(collection(db, "usuarios"), ...constraints);
      const snap = await getDocs(q);
      const coords = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser));
      setCoordenadores(coords);
      const colabSnap = await getDocs(query(collection(db, "usuarios"), where("role", "==", "colaborador")));
      const count: Record<string, number> = {};
      colabSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.coordenadorId) count[data.coordenadorId] = (count[data.coordenadorId] || 0) + 1;
      });
      setColaboradoresCount(count);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password || !form.nome) { toast.error("Preencha todos os campos"); return; }
    if (isSuperOrMaster(userData) && !gabineteIdParam && !form.gabineteVinculoId) { toast.error("Selecione o gabinete para vincular o coordenador"); return; }
    if (gabineteIdParam && isSuperOrMaster(userData) && !form.assessorId) { toast.error("Selecione o assessor responsável"); return; }
    setSaving(true);
    try {
      const campanhaId = gabineteIdParam || form.gabineteVinculoId || userData?.gabineteId || userData?.campanhaId || "";
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        email: form.email, nome: form.nome, role: "coordenador", estado: form.estado, cidadePrincipal: form.cidadePrincipal, regiao: form.regiao,
        campanhaId, gabineteId: campanhaId, criadoEm: new Date(), ativo: true, criadoPor: userData?.uid,
      });
      await registrarAtividade({ acao: "criar_coordenador", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Criou coordenador ${form.nome}` });
      toast.success("Coordenador criado!");
      setForm({ email: "", password: "", nome: "", estado: "", cidadePrincipal: "", regiao: "", assessorId: "", gabineteVinculoId: "" });
      setEmailManual(false);
      setCidadesDisponiveis([]);
      loadCoordenadores();
    } catch (error: any) { toast.error(error.code === "auth/email-already-in-use" ? "Email já está em uso" : "Erro ao criar"); } finally { setSaving(false); }
  }

  async function handleToggleStatus(uid: string, ativo: boolean) {
    try { await updateDoc(doc(db, "usuarios", uid), { ativo: !ativo }); toast.success(`Coordenador ${ativo ? "desativado" : "ativado"}`); loadCoordenadores(); } catch (e) { toast.error("Erro"); }
  }

  function openEdit(c: AppUser) {
    setEditForm({ nome: c.nome, email: c.email, estado: c.estado || "", cidadePrincipal: c.cidadePrincipal || "", regiao: c.regiao || "" });
    setCidadesEditDisponiveis(c.estado ? (cidades[c.estado] || []) : []);
    setEditModal(c);
  }

  async function handleEdit() {
    if (!editModal) return;
    try {
      await updateDoc(doc(db, "usuarios", editModal.uid), { nome: editForm.nome, email: editForm.email, estado: editForm.estado, cidadePrincipal: editForm.cidadePrincipal, regiao: editForm.regiao });
      await registrarAtividade({ acao: "editou_coordenador", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Editou coordenador ${editModal.nome}` });
      toast.success("Coordenador atualizado!"); setEditModal(null); loadCoordenadores();
    } catch (e) { toast.error("Erro ao atualizar"); }
  }

  async function handleExcluir() {
    if (!excluirModal) return;
    setExcluirSaving(true);
    try {
      await fetch(`/api/auth/delete?uid=${excluirModal.uid}`, { method: "DELETE" });
      await registrarAtividade({ acao: "excluiu_coordenador", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Excluiu coordenador ${excluirModal.nome}` });
      toast.success("Coordenador excluído!");
      setExcluirModal(null);
      loadCoordenadores();
    } catch (e) { toast.error("Erro ao excluir"); } finally { setExcluirSaving(false); }
  }

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
    return lista;
  }, [coordenadores, filtros]);

  if (!userData || !canViewCoordenadores(userData)) return null;
  const podeGerenciar = isSuperOrMaster(userData) || isAssessor(userData);
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
          <h1 className="text-2xl font-bold text-white">{gabineteContexto ? `Coordenadores — ${gabineteContexto.nome}` : "Coordenadores"}</h1>
          <p className="text-sm text-purple-400">{gabineteContexto ? `Vincule coordenadores ao gabinete ${gabineteContexto.nome}` : "Gerencie os coordenadores da campanha"}</p>
        </div>
        <BuscaGlobal userData={userData} />
      </div>

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
          {gabineteContexto && assessoresDisponiveis.length > 0 && (
            <Select
              label="Assessor responsável"
              value={form.assessorId}
              onChange={(e) => setForm({ ...form, assessorId: e.target.value })}
              options={[{ value: "", label: "Selecione o assessor..." }, ...assessoresDisponiveis.map((a) => ({ value: a.uid, label: a.nome }))]}
            />
          )}
          <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do coordenador" />
          <Input label="Email" type="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setEmailManual(true); }} onFocus={() => setEmailManual(true)} placeholder="email@exemplo.com" />
          <Input label="Senha" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
          <Select label="Estado" value={form.estado} onChange={(e) => { setForm({ ...form, estado: e.target.value, cidadePrincipal: "" }); setCidadesDisponiveis(cidades[e.target.value] || []); }} options={estados.map((e) => ({ value: e.sigla, label: `${e.sigla} - ${e.nome}` }))} />
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
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-blue-400" />
            <h3 className="text-white font-semibold">Coordenadores Ativos <span className="ml-2 text-sm font-normal text-white/40">({coordenadoresFiltrados.length})</span></h3>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coordenadoresFiltrados
              .filter((c) => !filtroAtivo || (colaboradoresCount[c.uid] || 0) === 0)
              .map((c) => {
                const qtdColab = colaboradoresCount[c.uid] || 0;
                return (
              <div key={c.uid} className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold">{c.nome.charAt(0)}</div>
                    <div>
                      <p className="text-white font-medium text-sm">{c.nome}</p>
                      <div className="flex items-center gap-1"><Mail size={12} className="text-white/30" /><p className="text-xs text-white/40">{c.email}</p></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {podeGerenciar && <button onClick={() => openEdit(c)} className="text-white/30 hover:text-blue-400 transition-colors" title="Editar"><Pencil size={14} /></button>}
                    {podeGerenciar && userData?.uid !== c.uid && (
                      <button onClick={() => setExcluirModal(c)} className="text-white/30 hover:text-red-400 transition-colors" title="Excluir"><Trash2 size={14} /></button>
                    )}
                    <Badge variant={c.ativo ? "success" : "default"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/50"><MapPin size={12} />{c.cidadePrincipal || "N/I"} {c.regiao ? `• ${c.regiao}` : ""}</div>
                <div className="flex items-center gap-2 text-xs">
                  <Users size={12} className="text-white/30" />
                  <span className={qtdColab === 0 ? "text-amber-400/70" : "text-white/50"}>{qtdColab} colaborador{qtdColab !== 1 ? "es" : ""}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">Criado em: {formatDate(c.criadoEm)}</span>
                  {userData?.uid !== c.uid && (
                    <button onClick={() => handleToggleStatus(c.uid, c.ativo)} className={`${c.ativo ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"} transition-colors`}>
                      {c.ativo ? "Desativar" : "Ativar"}
                    </button>
                  )}
                </div>
              </div>
                );
              })}
            {coordenadoresFiltrados.length === 0 && <p className="col-span-full text-center text-white/30 py-8">{filtros.texto ? "Nenhum coordenador encontrado" : "Nenhum coordenador cadastrado"}</p>}
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
          <Select label="Estado" value={editForm.estado} onChange={(e) => { setEditForm({ ...editForm, estado: e.target.value, cidadePrincipal: "" }); setCidadesEditDisponiveis(cidades[e.target.value] || []); }} options={estados.map((e) => ({ value: e.sigla, label: `${e.sigla} - ${e.nome}` }))} />
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

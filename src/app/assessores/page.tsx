"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy, where, doc, setDoc, updateDoc, getDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { AppUser, Gabinete, ROLE_CONFIG } from "@/types";
import { getRoleConfig, isSuperOrMaster, isPrefeito, isAssessor } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { BuscaGlobal } from "@/components/ui/BuscaGlobal";
import { BuscaOperacional, FiltrosOperacionais } from "@/components/ui/BuscaOperacional";
import { Shield, UserPlus, Mail, Pencil, Power, Building2, Trash2, Search } from "lucide-react";
import toast from "react-hot-toast";
import { formatDate, sugerirEmail } from "@/lib/utils";
import { registrarAtividade } from "@/lib/firestore";
import { Modal } from "@/components/ui/Modal";


export default function AssessoresPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [assessores, setAssessores] = useState<AppUser[]>([]);
  const [form, setForm] = useState({ email: "", password: "", nome: "", gabineteVinculoId: "" });
  const [emailManual, setEmailManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", email: "" });
  const [excluirModal, setExcluirModal] = useState<AppUser | null>(null);
  const [excluirSaving, setExcluirSaving] = useState(false);
  const [todosGabinetes, setTodosGabinetes] = useState<Gabinete[]>([]);
  const [filtros, setFiltros] = useState<FiltrosOperacionais>({ texto: "" });

  const [gabinetesMap, setGabinetesMap] = useState<Record<string, { nome: string; politicoNome: string; cargo: string }>>({});
  const podeAcessar = isSuperOrMaster(userData) || isPrefeito(userData) || isAssessor(userData);

  useEffect(() => {
    if (userData && !podeAcessar) { router.push("/dashboard"); return; }
    loadAssessores();
  }, [userData]);

  useEffect(() => {
    if (form.nome && !emailManual) {
      const sugestao = sugerirEmail(form.nome, "assessor");
      if (sugestao) setForm((f) => ({ ...f, email: sugestao }));
    }
  }, [form.nome]);

  async function loadGabinetesMap() {
    try {
      const snap = await getDocs(query(collection(db, "campanhas"), orderBy("criadoEm", "desc")));
      const map: Record<string, { nome: string; politicoNome: string; cargo: string }> = {};
      snap.docs.forEach((d) => {
        const g = d.data() as Gabinete;
        if (d.id) map[d.id] = { nome: g.nome, politicoNome: g.politicoNome, cargo: g.cargo?.replace(/_/g, " ") };
      });
      setGabinetesMap(map);
    } catch (e) { console.error(e); }
  }

  async function loadAssessores() {
    try {
      const constraints: any[] = [where("role", "==", "assessor")];
      if (!isSuperOrMaster(userData) && userData?.gabineteId) {
        constraints.push(where("gabineteId", "==", userData.gabineteId));
      } else if (!isSuperOrMaster(userData) && userData?.campanhaId) {
        constraints.push(where("campanhaId", "==", userData.campanhaId));
      }
      constraints.push(orderBy("criadoEm", "desc"));
      const q = query(collection(db, "usuarios"), ...constraints);
      const snap = await getDocs(q);
      setAssessores(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
      if (isSuperOrMaster(userData)) {
        await loadGabinetesMap();
        const gSnap = await getDocs(collection(db, "campanhas"));
        setTodosGabinetes(gSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Gabinete)));
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password || !form.nome) { toast.error("Preencha todos os campos"); return; }
    if (isSuperOrMaster(userData) && !form.gabineteVinculoId) { toast.error("Selecione o gabinete para vincular o assessor"); return; }
    setSaving(true);
    try {
      const gabineteId = isSuperOrMaster(userData) ? form.gabineteVinculoId : (userData?.gabineteId || userData?.campanhaId || "");
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        email: form.email, nome: form.nome, role: "assessor",
        gabineteId, campanhaId: gabineteId,
        criadoEm: new Date(), ativo: true, criadoPor: userData?.uid,
      });
      await registrarAtividade({ acao: "criar_assessor", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Criou assessor ${form.nome}` });
      toast.success("Assessor criado!");
      setForm({ email: "", password: "", nome: "", gabineteVinculoId: "" });
      setEmailManual(false);
      loadAssessores();
    } catch (error: any) { toast.error(error.code === "auth/email-already-in-use" ? "Email já está em uso" : "Erro ao criar"); } finally { setSaving(false); }
  }

  async function handleToggleStatus(uid: string, ativo: boolean) {
    try { await updateDoc(doc(db, "usuarios", uid), { ativo: !ativo }); toast.success(`Assessor ${ativo ? "desativado" : "ativado"}`); loadAssessores(); } catch (e) { toast.error("Erro"); }
  }

  function openEdit(c: AppUser) {
    setEditForm({ nome: c.nome, email: c.email });
    setEditModal(c);
  }

  async function handleEdit() {
    if (!editModal) return;
    try {
      await updateDoc(doc(db, "usuarios", editModal.uid), { nome: editForm.nome, email: editForm.email });
      await registrarAtividade({ acao: "editou_assessor", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Editou assessor ${editModal.nome}` });
      toast.success("Assessor atualizado!"); setEditModal(null); loadAssessores();
    } catch (e) { toast.error("Erro ao atualizar"); }
  }

  async function handleExcluir() {
    if (!excluirModal) return;
    setExcluirSaving(true);
    try {
      await fetch(`/api/auth/delete?uid=${excluirModal.uid}`, { method: "DELETE" });
      await registrarAtividade({ acao: "excluiu_assessor", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Excluiu assessor ${excluirModal.nome}` });
      toast.success("Assessor excluído!");
      setExcluirModal(null);
      loadAssessores();
    } catch (e) { toast.error("Erro ao excluir"); } finally { setExcluirSaving(false); }
  }

  const assessoresFiltrados = useMemo(() => {
    let lista = assessores;
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
  }, [assessores, filtros]);

  if (!userData || !podeAcessar) return null;
  const config = getRoleConfig(userData);

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-lg`}>🏛️</div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Assessores Parlamentares</h1>
          <p className="text-sm text-purple-400">Gerencie a equipe de assessores do gabinete</p>
        </div>
        <BuscaGlobal userData={userData} />
      </div>

      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><UserPlus size={18} className="text-purple-400" /><h3 className="text-white font-semibold">Criar Assessor</h3></div>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isSuperOrMaster(userData) && (
            <Select
              label="Vincular ao gabinete"
              value={form.gabineteVinculoId}
              onChange={(e) => setForm({ ...form, gabineteVinculoId: e.target.value })}
              options={[{ value: "", label: "Selecione o gabinete..." }, ...todosGabinetes.map((g) => ({ value: g.id!, label: `${g.nome} (${g.cargo?.replace(/_/g, " ")})` }))]}
            />
          )}
          <Input label="Nome" value={form.nome} onChange={(e) => { setForm({ ...form, nome: e.target.value }); }} placeholder="Nome do assessor" />
          <Input label="Email" type="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setEmailManual(true); }} onFocus={() => setEmailManual(true)} placeholder="email@exemplo.com" />
          <Input label="Senha" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
          <div className="flex items-end"><Button type="submit" loading={saving}><UserPlus size={18} />{saving ? "Criando..." : "Criar Assessor"}</Button></div>
        </form>
      </GlassCard>

      <BuscaOperacional
        pagina="assessores"
        userData={userData}
        assessores={assessores}
        gabinetes={todosGabinetes}
        onFilter={setFiltros}
      />
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><Shield size={18} className="text-purple-400" /><h3 className="text-white font-semibold">Assessores do Gabinete <span className="ml-2 text-sm font-normal text-white/40">({assessoresFiltrados.length})</span></h3></div>
        {loading ? (
          <div className="flex justify-center py-8"><svg className="animate-spin h-6 w-6 text-purple-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assessoresFiltrados.map((c) => (
              <div key={c.uid} className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold">{c.nome.charAt(0)}</div>
                    <div>
                      <p className="text-white font-medium text-sm">{c.nome}</p>
                      <div className="flex items-center gap-1"><Mail size={12} className="text-white/30" /><p className="text-xs text-white/40">{c.email}</p></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(c)} className="text-white/30 hover:text-purple-400 transition-colors" title="Editar"><Pencil size={14} /></button>
                    {isSuperOrMaster(userData) && userData?.uid !== c.uid && (
                      <button onClick={() => setExcluirModal(c)} className="text-white/30 hover:text-red-400 transition-colors" title="Excluir"><Trash2 size={14} /></button>
                    )}
                    <Badge variant={c.ativo ? "success" : "default"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                  </div>
                </div>
                {isSuperOrMaster(userData) && c.gabineteId && gabinetesMap[c.gabineteId] && (
                  <div className="flex items-center gap-1.5 text-xs text-white/50">
                    <Building2 size={12} className="shrink-0 text-white/30" />
                    <span>Gabinete: <span className="text-white/70">{gabinetesMap[c.gabineteId].nome}</span></span>
                    <span className="text-white/20">·</span>
                    <span className="text-white/40">{gabinetesMap[c.gabineteId].cargo}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-white/30">Criado em: {formatDate(c.criadoEm)}</span>
                  {userData?.uid !== c.uid && (
                    <button onClick={() => handleToggleStatus(c.uid, c.ativo)} className={`${c.ativo ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"} transition-colors`}>
                      {c.ativo ? "Desativar" : "Ativar"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {assessoresFiltrados.length === 0 && <p className="col-span-full text-center text-white/30 py-8">{filtros.texto ? "Nenhum assessor encontrado" : "Nenhum assessor cadastrado neste gabinete"}</p>}
          </div>
        )}
      </GlassCard>
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Editar Assessor">
        <div className="space-y-4">
          <Input label="Nome" value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
          <Input label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <div className="flex gap-3 pt-2">
            <Button onClick={handleEdit} className="flex-1">Salvar</Button>
            <Button variant="ghost" onClick={() => setEditModal(null)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* EXCLUIR ASSESSOR */}
      <Modal open={!!excluirModal} onClose={() => setExcluirModal(null)} title="Excluir Assessor">
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

"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { createAuthUser, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { AppUser, ROLE_CONFIG } from "@/types";
import { getRoleConfig, isSuperOrMaster } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Shield, UserPlus, Mail, Pencil, Power, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { formatDate } from "@/lib/utils";
import { registrarAtividade } from "@/lib/firestore";
import { Modal } from "@/components/ui/Modal";

export default function AdminsPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [admins, setAdmins] = useState<AppUser[]>([]);
  const [form, setForm] = useState({ email: "", password: "", nome: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", email: "" });
  const [excluirModal, setExcluirModal] = useState<AppUser | null>(null);
  const [excluirSaving, setExcluirSaving] = useState(false);

  useEffect(() => {
    if (userData && !isSuperOrMaster(userData)) { router.push("/dashboard"); return; }
    loadAdmins();
  }, [userData]);

  async function loadAdmins() {
    try {
      const constraints: any[] = [where("role", "==", "admin_master")];
      constraints.push(orderBy("criadoEm", "desc"));
      const q = query(collection(db, "usuarios"), ...constraints);
      const snap = await getDocs(q);
      setAdmins(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password || !form.nome) { toast.error("Preencha todos os campos"); return; }
    setSaving(true);
    try {
      await createAuthUser(form.email, form.password, {
        email: form.email, nome: form.nome, role: "admin_master",
        campanhaId: "", criadoEm: new Date(), ativo: true, criadoPor: userData?.uid,
      });
      await registrarAtividade({ acao: "criar_admin_master", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Criou admin master ${form.nome}` });
      toast.success("Admin Master criado!");
      setForm({ email: "", password: "", nome: "" });
      loadAdmins();
    } catch (error: any) { toast.error(error.code === "auth/email-already-in-use" ? "Email já está em uso" : "Erro ao criar"); } finally { setSaving(false); }
  }

  async function handleToggleStatus(uid: string, ativo: boolean) {
    try { await updateDoc(doc(db, "usuarios", uid), { ativo: !ativo }); toast.success(`Admin Master ${ativo ? "desativado" : "ativado"}`); loadAdmins(); } catch (e) { toast.error("Erro"); }
  }

  function openEdit(c: AppUser) {
    setEditForm({ nome: c.nome, email: c.email });
    setEditModal(c);
  }

  async function handleEdit() {
    if (!editModal) return;
    try {
      await updateDoc(doc(db, "usuarios", editModal.uid), { nome: editForm.nome, email: editForm.email });
      await registrarAtividade({ acao: "editou_admin_master", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Editou admin master ${editModal.nome}` });
      toast.success("Admin Master atualizado!"); setEditModal(null); loadAdmins();
    } catch (e) { toast.error("Erro ao atualizar"); }
  }

  async function handleExcluir() {
    if (!excluirModal) return;
    setExcluirSaving(true);
    try {
      await deleteDoc(doc(db, "usuarios", excluirModal.uid));
      await registrarAtividade({ acao: "excluiu_admin_master", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Excluiu admin master ${excluirModal.nome}` });
      toast.success("Admin Master excluído!");
      setExcluirModal(null);
      loadAdmins();
    } catch (e) { toast.error("Erro ao excluir"); } finally { setExcluirSaving(false); }
  }

  if (!userData || !isSuperOrMaster(userData)) return null;
  const config = getRoleConfig(userData);

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-lg`}>👑</div>
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Masters</h1>
          <p className="text-sm text-rose-400">Gerencie os administradores master da plataforma</p>
        </div>
      </div>

      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><UserPlus size={18} className="text-rose-400" /><h3 className="text-white font-semibold">Criar Admin Master</h3></div>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do admin master" />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
          <Input label="Senha" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
          <div className="flex items-end"><Button type="submit" loading={saving}><UserPlus size={18} />{saving ? "Criando..." : "Criar Admin Master"}</Button></div>
        </form>
      </GlassCard>

      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><Shield size={18} className="text-purple-400" /><h3 className="text-white font-semibold">Admin Masters</h3></div>
        {loading ? (
          <div className="flex justify-center py-8"><svg className="animate-spin h-6 w-6 text-rose-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {admins.map((c) => (
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
                    {userData?.uid !== c.uid && (
                      <button onClick={() => setExcluirModal(c)} className="text-white/30 hover:text-red-400 transition-colors" title="Excluir"><Trash2 size={14} /></button>
                    )}
                    <Badge variant={c.ativo ? "success" : "default"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                  </div>
                </div>
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
            {admins.length === 0 && <p className="col-span-full text-center text-white/30 py-8">Nenhum admin cadastrado</p>}
          </div>
        )}
      </GlassCard>
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Editar Administrador">
        <div className="space-y-4">
          <Input label="Nome" value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
          <Input label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <div className="flex gap-3 pt-2">
            <Button onClick={handleEdit} className="flex-1">Salvar</Button>
            <Button variant="ghost" onClick={() => setEditModal(null)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL EXCLUIR */}
      <Modal open={!!excluirModal} onClose={() => setExcluirModal(null)} title="Excluir Administrador">
        <div className="space-y-4">
          <p className="text-white/60 text-sm">
            Tem certeza que deseja excluir <strong className="text-white">{excluirModal?.nome}</strong>?
          </p>
          <p className="text-red-400/70 text-xs">Esta ação remove permanentemente o acesso e os dados do usuário. Não é reversível.</p>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleExcluir} loading={excluirSaving} className="flex-1 bg-red-500/20 text-red-400 hover:bg-red-500/30">Excluir</Button>
            <Button variant="ghost" onClick={() => setExcluirModal(null)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

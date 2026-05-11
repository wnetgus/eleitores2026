"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where, doc, setDoc, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { AppUser, ROLE_CONFIG } from "@/types";
import { getRoleConfig, isSuperOrMaster, isPrefeito, isAssessor } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Shield, UserPlus, Mail, Pencil, Power } from "lucide-react";
import toast from "react-hot-toast";
import { formatDate } from "@/lib/utils";
import { registrarAtividade } from "@/lib/firestore";
import { Modal } from "@/components/ui/Modal";

export default function AssessoresPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [assessores, setAssessores] = useState<AppUser[]>([]);
  const [form, setForm] = useState({ email: "", password: "", nome: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState({ nome: "" });

  const podeAcessar = isSuperOrMaster(userData) || isPrefeito(userData) || isAssessor(userData);

  useEffect(() => {
    if (userData && !podeAcessar) { router.push("/dashboard"); return; }
    loadAssessores();
  }, [userData]);

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
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password || !form.nome) { toast.error("Preencha todos os campos"); return; }
    setSaving(true);
    try {
      const gabineteId = userData?.gabineteId || userData?.campanhaId || "";
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        email: form.email, nome: form.nome, role: "assessor",
        gabineteId, campanhaId: gabineteId,
        criadoEm: new Date(), ativo: true, criadoPor: userData?.uid,
      });
      await registrarAtividade({ acao: "criar_assessor", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Criou assessor ${form.nome}` });
      toast.success("Assessor criado!");
      setForm({ email: "", password: "", nome: "" });
      loadAssessores();
    } catch (error: any) { toast.error(error.code === "auth/email-already-in-use" ? "Email já está em uso" : "Erro ao criar"); } finally { setSaving(false); }
  }

  async function handleToggleStatus(uid: string, ativo: boolean) {
    try { await updateDoc(doc(db, "usuarios", uid), { ativo: !ativo }); toast.success(`Assessor ${ativo ? "desativado" : "ativado"}`); loadAssessores(); } catch (e) { toast.error("Erro"); }
  }

  function openEdit(c: AppUser) {
    setEditForm({ nome: c.nome });
    setEditModal(c);
  }

  async function handleEdit() {
    if (!editModal) return;
    try {
      await updateDoc(doc(db, "usuarios", editModal.uid), { nome: editForm.nome });
      await registrarAtividade({ acao: "editou_assessor", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Editou assessor ${editModal.nome}` });
      toast.success("Assessor atualizado!"); setEditModal(null); loadAssessores();
    } catch (e) { toast.error("Erro ao atualizar"); }
  }

  if (!userData || !podeAcessar) return null;
  const config = getRoleConfig(userData);

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-lg`}>🏛️</div>
        <div>
          <h1 className="text-2xl font-bold text-white">Assessores Parlamentares</h1>
          <p className="text-sm text-purple-400">Gerencie a equipe de assessores do gabinete</p>
        </div>
      </div>

      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><UserPlus size={18} className="text-purple-400" /><h3 className="text-white font-semibold">Criar Assessor</h3></div>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do assessor" />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
          <Input label="Senha" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
          <div className="flex items-end"><Button type="submit" loading={saving}><UserPlus size={18} />{saving ? "Criando..." : "Criar Assessor"}</Button></div>
        </form>
      </GlassCard>

      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><Shield size={18} className="text-purple-400" /><h3 className="text-white font-semibold">Assessores do Gabinete</h3></div>
        {loading ? (
          <div className="flex justify-center py-8"><svg className="animate-spin h-6 w-6 text-purple-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assessores.map((c) => (
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
            {assessores.length === 0 && <p className="col-span-full text-center text-white/30 py-8">Nenhum assessor cadastrado neste gabinete</p>}
          </div>
        )}
      </GlassCard>
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Editar Assessor">
        <div className="space-y-4">
          <Input label="Nome" value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
          <div className="flex gap-3 pt-2">
            <Button onClick={handleEdit} className="flex-1">Salvar</Button>
            <Button variant="ghost" onClick={() => setEditModal(null)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

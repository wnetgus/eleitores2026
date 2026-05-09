"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where, addDoc, serverTimestamp, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Campanha, ROLE_CONFIG } from "@/types";
import { isSuperAdmin, getRoleConfig } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Building2, UserPlus, Globe, Plus, Power, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { formatDate } from "@/lib/utils";
import { registrarAtividade } from "@/lib/firestore";
import { Modal } from "@/components/ui/Modal";

export default function CampanhasPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: "", slug: "", politicoNome: "", politicoEmail: "", politicoSenha: "", cargo: "", slogan: "", corPrincipal: "#8b5cf6" });
  const [saving, setSaving] = useState(false);
  const [eleitorCounts, setEleitorCounts] = useState<Record<string, number>>({});
  const [editModal, setEditModal] = useState<Campanha | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", slug: "", cargo: "", slogan: "", corPrincipal: "#8b5cf6" });

  useEffect(() => {
    if (userData && !isSuperAdmin(userData)) { router.push("/dashboard"); return; }
    loadData();
  }, [userData]);

  async function loadData() {
    try {
      const q = query(collection(db, "campanhas"), orderBy("criadoEm", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Campanha));
      setCampanhas(data);
      const counts: Record<string, number> = {};
      for (const c of data) {
        const eq = query(collection(db, "eleitores"), where("campanhaId", "==", c.id));
        const esnap = await getDocs(eq);
        counts[c.id!] = esnap.size;
      }
      setEleitorCounts(counts);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.slug || !form.politicoNome || !form.politicoEmail || !form.politicoSenha || !form.cargo) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const campanhaId = await addDoc(collection(db, "campanhas"), {
        nome: form.nome, slug: form.slug, politicoNome: form.politicoNome, politicoEmail: form.politicoEmail,
        cargo: form.cargo, slogan: form.slogan, corPrincipal: form.corPrincipal,
        ativo: true, criadoEm: serverTimestamp(), criadoPor: userData?.uid,
      });

      const cred = await createUserWithEmailAndPassword(auth, form.politicoEmail, form.politicoSenha);
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        email: form.politicoEmail, nome: form.politicoNome, role: "politico",
        campanhaId: campanhaId.id, ativo: true, criadoEm: new Date(), criadoPor: userData?.uid,
      });

      await registrarAtividade({
        acao: "criar_campanha", usuarioId: userData!.uid, usuarioNome: userData!.nome,
        usuarioRole: "super_admin", detalhes: `Criou campanha ${form.nome} para ${form.politicoNome}`,
      });

      toast.success("Campanha criada com sucesso!");
      setShowForm(false);
      setForm({ nome: "", slug: "", politicoNome: "", politicoEmail: "", politicoSenha: "", cargo: "", slogan: "", corPrincipal: "#8b5cf6" });
      loadData();
    } catch (error: any) { toast.error(error.code === "auth/email-already-in-use" ? "Email já está em uso" : "Erro ao criar campanha"); } finally { setSaving(false); }
  }

  async function toggleCampanha(id: string, ativo: boolean) {
    try { await updateDoc(doc(db, "campanhas", id), { ativo: !ativo }); toast.success(`Campanha ${ativo ? "desativada" : "ativada"}`); loadData(); } catch (e) { toast.error("Erro"); }
  }

  function openEdit(c: Campanha) {
    setEditForm({ nome: c.nome, slug: c.slug, cargo: c.cargo, slogan: c.slogan || "", corPrincipal: c.corPrincipal || "#8b5cf6" });
    setEditModal(c);
  }

  async function handleEdit() {
    if (!editModal?.id) return;
    try {
      await updateDoc(doc(db, "campanhas", editModal.id), { nome: editForm.nome, slug: editForm.slug, cargo: editForm.cargo, slogan: editForm.slogan, corPrincipal: editForm.corPrincipal });
      await registrarAtividade({ acao: "editou_campanha", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: "super_admin", detalhes: `Editou campanha ${editModal.nome}` });
      toast.success("Campanha atualizada!"); setEditModal(null); loadData();
    } catch (e) { toast.error("Erro ao atualizar"); }
  }

  if (!userData || !isSuperAdmin(userData)) return null;
  const config = getRoleConfig(userData);

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-lg">🔱</div>
        <div>
          <h1 className="text-2xl font-bold text-white">Campanhas</h1>
          <p className="text-sm text-rose-400">Gerencie todas as campanhas da plataforma</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setShowForm(!showForm)}><Plus size={18} />{showForm ? "Cancelar" : "Nova Campanha"}</Button>
      </div>

      {showForm && (
        <GlassCard className="p-5">
          <h3 className="text-white font-semibold mb-4">Criar Nova Campanha</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input label="Nome da Campanha *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Eleições 2026" />
            <Input label="Slug *" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="ex: eleicoes-2026" />
            <Input label="Cargo *" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} placeholder="Ex: Vereador" />
            <Input label="Nome do Político *" value={form.politicoNome} onChange={(e) => setForm({ ...form, politicoNome: e.target.value })} placeholder="Nome do candidato" />
            <Input label="Email do Político *" type="email" value={form.politicoEmail} onChange={(e) => setForm({ ...form, politicoEmail: e.target.value })} placeholder="email@politico.com" />
            <Input label="Senha do Político *" type="password" value={form.politicoSenha} onChange={(e) => setForm({ ...form, politicoSenha: e.target.value })} placeholder="Mínimo 6 caracteres" />
            <Input label="Slogan" value={form.slogan} onChange={(e) => setForm({ ...form, slogan: e.target.value })} placeholder="Slogan da campanha" />
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Cor Principal</label>
              <input type="color" value={form.corPrincipal} onChange={(e) => setForm({ ...form, corPrincipal: e.target.value })} className="w-full h-10 bg-white/5 border border-white/10 rounded-xl cursor-pointer" />
            </div>
            <div className="md:col-span-2 lg:col-span-3"><Button type="submit" loading={saving}><UserPlus size={18} />{saving ? "Criando..." : "Criar Campanha"}</Button></div>
          </form>
        </GlassCard>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><svg className="animate-spin h-8 w-8 text-rose-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campanhas.map((c) => (
            <GlassCard key={c.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: c.corPrincipal || "#8b5cf6" }}>{c.nome.charAt(0)}</div>
                  <div>
                    <h3 className="text-white font-semibold">{c.nome}</h3>
                    <p className="text-xs text-white/40">{c.cargo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(c)} className="text-white/30 hover:text-amber-400 transition-colors" title="Editar"><Pencil size={14} /></button>
                  <Badge variant={c.ativo ? "success" : "default"}>{c.ativo ? "Ativa" : "Inativa"}</Badge>
                </div>
              </div>
              <div className="text-sm text-white/60 mb-3">
                <p>🎯 {c.politicoNome}</p>
                <p>📧 {c.politicoEmail}</p>
                {c.slogan && <p className="text-white/40 text-xs mt-1 italic">"{c.slogan}"</p>}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                <span className="text-sm text-white/50"><Globe size={14} className="inline mr-1" />{eleitorCounts[c.id!] || 0} eleitores</span>
                <button onClick={() => toggleCampanha(c.id!, c.ativo)} className={`text-xs ${c.ativo ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"} transition-colors`}>
                  <Power size={14} className="inline mr-1" />{c.ativo ? "Desativar" : "Ativar"}
                </button>
              </div>
            </GlassCard>
          ))}
          {campanhas.length === 0 && <p className="col-span-full text-center text-white/30 py-12">Nenhuma campanha cadastrada</p>}
        </div>
      )}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Editar Campanha">
        <div className="space-y-4">
          <Input label="Nome da Campanha" value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
          <Input label="Slug" value={editForm.slug} onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })} />
          <Input label="Cargo" value={editForm.cargo} onChange={(e) => setEditForm({ ...editForm, cargo: e.target.value })} />
          <Input label="Slogan" value={editForm.slogan} onChange={(e) => setEditForm({ ...editForm, slogan: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Cor Principal</label>
            <input type="color" value={editForm.corPrincipal} onChange={(e) => setEditForm({ ...editForm, corPrincipal: e.target.value })} className="w-full h-10 bg-white/5 border border-white/10 rounded-xl cursor-pointer" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleEdit} className="flex-1">Salvar Alterações</Button>
            <Button variant="ghost" onClick={() => setEditModal(null)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

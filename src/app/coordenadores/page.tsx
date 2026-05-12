"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where, doc, setDoc, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { AppUser, UserRole, ROLE_CONFIG } from "@/types";
import { getRoleConfig, isSuperOrMaster, isAssessor } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Target, UserPlus, Shield, Mail, MapPin, Pencil, Power } from "lucide-react";
import toast from "react-hot-toast";
import { formatDate } from "@/lib/utils";
import { registrarAtividade } from "@/lib/firestore";
import { estados, cidades } from "@/lib/estados-cidades";
import { Modal } from "@/components/ui/Modal";

export default function CoordenadoresPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [coordenadores, setCoordenadores] = useState<AppUser[]>([]);
  const [form, setForm] = useState({ email: "", password: "", nome: "", estado: "", cidadePrincipal: "", regiao: "" });
  const [cidadesDisponiveis, setCidadesDisponiveis] = useState<string[]>([]);
  const [cidadesEditDisponiveis, setCidadesEditDisponiveis] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", estado: "", cidadePrincipal: "", regiao: "" });

  useEffect(() => {
    if (userData && !isSuperOrMaster(userData) && !isAssessor(userData)) { router.push("/dashboard"); return; }
    loadCoordenadores();
  }, [userData]);

  async function loadCoordenadores() {
    try {
      const constraints: any[] = [where("role", "==", "coordenador")];
      if (!isSuperOrMaster(userData) && userData?.campanhaId) constraints.push(where("campanhaId", "==", userData.campanhaId));
      constraints.push(orderBy("criadoEm", "desc"));
      const q = query(collection(db, "usuarios"), ...constraints);
      const snap = await getDocs(q);
      setCoordenadores(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password || !form.nome) { toast.error("Preencha todos os campos"); return; }
    setSaving(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        email: form.email, nome: form.nome, role: "coordenador", estado: form.estado, cidadePrincipal: form.cidadePrincipal, regiao: form.regiao,
        campanhaId: userData?.gabineteId || userData?.campanhaId || "", gabineteId: userData?.gabineteId || userData?.campanhaId || "", criadoEm: new Date(), ativo: true, criadoPor: userData?.uid,
      });
      await registrarAtividade({ acao: "criar_coordenador", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Criou coordenador ${form.nome}` });
      toast.success("Coordenador criado!");
      setForm({ email: "", password: "", nome: "", estado: "", cidadePrincipal: "", regiao: "" });
      setCidadesDisponiveis([]);
      loadCoordenadores();
    } catch (error: any) { toast.error(error.code === "auth/email-already-in-use" ? "Email já está em uso" : "Erro ao criar"); } finally { setSaving(false); }
  }

  async function handleToggleStatus(uid: string, ativo: boolean) {
    try { await updateDoc(doc(db, "usuarios", uid), { ativo: !ativo }); toast.success(`Coordenador ${ativo ? "desativado" : "ativado"}`); loadCoordenadores(); } catch (e) { toast.error("Erro"); }
  }

  function openEdit(c: AppUser) {
    setEditForm({ nome: c.nome, estado: c.estado || "", cidadePrincipal: c.cidadePrincipal || "", regiao: c.regiao || "" });
    setCidadesEditDisponiveis(c.estado ? (cidades[c.estado] || []) : []);
    setEditModal(c);
  }

  async function handleEdit() {
    if (!editModal) return;
    try {
      await updateDoc(doc(db, "usuarios", editModal.uid), { nome: editForm.nome, estado: editForm.estado, cidadePrincipal: editForm.cidadePrincipal, regiao: editForm.regiao });
      await registrarAtividade({ acao: "editou_coordenador", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Editou coordenador ${editModal.nome}` });
      toast.success("Coordenador atualizado!"); setEditModal(null); loadCoordenadores();
    } catch (e) { toast.error("Erro ao atualizar"); }
  }

  if (!userData || (!isSuperOrMaster(userData) && !isAssessor(userData))) return null;
  const config = getRoleConfig(userData);

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-lg`}>🎯</div>
        <div>
          <h1 className="text-2xl font-bold text-white">Coordenadores</h1>
          <p className="text-sm text-purple-400">Gerencie os coordenadores da campanha</p>
        </div>
      </div>

      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><UserPlus size={18} className="text-purple-400" /><h3 className="text-white font-semibold">Criar Coordenador</h3></div>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do coordenador" />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
          <Input label="Senha" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
          <Select label="Estado" value={form.estado} onChange={(e) => { setForm({ ...form, estado: e.target.value, cidadePrincipal: "" }); setCidadesDisponiveis(cidades[e.target.value] || []); }} options={estados.map((e) => ({ value: e.sigla, label: `${e.sigla} - ${e.nome}` }))} />
          <Select label="Cidade Principal" value={form.cidadePrincipal} onChange={(e) => setForm({ ...form, cidadePrincipal: e.target.value })} options={cidadesDisponiveis.map((c) => ({ value: c, label: c }))} disabled={!form.estado} />
          <Input label="Região" value={form.regiao} onChange={(e) => setForm({ ...form, regiao: e.target.value })} placeholder="Ex: Zona Sul" />
          <div className="flex items-end"><Button type="submit" loading={saving}><UserPlus size={18} />{saving ? "Criando..." : "Criar Coordenador"}</Button></div>
        </form>
      </GlassCard>

      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><Target size={18} className="text-blue-400" /><h3 className="text-white font-semibold">Coordenadores Ativos</h3></div>
        {loading ? (
          <div className="flex justify-center py-8"><svg className="animate-spin h-6 w-6 text-purple-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coordenadores.map((c) => (
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
                    <button onClick={() => openEdit(c)} className="text-white/30 hover:text-blue-400 transition-colors" title="Editar"><Pencil size={14} /></button>
                    <Badge variant={c.ativo ? "success" : "default"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/50"><MapPin size={12} />{c.cidadePrincipal || "N/I"} {c.regiao ? `• ${c.regiao}` : ""}</div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">Criado em: {formatDate(c.criadoEm)}</span>
                  {userData?.uid !== c.uid && (
                    <button onClick={() => handleToggleStatus(c.uid, c.ativo)} className={`${c.ativo ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"} transition-colors`}>
                      {c.ativo ? "Desativar" : "Ativar"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {coordenadores.length === 0 && <p className="col-span-full text-center text-white/30 py-8">Nenhum coordenador cadastrado</p>}
          </div>
        )}
      </GlassCard>
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Editar Coordenador">
        <div className="space-y-4">
          <Input label="Nome" value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
          <Select label="Estado" value={editForm.estado} onChange={(e) => { setEditForm({ ...editForm, estado: e.target.value, cidadePrincipal: "" }); setCidadesEditDisponiveis(cidades[e.target.value] || []); }} options={estados.map((e) => ({ value: e.sigla, label: `${e.sigla} - ${e.nome}` }))} />
          <Select label="Cidade Principal" value={editForm.cidadePrincipal} onChange={(e) => setEditForm({ ...editForm, cidadePrincipal: e.target.value })} options={cidadesEditDisponiveis.map((c) => ({ value: c, label: c }))} disabled={!editForm.estado} />
          <Input label="Região" value={editForm.regiao} onChange={(e) => setEditForm({ ...editForm, regiao: e.target.value })} />
          <div className="flex gap-3 pt-2">
            <Button onClick={handleEdit} className="flex-1">Salvar</Button>
            <Button variant="ghost" onClick={() => setEditModal(null)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

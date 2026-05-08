"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, doc, setDoc, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { AppUser, UserRole, Atividade } from "@/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Shield, UserPlus, Activity } from "lucide-react";
import toast from "react-hot-toast";
import { formatDate } from "@/lib/utils";
import { buscarAtividades, registrarAtividade } from "@/lib/firestore";

const roleOptions = [
  { value: "admin", label: "Admin Master" },
  { value: "coordenador", label: "Coordenador" },
  { value: "colaborador", label: "Colaborador" },
];

export default function ConfiguracoesPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [form, setForm] = useState({ email: "", password: "", nome: "", role: "colaborador" as UserRole });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userData && userData.role !== "admin") { router.push("/dashboard"); return; }
    loadData();
  }, [userData]);

  async function loadData() {
    try {
      const q = query(collection(db, "usuarios"), orderBy("criadoEm", "desc"));
      const snap = await getDocs(q);
      setUsuarios(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
      const atvs = await buscarAtividades(30);
      setAtividades(atvs);
    } catch (e) { console.error(e); }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password || !form.nome) { toast.error("Preencha todos os campos"); return; }
    if (form.password.length < 6) { toast.error("Senha deve ter no mínimo 6 caracteres"); return; }
    setSaving(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, "usuarios", cred.user.uid), { email: form.email, nome: form.nome, role: form.role, criadoEm: new Date(), ativo: true });
      await registrarAtividade({ acao: "criar_usuario", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Criou usuário ${form.nome} (${form.role})` });
      toast.success("Usuário criado com sucesso!");
      setForm({ email: "", password: "", nome: "", role: "colaborador" });
      loadData();
    } catch (error: any) { toast.error(error.code === "auth/email-already-in-use" ? "Email já está em uso" : "Erro ao criar usuário"); } finally { setSaving(false); }
  }

  async function handleToggleStatus(uid: string, ativo: boolean) {
    try { await updateDoc(doc(db, "usuarios", uid), { ativo: !ativo }); toast.success(`Usuário ${ativo ? "desativado" : "ativado"}`); loadData(); } catch (e) { toast.error("Erro ao atualizar"); }
  }

  return (
    <div className="space-y-6 animate-in">
      <div><h1 className="text-2xl font-bold text-white">Configurações</h1><p className="text-white/50 text-sm mt-1">Gerenciamento do sistema</p></div>
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><UserPlus size={18} className="text-emerald-400" /><h3 className="text-white font-semibold">Criar Novo Usuário</h3></div>
        <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
          <Input label="Senha" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
          <Select label="Nível de Acesso" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })} options={roleOptions} />
          <div className="md:col-span-2 lg:col-span-4"><Button type="submit" loading={saving}><UserPlus size={18} />{saving ? "Criando..." : "Criar Usuário"}</Button></div>
        </form>
      </GlassCard>
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><Shield size={18} className="text-emerald-400" /><h3 className="text-white font-semibold">Usuários do Sistema</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-white/40 border-b border-white/[0.06]"><th className="text-left py-3 px-2 font-medium">Nome</th><th className="text-left py-3 px-2 font-medium">Email</th><th className="text-left py-3 px-2 font-medium">Nível</th><th className="text-left py-3 px-2 font-medium">Status</th><th className="text-left py-3 px-2 font-medium">Criado em</th><th className="text-left py-3 px-2 font-medium">Ação</th></tr></thead>
            <tbody>{usuarios.map((u) => (
              <tr key={u.uid} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="py-3 px-2 text-white/80">{u.nome}</td><td className="py-3 px-2 text-white/60">{u.email}</td>
                <td className="py-3 px-2"><Badge variant={u.role === "admin" ? "danger" : u.role === "coordenador" ? "warning" : "info"}>{u.role}</Badge></td>
                <td className="py-3 px-2"><Badge variant={u.ativo ? "success" : "default"}>{u.ativo ? "Ativo" : "Inativo"}</Badge></td>
                <td className="py-3 px-2 text-white/40 text-xs">{formatDate(u.criadoEm)}</td>
                <td className="py-3 px-2">{userData?.uid !== u.uid && <button onClick={() => handleToggleStatus(u.uid, u.ativo)} className="text-xs text-white/40 hover:text-white transition-colors">{u.ativo ? "Desativar" : "Ativar"}</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </GlassCard>
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><Activity size={18} className="text-emerald-400" /><h3 className="text-white font-semibold">Atividades Recentes</h3></div>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {atividades.map((a) => (
            <div key={a.id} className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 text-xs">{a.usuarioNome.charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0"><p className="text-sm text-white/70"><span className="font-medium text-white">{a.usuarioNome}</span> {a.detalhes}</p><p className="text-xs text-white/30 mt-0.5">{formatDate(a.criadoEm)}</p></div>
              <Badge variant={a.usuarioRole === "admin" ? "danger" : a.usuarioRole === "coordenador" ? "warning" : "info"}>{a.usuarioRole}</Badge>
            </div>
          ))}
          {atividades.length === 0 && <p className="text-center text-white/30 py-8">Nenhuma atividade registrada</p>}
        </div>
      </GlassCard>
    </div>
  );
}

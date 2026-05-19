"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { AppUser, UserRole, Atividade, Gabinete } from "@/types";
import { isSuperOrMaster, isAssessor } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Shield, UserPlus, Activity, Trash2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { formatDate } from "@/lib/utils";
import { buscarAtividades, registrarAtividade, getGabinetes } from "@/lib/firestore";

const roleOptions = [
  { value: "admin_master", label: "Admin Master" },
  { value: "assessor", label: "Assessor Parlamentar" },
  { value: "coordenador", label: "Coordenador" },
  { value: "colaborador", label: "Colaborador" },
];

export default function ConfiguracoesPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [form, setForm] = useState({ email: "", password: "", nome: "", role: "colaborador" as UserRole, gabineteId: "" });
  const [gabinetes, setGabinetes] = useState<Gabinete[]>([]);
  const [saving, setSaving] = useState(false);
  const [reseting, setReseting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetStep, setResetStep] = useState(0);

  useEffect(() => {
    if (userData && !isSuperOrMaster(userData) && !isAssessor(userData)) { router.push("/dashboard"); return; }
    loadData();
  }, [userData]);

  async function loadData() {
    try {
      const gabId = userData?.campanhaId || userData?.gabineteId;
      const constraints: any[] = [orderBy("criadoEm", "desc")];
      if (isAssessor(userData) && gabId) constraints.unshift(where("campanhaId", "==", gabId));
      const q = query(collection(db, "usuarios"), ...constraints);
      const snap = await getDocs(q);
      setUsuarios(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
      const atvs = isAssessor(userData)
        ? gabId ? await buscarAtividades(30, gabId) : []
        : await buscarAtividades(30);
      setAtividades(atvs);
      const gabs = isSuperOrMaster(userData) ? await getGabinetes() : [];
      setGabinetes(gabs.filter((g) => g.ativo));
    } catch (e) { console.error(e); }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password || !form.nome) { toast.error("Preencha todos os campos"); return; }
    if (form.password.length < 6) { toast.error("Senha deve ter no mínimo 6 caracteres"); return; }
    setSaving(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        email: form.email, nome: form.nome, role: form.role,
        gabineteId: form.gabineteId || undefined,
        campanhaId: form.gabineteId || undefined,
        criadoEm: new Date(), ativo: true,
      });
      await registrarAtividade({ acao: "criar_usuario", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Criou usuário ${form.nome} (${form.role})` });
      toast.success("Usuário criado com sucesso!");
      setForm({ email: "", password: "", nome: "", role: "colaborador", gabineteId: "" });
      loadData();
    } catch (error: any) { toast.error(error.code === "auth/email-already-in-use" ? "Email já está em uso" : "Erro ao criar usuário"); } finally { setSaving(false); }
  }

  async function handleToggleStatus(uid: string, ativo: boolean) {
    try { await updateDoc(doc(db, "usuarios", uid), { ativo: !ativo }); toast.success(`Usuário ${ativo ? "desativado" : "ativado"}`); loadData(); } catch (e) { toast.error("Erro ao atualizar"); }
  }

  async function handleReset() {
    if (!isSuperOrMaster(userData)) return;
    setReseting(true);
    try {
      // Excluir todos os eleitores
      const eSnap = await getDocs(collection(db, "eleitores"));
      for (const d of eSnap.docs) {
        await deleteDoc(doc(db, "eleitores", d.id));
      }

      // Excluir todos os candidatos
      const candSnap = await getDocs(collection(db, "candidatos"));
      for (const d of candSnap.docs) {
        await deleteDoc(doc(db, "candidatos", d.id));
      }

      // Excluir todas as atividades
      const aSnap = await getDocs(collection(db, "atividades"));
      for (const d of aSnap.docs) {
        await deleteDoc(doc(db, "atividades", d.id));
      }

      // Excluir todas as metas
      const mSnap = await getDocs(collection(db, "metas"));
      for (const d of mSnap.docs) {
        await deleteDoc(doc(db, "metas", d.id));
      }

      // Excluir usuários que não são super_admin nem admin_master
      const userSnap = await getDocs(collection(db, "usuarios"));
      for (const d of userSnap.docs) {
        const data = d.data();
        if (data.role !== "super_admin" && data.role !== "admin_master") {
          await deleteDoc(doc(db, "usuarios", d.id));
        }
      }

      // Excluir gabinetes
      const gabSnap = await getDocs(collection(db, "campanhas"));
      for (const d of gabSnap.docs) {
        await deleteDoc(doc(db, "campanhas", d.id));
      }

      toast.success("Plataforma resetada! Recarregando...");
      setShowResetConfirm(false);
      setResetStep(0);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) { toast.error("Erro ao resetar"); } finally { setReseting(false); }
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
          <Select label="Vincular ao Gabinete" value={form.gabineteId} onChange={(e) => setForm({ ...form, gabineteId: e.target.value })} options={gabinetes.map((g) => ({ value: g.id!, label: `${g.nome} (${g.cargo})` }))} emptyMessage="Nenhum gabinete ativo disponível" />
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
                <td className="py-3 px-2"><Badge variant={u.role === "admin_master" ? "danger" : u.role === "assessor" ? "warning" : u.role === "coordenador" ? "warning" : "info"}>{u.role === "admin_master" ? "Admin Master" : u.role === "assessor" ? "Assessor" : u.role}</Badge></td>
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
              <Badge variant={a.usuarioRole === "admin_master" ? "danger" : a.usuarioRole === "coordenador" ? "warning" : "info"}>{a.usuarioRole === "admin_master" ? "Admin Master" : a.usuarioRole}</Badge>
            </div>
          ))}
          {atividades.length === 0 && <p className="text-center text-white/30 py-8">Nenhuma atividade registrada</p>}
        </div>
      </GlassCard>

      {isSuperOrMaster(userData) && (
        <GlassCard className="p-5 border-red-500/20">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-red-400" />
            <h3 className="text-white font-semibold">Zona de Perigo</h3>
          </div>
          <p className="text-sm text-white/50 mb-4">
            Esta ação desativa todos os dados de teste da plataforma: eleitores, candidatos, atividades, metas, colaboradores, coordenadores e gabinetes.
            <br />
            <span className="text-red-400 font-medium">Os usuários Admin Master e Super Admin não são afetados.</span>
          </p>

          {!showResetConfirm ? (
            <Button variant="danger" onClick={() => setShowResetConfirm(true)} loading={reseting}>
              <Trash2 size={16} /> Resetar Dados de Teste
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-amber-400 font-medium">
                {resetStep === 0
                  ? "Tem certeza? Todos os dados de teste serão desativados permanentemente."
                  : "Esta é a última confirmação. Esta ação não pode ser desfeita."}
              </p>
              <div className="flex items-center gap-3">
                {resetStep === 0 ? (
                  <Button variant="danger" onClick={() => setResetStep(1)}>
                    Sim, quero resetar
                  </Button>
                ) : (
                  <Button variant="danger" onClick={handleReset} loading={reseting}>
                    {reseting ? "Resetando..." : "Sim, tenho certeza. Resetar tudo!"}
                  </Button>
                )}
                <Button variant="ghost" onClick={() => { setShowResetConfirm(false); setResetStep(0); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}

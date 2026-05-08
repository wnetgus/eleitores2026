"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where, doc, setDoc, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Eleitor, AppUser, ROLE_CONFIG } from "@/types";
import { getRoleConfig, isAdmin, isCoordenador, isColaborador, canManageColaboradores } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatDate, parseDate } from "@/lib/utils";
import { Users, Trophy, TrendingUp, Calendar, UserPlus, Zap, Mail } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import toast from "react-hot-toast";
import { registrarAtividade } from "@/lib/firestore";

export default function ColaboradoresPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [colaboradores, setColaboradores] = useState<AppUser[]>([]);
  const [selectedColaborador, setSelectedColaborador] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: "", password: "", nome: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userData && !canManageColaboradores(userData)) { router.push(isColaborador(userData) ? "/eleitores" : "/dashboard"); return; }
    loadData();
  }, [userData]);

  async function loadData() {
    try {
      const q = query(collection(db, "eleitores"), orderBy("criadoEm", "desc"));
      const snap = await getDocs(q);
      setEleitores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor)));

      const uConstraints: any[] = [where("role", "==", "colaborador")];
      if (isCoordenador(userData)) uConstraints.push(where("coordenadorId", "==", userData!.uid));
      const uq = query(collection(db, "usuarios"), ...uConstraints);
      const usnap = await getDocs(uq);
      setColaboradores(usnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password || !form.nome) { toast.error("Preencha todos os campos"); return; }
    setSaving(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        email: form.email, nome: form.nome, role: "colaborador",
        coordenadorId: isCoordenador(userData) ? userData!.uid : userData!.uid,
        criadoEm: new Date(), ativo: true, criadoPor: userData?.uid,
      });
      await registrarAtividade({
        acao: "criar_colaborador", usuarioId: userData!.uid, usuarioNome: userData!.nome,
        usuarioRole: userData!.role, detalhes: `Criou colaborador ${form.nome}`,
      });
      toast.success("Colaborador criado!");
      setForm({ email: "", password: "", nome: "" });
      loadData();
    } catch (error: any) { toast.error(error.code === "auth/email-already-in-use" ? "Email já está em uso" : "Erro ao criar"); } finally { setSaving(false); }
  }

  if (!userData || !canManageColaboradores(userData)) return null;
  const config = getRoleConfig(userData);
  const roleInfo = ROLE_CONFIG[userData.role];

  const ranking = eleitores.reduce<Record<string, { nome: string; total: number; id: string }>>((acc, e) => {
    if (!acc[e.colaboradorId]) acc[e.colaboradorId] = { nome: e.colaboradorNome, total: 0, id: e.colaboradorId };
    acc[e.colaboradorId].total++;
    return acc;
  }, {});
  const rankingArray = Object.values(ranking).sort((a, b) => b.total - a.total);
  const top3 = rankingArray.slice(0, 3);

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
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleInfo.gradient} flex items-center justify-center text-lg`}>{roleInfo.icon}</div>
        <div>
          <h1 className="text-2xl font-bold text-white">Colaboradores</h1>
          <p className={`text-sm ${roleInfo.text}`}>{isAdmin(userData) ? "Gerencie todos os colaboradores" : "Sua equipe de campo"}</p>
        </div>
      </div>

      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><UserPlus size={18} className={roleInfo.text} /><h3 className="text-white font-semibold">Criar Colaborador</h3></div>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do colaborador" />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
          <Input label="Senha" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
          <div className="md:col-span-3"><Button type="submit" loading={saving}><UserPlus size={18} />{saving ? "Criando..." : "Criar Colaborador"}</Button></div>
        </form>
      </GlassCard>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Colaboradores" value={colaboradores.length} icon={<Users size={20} />} delay={0} />
        <StatCard title="Total Cadastros" value={eleitores.length} icon={<TrendingUp size={20} />} delay={100} />
        <StatCard title="Média p/ Colaborador" value={colaboradores.length > 0 ? Math.round(eleitores.length / colaboradores.length) : 0} icon={<Calendar size={20} />} delay={200} />
      </div>

      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><Trophy size={20} className="text-amber-400" /><h3 className="text-white font-semibold">Ranking de Colaboradores</h3></div>
        <div className="h-72">
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
        {top3.map((col, idx) => (
          <GlassCard key={col.id} className="p-5 cursor-pointer hover:border-white/[0.12] transition-all" onClick={() => setSelectedColaborador(col.id)}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${idx === 0 ? "bg-amber-500/20 text-amber-400" : idx === 1 ? "bg-gray-400/20 text-gray-300" : "bg-amber-700/20 text-amber-600"}`}>{idx + 1}</div>
              <div><p className="text-white font-medium">{col.nome}</p><p className="text-xs text-white/40">{col.total} cadastros</p></div>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2"><div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${(col.total / rankingArray[0].total) * 100}%` }} /></div>
          </GlassCard>
        ))}
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
            <div className="h-48 mb-6">
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

      <GlassCard className="p-5">
        <h3 className="text-white font-semibold mb-4">
          {isAdmin(userData) ? "Todos os Colaboradores" : "Meus Colaboradores"}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {colaboradores.map((c) => (
            <div key={c.uid} className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-sm">{c.nome.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{c.nome}</p>
                  <p className="text-xs text-white/40 truncate">{c.email}</p>
                </div>
                <Badge variant="success">Ativo</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/40"><Mail size={12} />{c.email}</div>
            </div>
          ))}
          {colaboradores.length === 0 && <p className="col-span-full text-center text-white/30 py-8">Nenhum colaborador</p>}
        </div>
      </GlassCard>
    </div>
  );
}

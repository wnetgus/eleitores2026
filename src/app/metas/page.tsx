"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where, addDoc, serverTimestamp, doc, updateDoc, getDocs as getDocs2 } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Eleitor, AppUser, Meta, ROLE_CONFIG } from "@/types";
import { getRoleConfig, isSuperOrMaster, isPolitico, isAssessor, isCoordenador, isColaborador } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate, parseDate } from "@/lib/utils";
import { TrendingUp, Target, Zap, Flag, Save } from "lucide-react";
import toast from "react-hot-toast";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function MetasPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [colaboradores, setColaboradores] = useState<AppUser[]>([]);
  const [metas, setMetas] = useState<Record<string, number>>({});
  const [metasDocs, setMetasDocs] = useState<any[]>([]);
  const [formMeta, setFormMeta] = useState({ colaboradorId: "", valor: "" });
  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);

  const podeGerenciarMetas = isSuperOrMaster(userData) || isAssessor(userData) || isAssessor(userData) || isCoordenador(userData);

  useEffect(() => {
    if (!userData) return;
    load();
  }, [userData]);

  async function load() {
    try {
      const constraints: any[] = [orderBy("criadoEm", "desc")];
      if (isColaborador(userData!)) {
        constraints.unshift(where("colaboradorId", "==", userData!.uid));
      } else if (isCoordenador(userData!)) {
        constraints.unshift(where("coordenadorId", "==", userData!.uid));
      }
      if (!isSuperOrMaster(userData!) && userData?.campanhaId) {
        constraints.unshift(where("campanhaId", "==", userData.campanhaId));
      }
      const q = query(collection(db, "eleitores"), ...constraints);
      const snap = await getDocs(q);
      setEleitores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor)));

      const uConstraints: any[] = [where("role", "==", "colaborador")];
      if (isCoordenador(userData)) {
        uConstraints.push(where("coordenadorId", "==", userData!.uid));
      } else if (!isSuperOrMaster(userData) && userData?.campanhaId) {
        uConstraints.push(where("campanhaId", "==", userData.campanhaId));
      }
      const uSnap = await getDocs(query(collection(db, "usuarios"), ...uConstraints));
      setColaboradores(uSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));

      const mSnap = await getDocs(query(collection(db, "metas"), orderBy("criadoEm", "desc")));
      const metasMap: Record<string, number> = {};
      const metasGabMap: Record<string, number> = {};
      const metasInfo: Record<string, { nome: string; meta: number; gabineteId?: string }> = {};
      mSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.colaboradorId) {
          metasMap[data.colaboradorId] = data.meta;
          metasInfo[data.colaboradorId] = { nome: data.colaboradorNome || "Colaborador", meta: data.meta, gabineteId: data.gabineteId };
        }
        if (data.gabineteId) {
          metasGabMap[data.gabineteId] = data.meta;
          metasInfo[data.gabineteId] = { nome: data.colaboradorNome || "Gabinete", meta: data.meta, gabineteId: data.gabineteId };
        }
      });
      setMetas(metasMap);
      setMetasDocs(mSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function definirMeta() {
    if (!formMeta.colaboradorId || !formMeta.valor) { toast.error("Selecione colaborador e valor"); return; }
    setSavingMeta(true);
    try {
      const existing = query(collection(db, "metas"), where("colaboradorId", "==", formMeta.colaboradorId));
      const existingSnap = await getDocs(existing);
      if (!existingSnap.empty) {
        await updateDoc(doc(db, "metas", existingSnap.docs[0].id), { meta: Number(formMeta.valor) });
      } else {
        await addDoc(collection(db, "metas"), {
          colaboradorId: formMeta.colaboradorId, meta: Number(formMeta.valor),
          criadoEm: serverTimestamp(),
        });
      }
      toast.success("Meta definida!");
      setFormMeta({ colaboradorId: "", valor: "" });
      load();
    } catch (e) { toast.error("Erro ao salvar meta"); } finally { setSavingMeta(false); }
  }

  if (!userData) return null;
  const config = getRoleConfig(userData);
  const roleInfo = ROLE_CONFIG[userData.role];

  const gabineteId = userData?.gabineteId || userData?.campanhaId;

  const diasMap = eleitores.reduce<Record<string, number>>((acc, e) => {
    const d = parseDate(e.criadoEm);
    const key = d.toLocaleDateString("pt-BR");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const crescimentoData = Object.entries(diasMap).map(([dia, total]) => ({ dia, total })).sort((a, b) => {
    const [dA, mA, yA] = a.dia.split("/").map(Number);
    const [dB, mB, yB] = b.dia.split("/").map(Number);
    return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
  });

  const hoje = new Date().toLocaleDateString("pt-BR");
  const cadastrosHoje = eleitores.filter((e) => parseDate(e.criadoEm).toLocaleDateString("pt-BR") === hoje).length;
  const mediaDia = eleitores.length > 0 ? (eleitores.length / Math.max(crescimentoData.length, 1)).toFixed(1) : 0;
  const minhaMeta = metas[userData.uid] || 0;
  const progressoMeta = minhaMeta > 0 ? Math.min(100, Math.round((eleitores.length / minhaMeta) * 100)) : 0;

  if (loading) return <div className="flex justify-center py-20"><svg className="animate-spin h-8 w-8" style={{ color: roleInfo.text.replace("text-", "") } as React.CSSProperties} viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleInfo.gradient} flex items-center justify-center text-lg`}>{roleInfo.icon}</div>
        <div>
          <h1 className="text-2xl font-bold text-white">Metas</h1>
          <p className={`text-sm ${roleInfo.text}`}>Acompanhe sua produtividade</p>
        </div>
      </div>

      {/* Metas por Gabinete (para político/deputado) */}
      {(isSuperOrMaster(userData) || isPolitico(userData)) && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4"><Flag size={18} className="text-amber-400" /><h3 className="text-white font-semibold">Metas por Estrutura</h3></div>
          <div className="space-y-2">
            {metasDocs.filter((m: any) => m.gabineteId).length > 0 ? metasDocs.filter((m: any) => m.gabineteId).map((m: any) => {
              const total = eleitores.filter((e) => e.campanhaId === m.gabineteId).length;
              const prog = Math.min(100, Math.round((total / m.meta) * 100));
              return (
                <div key={m.id} className="flex items-center gap-3 p-2 bg-white/[0.03] rounded-xl">
                  <span className="text-sm text-white/80 w-48 truncate">{m.colaboradorNome || "Gabinete"}</span>
                  <span className="text-xs text-white/50">{total}/{m.meta}</span>
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${prog >= 100 ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${prog}%` }} />
                  </div>
                  <span className={`text-xs font-bold ${prog >= 100 ? "text-emerald-400" : "text-amber-400"}`}>{prog}%</span>
                </div>
              );
            }) : <p className="text-sm text-white/30 italic">Nenhuma meta definida para os gabinetes</p>}
          </div>
        </GlassCard>
      )}

      {isColaborador(userData) && minhaMeta > 0 && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <Flag size={20} className="text-emerald-400" />
            <h3 className="text-white font-semibold">Minha Meta</h3>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/60">{eleitores.length} de {minhaMeta} cadastros</span>
            <span className={`text-sm font-bold ${progressoMeta >= 100 ? "text-emerald-400" : "text-amber-400"}`}>{progressoMeta}%</span>
          </div>
          <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${progressoMeta >= 100 ? "bg-emerald-500" : "bg-emerald-400"}`} style={{ width: `${Math.min(progressoMeta, 100)}%` }} />
          </div>
        </GlassCard>
      )}

      {podeGerenciarMetas && colaboradores.length > 0 && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4"><Target size={18} className="text-emerald-400" /><h3 className="text-white font-semibold">Definir Metas</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <Select
              label="Colaborador"
              value={formMeta.colaboradorId}
              onChange={(e) => setFormMeta({ ...formMeta, colaboradorId: e.target.value })}
              options={colaboradores.map((c) => ({ value: c.uid, label: c.nome }))}
            />
            <Input label="Meta (cadastros)" type="number" value={formMeta.valor} onChange={(e) => setFormMeta({ ...formMeta, valor: e.target.value })} placeholder="Ex: 100" min={1} />
            <Button onClick={definirMeta} loading={savingMeta}><Save size={16} /> {savingMeta ? "Salvando..." : "Definir Meta"}</Button>
          </div>
          {colaboradores.filter((c) => metas[c.uid]).length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-white/50 font-medium">Metas definidas:</p>
              {colaboradores.filter((c) => metas[c.uid]).map((c) => {
                const total = eleitores.filter((e) => e.colaboradorId === c.uid).length;
                const progresso = Math.min(100, Math.round((total / metas[c.uid]) * 100));
                return (
                  <div key={c.uid} className="flex items-center gap-3 p-2 bg-white/[0.03] rounded-xl">
                    <span className="text-sm text-white/80 w-40 truncate">{c.nome}</span>
                    <span className="text-xs text-white/50">{total}/{metas[c.uid]}</span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${progresso >= 100 ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${progresso}%` }} />
                    </div>
                    <span className={`text-xs font-bold ${progresso >= 100 ? "text-emerald-400" : "text-amber-400"}`}>{progresso}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-5 text-center">
          <Target size={24} className={`mx-auto mb-2 ${roleInfo.text}`} />
          <p className="text-3xl font-bold text-white">{eleitores.length}</p>
          <p className="text-xs text-white/40">Total de Cadastros</p>
        </GlassCard>
        <GlassCard className="p-5 text-center">
          <Zap size={24} className={`mx-auto mb-2 ${roleInfo.text}`} />
          <p className="text-3xl font-bold text-white">{cadastrosHoje}</p>
          <p className="text-xs text-white/40">Cadastros Hoje</p>
        </GlassCard>
        <GlassCard className="p-5 text-center">
          <TrendingUp size={24} className={`mx-auto mb-2 ${roleInfo.text}`} />
          <p className="text-3xl font-bold text-white">{mediaDia}</p>
          <p className="text-xs text-white/40">Média por Dia</p>
        </GlassCard>
      </div>

      {crescimentoData.length > 0 && (
        <GlassCard className="p-5">
          <h3 className="text-white font-semibold mb-4">Evolução Diária</h3>
          <div className="h-64 min-w-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={crescimentoData}>
                <defs>
                  <linearGradient id="metaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="dia" stroke="rgba(255,255,255,0.1)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} />
                <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, color: "#fff" }} />
                <Area type="monotone" dataKey="total" stroke="#10b981" fillOpacity={1} fill="url(#metaGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-5">
        <h3 className="text-white font-semibold mb-4">
          {isColaborador(userData) ? "Meus Cadastros" : "Cadastros"}
        </h3>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 border-b border-white/[0.06]">
                <th className="text-left py-2 px-2 font-medium">Nome</th>
                <th className="text-left py-2 px-2 font-medium">Cidade</th>
                <th className="text-left py-2 px-2 font-medium">Grau</th>
                <th className="text-left py-2 px-2 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {eleitores.map((e) => (
                <tr key={e.id} className="border-b border-white/[0.03]">
                  <td className="py-2 px-2 text-white/70">{e.nomeCompleto}</td>
                  <td className="py-2 px-2 text-white/50">{e.cidade}</td>
                  <td className="py-2 px-2">
                    <Badge variant={e.grauApoio === "forte" ? "success" : e.grauApoio === "medio" ? "warning" : e.grauApoio === "fraco" ? "danger" : "info"}>{e.grauApoio}</Badge>
                  </td>
                  <td className="py-2 px-2 text-white/40 text-xs">{formatDate(e.criadoEm)}</td>
                </tr>
              ))}
              {eleitores.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-white/30">Nenhum cadastro ainda</td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

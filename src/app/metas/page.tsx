"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Eleitor, AppUser, Meta, ROLE_CONFIG } from "@/types";
import { getRoleConfig, isAdmin, isCoordenador, isColaborador } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate, parseDate } from "@/lib/utils";
import { TrendingUp, Target, Zap, Flag } from "lucide-react";
import toast from "react-hot-toast";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function MetasPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData) return;
    async function load() {
      try {
        const constraints: any[] = [orderBy("criadoEm", "desc")];
        if (isColaborador(userData!)) {
          constraints.unshift(where("colaboradorId", "==", userData!.uid));
        } else if (isCoordenador(userData!)) {
          constraints.unshift(where("coordenadorId", "==", userData!.uid));
        }
        const q = query(collection(db, "eleitores"), ...constraints);
        const snap = await getDocs(q);
        setEleitores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor)));
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    load();
  }, [userData]);

  if (!userData) return null;
  const config = getRoleConfig(userData);
  const roleInfo = ROLE_CONFIG[userData.role];

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
          <div className="h-64">
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

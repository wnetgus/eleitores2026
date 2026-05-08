"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { isAdmin, getRoleConfig } from "@/lib/permissions";
import { Atividade } from "@/types";
import { buscarAtividades } from "@/lib/firestore";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { Activity, Shield } from "lucide-react";

export default function LogsPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userData && !isAdmin(userData)) { router.push("/dashboard"); return; }
    async function load() {
      try {
        const data = await buscarAtividades(100);
        setAtividades(data);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    if (userData) load();
  }, [userData]);

  if (!userData || !isAdmin(userData)) return null;
  const config = getRoleConfig(userData);

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-lg`}>👑</div>
        <div>
          <h1 className="text-2xl font-bold text-white">Logs de Atividades</h1>
          <p className="text-sm text-purple-400">Auditoria completa do sistema</p>
        </div>
      </div>

      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><Shield size={18} className="text-purple-400" /><h3 className="text-white font-semibold">Registro de Atividades</h3></div>
        {loading ? (
          <div className="flex justify-center py-12"><svg className="animate-spin h-6 w-6 text-purple-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {atividades.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-xl hover:bg-white/[0.04] transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                  a.usuarioRole === "admin" ? "bg-purple-500/20 text-purple-400" :
                  a.usuarioRole === "coordenador" ? "bg-blue-500/20 text-blue-400" :
                  "bg-emerald-500/20 text-emerald-400"
                }`}>
                  {a.usuarioNome.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/70">
                    <span className="font-medium text-white">{a.usuarioNome}</span> {a.detalhes}
                  </p>
                  <p className="text-xs text-white/30 mt-0.5">{formatDate(a.criadoEm)}</p>
                </div>
                <Badge variant={a.usuarioRole === "admin" ? "danger" : a.usuarioRole === "coordenador" ? "warning" : "info"}>{a.usuarioRole}</Badge>
              </div>
            ))}
            {atividades.length === 0 && <p className="text-center text-white/30 py-12">Nenhuma atividade registrada</p>}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { isSuperOrMaster, isAssessor, isAssessorExecutivo, getRoleConfig } from "@/lib/permissions";
import { Atividade } from "@/types";
import { buscarAtividades, registrarAtividade } from "@/lib/firestore";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import { Activity, Shield, AlertTriangle, Trash2, CheckCircle, Clock } from "lucide-react";
import { collection, getDocs, query, orderBy, where, doc, updateDoc, deleteDoc, serverTimestamp, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import toast from "react-hot-toast";

type Aba = "atividades" | "lgpd" | "erros";

interface SolicitacaoLGPD {
  id: string;
  eleitorId: string;
  eleitorNome: string;
  documento: string;
  tipo: string;
  status: "pendente" | "processado" | "recusado";
  solicitadoPorNome: string;
  campanhaId: string;
  criadoEm: any;
  processadoEm?: any;
  observacao?: string;
}

interface ErroLog {
  id: string;
  message: string;
  url: string;
  criadoEm: any;
}

export default function LogsPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("atividades");
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoLGPD[]>([]);
  const [erros, setErros] = useState<ErroLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmacaoLGPD, setConfirmacaoLGPD] = useState<SolicitacaoLGPD | null>(null);

  const isAdmin = isSuperOrMaster(userData);

  useEffect(() => {
    if (userData && !isSuperOrMaster(userData) && !isAssessorExecutivo(userData) && !isAssessor(userData)) {
      router.push("/dashboard"); return;
    }
    if (userData) loadAll();
  }, [userData]);

  async function loadAll() {
    setLoading(true);
    try {
      const campId = userData?.campanhaId || userData?.gabineteId;
      const [atv, lgpd, err] = await Promise.allSettled([
        buscarAtividades(100, campId),
        isAdmin
          ? getDocs(query(collection(db, "_solicitacoes_lgpd"), orderBy("criadoEm", "desc"), limit(50)))
          : campId
            ? getDocs(query(collection(db, "_solicitacoes_lgpd"), where("campanhaId", "==", campId), orderBy("criadoEm", "desc"), limit(50)))
            : Promise.resolve({ docs: [] as any[] }),
        isAdmin
          ? getDocs(query(collection(db, "_erros"), orderBy("criadoEm", "desc"), limit(30)))
          : Promise.resolve({ docs: [] as any[] }),
      ]);
      if (atv.status === "fulfilled") setAtividades(atv.value);
      if (lgpd.status === "fulfilled" && "docs" in lgpd.value)
        setSolicitacoes(lgpd.value.docs.map((d) => ({ id: d.id, ...d.data() } as SolicitacaoLGPD)));
      if (err.status === "fulfilled" && "docs" in err.value)
        setErros(err.value.docs.map((d) => ({ id: d.id, ...d.data() } as ErroLog)));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function processarLGPD(sol: SolicitacaoLGPD, acao: "processado" | "recusado") {
    try {
      await updateDoc(doc(db, "_solicitacoes_lgpd", sol.id), {
        status: acao,
        processadoEm: serverTimestamp(),
        processadoPorId: userData!.uid,
        processadoPorNome: userData!.nome,
      });
      if (acao === "processado") {
        await deleteDoc(doc(db, "eleitores", sol.eleitorId));
        await registrarAtividade({
          acao: "excluiu_eleitor_lgpd",
          usuarioId: userData!.uid,
          usuarioNome: userData!.nome,
          usuarioRole: userData!.role,
          detalhes: `Exclusão LGPD (Art. 18): ${sol.eleitorNome} — solicitação ${sol.id}`,
        });
        toast.success(`Dados de ${sol.eleitorNome} excluídos com sucesso.`);
      } else {
        toast.success("Solicitação recusada.");
      }
      loadAll();
    } catch { toast.error("Erro ao processar solicitação"); }
  }

  async function limparErro(id: string) {
    try {
      await deleteDoc(doc(db, "_erros", id));
      setErros((p) => p.filter((e) => e.id !== id));
    } catch { toast.error("Erro ao remover"); }
  }

  if (!userData || (!isSuperOrMaster(userData) && !isAssessorExecutivo(userData) && !isAssessor(userData))) return null;
  const config = getRoleConfig(userData);

  const abas: { id: Aba; label: string; count?: number; color: string }[] = [
    { id: "atividades", label: "Atividades", count: atividades.length, color: "purple" },
    { id: "lgpd", label: "Solicitações LGPD", count: solicitacoes.filter((s) => s.status === "pendente").length, color: "amber" },
    ...(isAdmin ? [{ id: "erros" as Aba, label: "Erros", count: erros.length, color: "red" }] : []),
  ];

  return (
    <div className="space-y-6 animate-in">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-lg`}>
          🔍
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Auditoria & Conformidade</h1>
          <p className="text-sm text-purple-400">Logs de atividades · Solicitações LGPD · Erros de produção</p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 flex-wrap">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              aba === a.id
                ? a.color === "purple" ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
                  : a.color === "amber" ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                  : "bg-red-500/15 border-red-500/30 text-red-300"
                : "bg-white/[0.03] border-white/[0.07] text-white/40 hover:text-white/60"
            }`}
          >
            {a.label}
            {!!a.count && a.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                a.color === "amber" ? "bg-amber-500/20 text-amber-400" :
                a.color === "red" ? "bg-red-500/20 text-red-400" :
                "bg-purple-500/20 text-purple-400"
              }`}>
                {a.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* ── ABA: Atividades ── */}
          {aba === "atividades" && (
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={18} className="text-purple-400" />
                <h3 className="text-white font-semibold">Registro de Atividades</h3>
                <span className="ml-auto text-xs text-white/30">{atividades.length} registros</span>
              </div>
              <div className="space-y-2">
                {atividades.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-xl hover:bg-white/[0.04] transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                       a.usuarioRole === "admin_master" ? "bg-orange-500/20 text-orange-400" :
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
                    <Badge variant={a.usuarioRole === "admin_master" ? "danger" : a.usuarioRole === "coordenador" ? "warning" : "info"}>
                      {a.usuarioRole}
                    </Badge>
                  </div>
                ))}
                {atividades.length === 0 && <p className="text-center text-white/30 py-12">Nenhuma atividade registrada</p>}
              </div>
            </GlassCard>
          )}

          {/* ── ABA: Solicitações LGPD ── */}
          {aba === "lgpd" && (
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={18} className="text-amber-400" />
                <h3 className="text-white font-semibold">Solicitações de Exclusão de Dados (LGPD)</h3>
                {solicitacoes.filter((s) => s.status === "pendente").length > 0 && (
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/20">
                    {solicitacoes.filter((s) => s.status === "pendente").length} pendente(s)
                  </span>
                )}
              </div>
              <p className="text-xs text-white/30 mb-4">
                Solicitações enviadas via plataforma ao abrigo do Art. 18 da Lei 13.709/2018 (LGPD). Prazo de processamento: 48h.
              </p>
              <div className="space-y-3">
                {solicitacoes.map((s) => (
                  <div key={s.id} className={`p-4 rounded-xl border ${
                    s.status === "pendente" ? "bg-amber-500/5 border-amber-500/20" :
                    s.status === "processado" ? "bg-emerald-500/5 border-emerald-500/15" :
                    "bg-white/[0.02] border-white/[0.07]"
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{s.eleitorNome}</p>
                        <p className="text-xs text-white/40 mt-0.5">
                          Documento: {s.documento || "—"} · Solicitado por: {s.solicitadoPorNome}
                        </p>
                        <p className="text-xs text-white/30 mt-0.5">
                          {s.criadoEm?.toDate ? formatDate(s.criadoEm.toDate()) : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {s.status === "pendente" ? (
                          <span className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold">
                            <Clock size={10} /> Pendente
                          </span>
                        ) : s.status === "processado" ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                            <CheckCircle size={10} /> Processado
                          </span>
                        ) : (
                          <span className="text-[10px] text-white/30">Recusado</span>
                        )}
                      </div>
                    </div>
                    {(isAdmin || isAssessorExecutivo(userData)) && s.status === "pendente" && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-white/[0.05]">
                        <Button
                          onClick={() => setConfirmacaoLGPD(s)}
                          className="flex-1 text-xs py-1.5 bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20"
                        >
                          <Trash2 size={12} /> Excluir dados do eleitor
                        </Button>
                        <Button
                          onClick={() => processarLGPD(s, "recusado")}
                          className="flex-1 text-xs py-1.5 bg-white/5 text-white/40 hover:text-white/60 border border-white/10"
                        >
                          Recusar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {solicitacoes.length === 0 && (
                  <div className="text-center py-12">
                    <CheckCircle size={32} className="mx-auto text-emerald-500/30 mb-2" />
                    <p className="text-white/30 text-sm">Nenhuma solicitação LGPD pendente</p>
                  </div>
                )}
              </div>
            </GlassCard>
          )}

          {/* ── ABA: Erros de produção ── */}
          {aba === "erros" && isAdmin && (
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={18} className="text-red-400" />
                <h3 className="text-white font-semibold">Erros de Runtime</h3>
                <span className="ml-auto text-xs text-white/30">{erros.length} registros</span>
              </div>
              <div className="space-y-3">
                {erros.map((e) => (
                  <div key={e.id} className="p-4 rounded-xl bg-red-500/5 border border-red-500/15">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-mono text-red-300 break-all">{e.message}</p>
                        <p className="text-xs text-white/30 mt-1">
                          URL: {e.url || "—"} · {e.criadoEm?.toDate ? formatDate(e.criadoEm.toDate()) : "—"}
                        </p>
                      </div>
                      <button
                        onClick={() => limparErro(e.id)}
                        className="shrink-0 text-white/20 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {erros.length === 0 && (
                  <div className="text-center py-12">
                    <CheckCircle size={32} className="mx-auto text-emerald-500/30 mb-2" />
                    <p className="text-white/30 text-sm">Nenhum erro registrado</p>
                  </div>
                )}
              </div>
            </GlassCard>
          )}
        </>
      )}

      {/* Modal de confirmação de exclusão LGPD */}
      {confirmacaoLGPD && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-red-500/30 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Confirmar exclusão permanente</p>
                <p className="text-xs text-red-400/70">Esta ação não pode ser desfeita</p>
              </div>
            </div>
            <p className="text-sm text-white/70">
              Tem certeza que deseja excluir permanentemente os dados de{" "}
              <strong className="text-white">{confirmacaoLGPD.eleitorNome}</strong>?
            </p>
            <p className="text-xs text-white/30">
              O registro será removido definitivamente do sistema em conformidade com o Art. 18 da LGPD.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmacaoLGPD(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { processarLGPD(confirmacaoLGPD, "processado"); setConfirmacaoLGPD(null); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                Excluir permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where, doc, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppUser } from "@/types";
import { isAssessor, isSuperOrMaster } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { registrarAtividade } from "@/lib/firestore";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserCheck, UserX, Loader2, Mail, Clock, ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import toast from "react-hot-toast";

const motivosRecusa = [
  { value: "incompleto", label: "Cadastro incompleto" },
  { value: "inconsistente", label: "Dados inconsistentes" },
  { value: "duplicado", label: "Cadastro duplicado" },
  { value: "invalido", label: "Informações inválidas" },
  { value: "regiao", label: "Região/equipe não definida" },
  { value: "perfil", label: "Perfil não aprovado" },
  { value: "correcao", label: "Necessita correção" },
  { value: "alinhamento", label: "Aguardando alinhamento" },
  { value: "reprovado", label: "Reprovado pela coordenação" },
  { value: "outro", label: "Outro motivo" },
];

export default function SolicitacoesPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [solicitacoes, setSolicitacoes] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [recusaModal, setRecusaModal] = useState<AppUser | null>(null);
  const [recusaMotivo, setRecusaMotivo] = useState("");
  const [recusaJustificativa, setRecusaJustificativa] = useState("");

  useEffect(() => {
    if (userData && !isSuperOrMaster(userData) && !isAssessor(userData)) { router.push("/dashboard"); return; }
    load();
  }, [userData]);

  async function load() {
    try {
      const q = query(collection(db, "usuarios"), where("role", "==", "colaborador"), where("status", "in", ["pendente", "recusado"]));
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser));
      data.sort((a, b) => new Date(b.criadoEm || 0).getTime() - new Date(a.criadoEm || 0).getTime());
      setSolicitacoes(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleAprovar(s: AppUser) {
    setProcessingId(s.uid);
    try {
      const cred = await createUserWithEmailAndPassword(auth, s.email, "111111");
      await updateDoc(doc(db, "usuarios", s.uid), {
        uid: cred.user.uid,
        status: "ativo",
        ativo: true,
      });
      await registrarAtividade({
        acao: "aprovou_colaborador", usuarioId: userData!.uid, usuarioNome: userData!.nome,
        usuarioRole: userData!.role, detalhes: `Aprovou colaborador ${s.nome} (solicitado por ${s.solicitadoPorNome || "N/I"})`,
      });
      toast.success(`${s.nome} aprovado! Conta criada com senha 111111`);
      load();
    } catch (e: any) {
      toast.error(e.code === "auth/email-already-in-use" ? "Email já está em uso por outra conta" : "Erro ao aprovar");
    } finally { setProcessingId(null); }
  }

  async function handleRecusar() {
    if (!recusaModal || !recusaMotivo) { toast.error("Selecione um motivo"); return; }
    setProcessingId(recusaModal.uid);
    try {
      const updateData: Record<string, any> = {
        status: "recusado",
        recusaMotivo: recusaMotivo,
        ativo: false,
      };
      if (recusaJustificativa) updateData.recusaJustificativa = recusaJustificativa;
      await updateDoc(doc(db, "usuarios", recusaModal.uid), updateData);
      await registrarAtividade({
        acao: "recusou_colaborador", usuarioId: userData!.uid, usuarioNome: userData!.nome,
        usuarioRole: userData!.role, detalhes: `Recusou colaborador ${recusaModal.nome}: ${motivosRecusa.find(m => m.value === recusaMotivo)?.label}${recusaJustificativa ? ` - ${recusaJustificativa}` : ""}`,
      });
      toast.success("Colaborador recusado");
      setRecusaModal(null);
      setRecusaMotivo("");
      setRecusaJustificativa("");
      load();
    } catch (e) { toast.error("Erro ao recusar"); } finally { setProcessingId(null); }
  }

  if (!userData || (!isSuperOrMaster(userData) && !isAssessor(userData))) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="lg:pl-[260px] transition-all duration-300 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8 pt-20 lg:pt-8 max-w-7xl mx-auto">
          <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-lg">
          <Clock size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Solicitações</h1>
          <p className="text-sm text-purple-400">Aprove ou recuse novos colaboradores</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-purple-500" /></div>
      ) : (
        <div className="space-y-4">
          {solicitacoes.map((s) => (
            <GlassCard key={s.uid} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg ${
                    s.status === "pendente" ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"
                  }`}>
                    {s.nome.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-semibold">{s.nome}</h3>
                      <Badge variant={s.status === "pendente" ? "warning" : "danger"}>
                        {s.status === "pendente" ? "Pendente" : "Recusado"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Mail size={12} className="text-white/30" />
                      <span className="text-sm text-white/50">{s.email}</span>
                    </div>
                    {s.solicitadoPorNome && (
                      <p className="text-xs text-white/40 mt-1">
                        Solicitado por: <span className="text-white/60">{s.solicitadoPorNome}</span>
                      </p>
                    )}
                    <p className="text-xs text-white/30 mt-0.5">Criado em: {formatDate(s.criadoEm)}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
                      {s.telefone && <span>📞 {s.telefone}</span>}
                      {s.tipoDocumento && <span>🆔 {s.tipoDocumento.toUpperCase()}: {s.documento}</span>}
                      {s.cidade && s.estado && <span>📍 {s.cidade}/{s.estado}</span>}
                      {s.bairro && <span>🏘️ {s.bairro}</span>}
                      {s.observacoes && <span className="w-full text-white/40 italic mt-1">"{s.observacoes}"</span>}
                    </div>
                    {s.status === "recusado" && s.recusaMotivo && (
                      <div className="mt-2 p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                        <div className="flex items-center gap-1.5 text-red-400 text-xs font-medium mb-1">
                          <MessageSquare size={12} /> Motivo da recusa:
                        </div>
                        <p className="text-sm text-red-300">{motivosRecusa.find(m => m.value === s.recusaMotivo)?.label || s.recusaMotivo}</p>
                        {s.recusaJustificativa && (
                          <p className="text-xs text-red-400/70 mt-1 italic">"{s.recusaJustificativa}"</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {s.status === "pendente" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="primary"
                      onClick={() => handleAprovar(s)}
                      loading={processingId === s.uid}
                    >
                      <ThumbsUp size={16} /> Aprovar
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => { setRecusaModal(s); setRecusaMotivo(""); setRecusaJustificativa(""); }}
                    >
                      <ThumbsDown size={16} /> Recusar
                    </Button>
                  </div>
                )}
              </div>
            </GlassCard>
          ))}
          {solicitacoes.length === 0 && (
            <EmptyState icon="✅" title="Nenhuma solicitação pendente" description="Todas as solicitações de colaboradores foram aprovadas ou recusadas" />
          )}
        </div>
      )}

      <Modal open={!!recusaModal} onClose={() => setRecusaModal(null)} title="Recusar Colaborador">
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            Recusar <span className="text-white font-medium">{recusaModal?.nome}</span>
          </p>
          <Select
            label="Motivo da recusa"
            value={recusaMotivo}
            onChange={(e) => setRecusaMotivo(e.target.value)}
            options={motivosRecusa}
          />
          {recusaMotivo === "outro" && (
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Descreva o motivo</label>
              <textarea
                value={recusaJustificativa}
                onChange={(e) => setRecusaJustificativa(e.target.value)}
                placeholder="Explique o motivo da recusa..."
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all min-h-[80px]"
              />
            </div>
          )}
          {recusaMotivo && recusaMotivo !== "outro" && (
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Complemento (opcional)</label>
              <textarea
                value={recusaJustificativa}
                onChange={(e) => setRecusaJustificativa(e.target.value)}
                placeholder="Detalhes adicionais..."
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all min-h-[60px]"
              />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="danger" onClick={handleRecusar} loading={processingId === recusaModal?.uid} disabled={!recusaMotivo}>
              <ThumbsDown size={16} /> Confirmar Recusa
            </Button>
            <Button variant="ghost" onClick={() => setRecusaModal(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
        </div>
      </div>
    </main>
  </div>
  );
}

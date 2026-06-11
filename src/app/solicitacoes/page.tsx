"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where, doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { createAuthUser, db } from "@/lib/firebase";
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
  const [cadeiaMap, setCadeiaMap] = useState<Record<string, { coordenadorNome?: string; assessorNome?: string; campanhaNome?: string }>>({});
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
    if (!userData) return;
    try {
      let data: AppUser[] = [];
      if (isAssessor(userData)) {
        const coordSnap = await getDocs(
          query(collection(db, "usuarios"), where("role", "==", "coordenador"), where("assessorId", "==", userData.uid))
        );
        const coordIds = coordSnap.docs.map((d) => d.id);
        if (coordIds.length > 0) {
          const campanhaId = userData?.campanhaId || userData?.gabineteId;
          const solSnap = campanhaId
            ? query(collection(db, "usuarios"), where("role", "==", "colaborador"), where("coordenadorId", "in", coordIds), where("campanhaId", "==", campanhaId))
            : query(collection(db, "usuarios"), where("role", "==", "colaborador"), where("coordenadorId", "in", coordIds));
          const snap = await getDocs(solSnap);
          data = snap.docs
            .map((d) => ({ uid: d.id, ...d.data() } as AppUser))
            .filter((u) => u.status === "pendente" || u.status === "recusado");
        }
      } else {
        const snap = await getDocs(
          query(collection(db, "usuarios"), where("role", "==", "colaborador"), where("status", "in", ["pendente", "recusado"]))
        );
        data = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser));
      }
      data.sort((a, b) => new Date(b.criadoEm || 0).getTime() - new Date(a.criadoEm || 0).getTime());
      setSolicitacoes(data);

      // Resolver cadeia hierárquica para exibição nos cards
      const uniqueCoordIds = [...new Set(data.map((d) => d.coordenadorId).filter(Boolean))] as string[];
      if (uniqueCoordIds.length > 0) {
        const coordDocs = await Promise.all(uniqueCoordIds.map((id) => getDoc(doc(db, "usuarios", id))));
        const novasCadeias: Record<string, { coordenadorNome?: string; assessorNome?: string; campanhaNome?: string }> = {};
        const uniqueAssessorIds = new Set<string>();
        const uniqueCampanhaIds = new Set<string>();

        coordDocs.forEach((d) => {
          if (d.exists()) {
            const cData = d.data();
            novasCadeias[d.id] = { coordenadorNome: cData.nome || "" };
            if (cData.assessorId) uniqueAssessorIds.add(cData.assessorId);
            const cId = cData.campanhaId || cData.gabineteId;
            if (cId) uniqueCampanhaIds.add(cId);
          }
        });

        const [assessorDocs, campanhaDocs] = await Promise.all([
          Promise.all([...uniqueAssessorIds].map((id) => getDoc(doc(db, "usuarios", id)))),
          Promise.all([...uniqueCampanhaIds].map((id) => getDoc(doc(db, "campanhas", id)))),
        ]);

        const assessorNomes: Record<string, string> = {};
        assessorDocs.forEach((d) => { if (d.exists()) assessorNomes[d.id] = d.data().nome || ""; });

        const campanhaNomes: Record<string, string> = {};
        campanhaDocs.forEach((d) => { if (d.exists()) campanhaNomes[d.id] = d.data().nome || ""; });

        coordDocs.forEach((d) => {
          if (d.exists() && novasCadeias[d.id]) {
            const cData = d.data();
            if (cData.assessorId) novasCadeias[d.id].assessorNome = assessorNomes[cData.assessorId] || undefined;
            const cId = cData.campanhaId || cData.gabineteId;
            if (cId) novasCadeias[d.id].campanhaNome = campanhaNomes[cId] || undefined;
          }
        });

        setCadeiaMap(novasCadeias);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleAprovar(s: AppUser) {
    setProcessingId(s.uid);
    setSolicitacoes((prev) => prev.filter((x) => x.uid !== s.uid));
    try {
      // Passo 1: assessor ainda autenticado — marca pendente como aprovado
      await updateDoc(doc(db, "usuarios", s.uid), { status: "aprovado" });

      // Passo 2+3: cria conta Auth e perfil via app secundário (sessão principal preservada)
      const { uid: _oldUid, status: _st, solicitadoPor: _sp, solicitadoPorNome: _spn, ...dadosBase } = s as any;
      await createAuthUser(s.email, "111111", {
        ...dadosBase,
        status: "ativo",
        ativo: true,
      });

      await registrarAtividade({
        acao: "aprovou_colaborador", usuarioId: userData!.uid, usuarioNome: userData!.nome,
        usuarioRole: userData!.role, detalhes: `Aprovou colaborador ${s.nome} (solicitado por ${s.solicitadoPorNome || "N/I"})`,
      });
      toast.success(`${s.nome} aprovado! Conta criada com senha 111111`);
    } catch (e: any) {
      setSolicitacoes((prev) => [s, ...prev]);
      toast.error(e.code === "auth/email-already-in-use" ? "Email já está em uso por outra conta" : "Erro ao aprovar");
    } finally { setProcessingId(null); }
  }

  async function handleRecusar() {
    if (!recusaModal || !recusaMotivo) { toast.error("Selecione um motivo"); return; }
    const original = recusaModal;
    const motivo = recusaMotivo;
    const justificativa = recusaJustificativa;
    setProcessingId(original.uid);
    setSolicitacoes((prev) => prev.map((x) => x.uid === original.uid
      ? { ...x, status: "recusado" as const, recusaMotivo: motivo, recusaJustificativa: justificativa || undefined }
      : x
    ));
    setRecusaModal(null);
    setRecusaMotivo("");
    setRecusaJustificativa("");
    try {
      const updateData: Record<string, any> = { status: "recusado", recusaMotivo: motivo, ativo: false };
      if (justificativa) updateData.recusaJustificativa = justificativa;
      await updateDoc(doc(db, "usuarios", original.uid), updateData);
      await registrarAtividade({
        acao: "recusou_colaborador", usuarioId: userData!.uid, usuarioNome: userData!.nome,
        usuarioRole: userData!.role, detalhes: `Recusou colaborador ${original.nome}: ${motivosRecusa.find(m => m.value === motivo)?.label}${justificativa ? ` - ${justificativa}` : ""}`,
      });
      toast.success("Colaborador recusado");
    } catch (e) {
      setSolicitacoes((prev) => prev.map((x) => x.uid === original.uid ? original : x));
      toast.error("Erro ao recusar");
    } finally { setProcessingId(null); }
  }

  if (!userData) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="animate-spin h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
  );
  if (!isSuperOrMaster(userData) && !isAssessor(userData)) return null;

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
                    {s.coordenadorId && cadeiaMap[s.coordenadorId] && (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                        {cadeiaMap[s.coordenadorId].coordenadorNome && (
                          <span className="text-white/35">Coord: <span className="text-white/55">{cadeiaMap[s.coordenadorId].coordenadorNome}</span></span>
                        )}
                        {cadeiaMap[s.coordenadorId].assessorNome && (
                          <span className="text-white/35">Assessoria: <span className="text-white/55">{cadeiaMap[s.coordenadorId].assessorNome}</span></span>
                        )}
                        {cadeiaMap[s.coordenadorId].campanhaNome && (
                          <span className="text-white/35">Campanha: <span className="text-emerald-400/60">{cadeiaMap[s.coordenadorId].campanhaNome}</span></span>
                        )}
                      </div>
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

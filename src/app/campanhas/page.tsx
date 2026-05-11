"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where, addDoc, serverTimestamp, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Gabinete, ROLE_CONFIG } from "@/types";
import { isSuperOrMaster, getRoleConfig } from "@/lib/permissions";
import { getPartyColors } from "@/lib/reports";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Building2, UserPlus, Globe, Plus, Power, Pencil, Trash2, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { formatDate } from "@/lib/utils";
import { registrarAtividade } from "@/lib/firestore";
import { Modal } from "@/components/ui/Modal";

const cargosOptions = [
  { value: "governador", label: "Governador" },
  { value: "senador", label: "Senador" },
  { value: "deputado_federal", label: "Deputado Federal" },
  { value: "deputado_estadual", label: "Deputado Estadual" },
  { value: "prefeito", label: "Prefeito" },
  { value: "vice_prefeito", label: "Vice-Prefeito" },
  { value: "vereador", label: "Vereador" },
];

const nivelOptions = [
  { value: "federal", label: "Federal" },
  { value: "estadual", label: "Estadual" },
  { value: "municipal", label: "Municipal" },
];

const cicloOptions = [
  { value: "estadual_federal_2026", label: "Estadual/Federal 2026" },
  { value: "municipal_2028", label: "Municipal 2028" },
];

const partidosPrincipais = [
  "PT", "PL", "MDB", "PSDB", "UNIÃO", "PSD", "PP", "PDT", "REPUBLICANOS",
  "PSOL", "PV", "CIDADANIA", "SOLIDARIEDADE", "PSC", "PODE", "AVANTE",
  "PCB", "PCO", "DC", "NOVO", "PMN", "PRTB", "PSB", "PSTU", "REDE", "UP",
];

function gerarSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function GabinetesPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [gabinetes, setGabinetes] = useState<Gabinete[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    nome: "", slug: "",
    politicoNome: "", politicoEmail: "", politicoSenha: "",
    assessorNome: "", assessorEmail: "", assessorSenha: "",
    cargo: "", nivelPolitico: "", cicloEleitoral: "", parentGabineteId: "", partido: "", partidoOutro: "", slogan: "", corPrincipal: "#8b5cf6",
  });

  function handleNomeChange(nome: string) {
    const slug = gerarSlug(nome);
    setForm((f) => ({ ...f, nome, slug }));
  }
  const [saving, setSaving] = useState(false);
  const [eleitorCounts, setEleitorCounts] = useState<Record<string, number>>({});
  const [editModal, setEditModal] = useState<Gabinete | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", slug: "", cargo: "", slogan: "", corPrincipal: "#8b5cf6" });

  useEffect(() => {
    if (userData && !isSuperOrMaster(userData)) { router.push("/dashboard"); return; }
    loadData();
  }, [userData]);

  async function loadData() {
    try {
      const q = query(collection(db, "campanhas"), orderBy("criadoEm", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Gabinete));
      setGabinetes(data);
      const counts: Record<string, number> = {};
      for (const g of data) {
        const eq = query(collection(db, "eleitores"), where("campanhaId", "==", g.id));
        const esnap = await getDocs(eq);
        counts[g.id!] = esnap.size;
      }
      setEleitorCounts(counts);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.slug || !form.politicoNome || !form.politicoEmail || !form.politicoSenha || !form.cargo || !form.nivelPolitico || !form.cicloEleitoral || !form.assessorNome || !form.assessorEmail || !form.assessorSenha) {
      toast.error("Preencha todos os campos obrigatórios (político e assessor)");
      return;
    }
    setSaving(true);
    try {
      const partidoFinal = form.partido === "__outro__" ? form.partidoOutro : form.partido;
      const dadosGabinete: Record<string, any> = {
        nome: form.nome, slug: form.slug, politicoNome: form.politicoNome, politicoEmail: form.politicoEmail,
        politicoPartido: partidoFinal, cargo: form.cargo, nivelPolitico: form.nivelPolitico,
        cicloEleitoral: form.cicloEleitoral,
        slogan: form.slogan, corPrincipal: form.corPrincipal,
        ativo: true, criadoEm: serverTimestamp(), criadoPor: userData?.uid,
      };
      if (form.parentGabineteId) dadosGabinete.parentGabineteId = form.parentGabineteId;
      const gabineteId = await addDoc(collection(db, "campanhas"), dadosGabinete);

      // Criar conta do POLÍTICO (visão executiva)
      const credPolitico = await createUserWithEmailAndPassword(auth, form.politicoEmail, form.politicoSenha);
      await setDoc(doc(db, "usuarios", credPolitico.user.uid), {
        email: form.politicoEmail, nome: form.politicoNome, role: "politico",
        gabineteId: gabineteId.id, ativo: true, criadoEm: new Date(), criadoPor: userData?.uid,
      });

      // Criar conta do ASSESSOR PRINCIPAL (operacional)
      const credAssessor = await createUserWithEmailAndPassword(auth, form.assessorEmail, form.assessorSenha);
      await setDoc(doc(db, "usuarios", credAssessor.user.uid), {
        email: form.assessorEmail, nome: form.assessorNome, role: "assessor",
        gabineteId: gabineteId.id, ativo: true, criadoEm: new Date(), criadoPor: userData?.uid,
      });

      await registrarAtividade({
        acao: "criar_gabinete", usuarioId: userData!.uid, usuarioNome: userData!.nome,
        usuarioRole: "super_admin", detalhes: `Criou gabinete ${form.nome} para ${form.politicoNome}`,
      });

      toast.success("Gabinete criado com sucesso! Duas contas geradas: Político e Assessor.");
      setShowForm(false);
      setForm({
        nome: "", slug: "",
        politicoNome: "", politicoEmail: "", politicoSenha: "",
        assessorNome: "", assessorEmail: "", assessorSenha: "",
        cargo: "", nivelPolitico: "", cicloEleitoral: "", parentGabineteId: "", partido: "", partidoOutro: "", slogan: "", corPrincipal: "#8b5cf6",
      });
      setShowForm(false);
      loadData();
    } catch (error: any) { console.error("ERRO AO CRIAR GABINETE:", error); toast.error(error.code === "auth/email-already-in-use" ? "Email já está em uso" : `Erro: ${error.message || "Erro ao criar gabinete"}`); } finally { setSaving(false); }
  }

  async function toggleGabinete(id: string, ativo: boolean) {
    try { await updateDoc(doc(db, "campanhas", id), { ativo: !ativo }); toast.success(`Gabinete ${ativo ? "desativado" : "ativado"}`); loadData(); } catch (e) { toast.error("Erro"); }
  }

  async function excluirGabinete(id: string, nome: string) {
    if (!confirm(`Tem certeza que deseja EXCLUIR permanentemente o gabinete "${nome}"?\n\nEsta ação não pode ser desfeita. Todos os dados vinculados (eleitores, candidatos, etc.) serão mantidos, mas o gabinete será removido da plataforma.`)) return;
    try {
      await deleteDoc(doc(db, "campanhas", id));
      await registrarAtividade({ acao: "excluiu_gabinete", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Excluiu gabinete ${nome}` });
      toast.success("Gabinete excluído permanentemente!");
      loadData();
    } catch (e) { toast.error("Erro ao excluir gabinete"); }
  }

  function openEdit(g: Gabinete) {
    setEditForm({ nome: g.nome, slug: g.slug, cargo: g.cargo, slogan: g.slogan || "", corPrincipal: g.corPrincipal || "#8b5cf6" });
    setEditModal(g);
  }

  async function handleEdit() {
    if (!editModal?.id) return;
    try {
      await updateDoc(doc(db, "campanhas", editModal.id), { nome: editForm.nome, slug: editForm.slug, cargo: editForm.cargo, slogan: editForm.slogan, corPrincipal: editForm.corPrincipal });
      await registrarAtividade({ acao: "editou_gabinete", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: "super_admin", detalhes: `Editou gabinete ${editModal.nome}` });
      toast.success("Gabinete atualizado!"); setEditModal(null); loadData();
    } catch (e) { toast.error("Erro ao atualizar"); }
  }

  if (!userData || !isSuperOrMaster(userData)) return null;
  const config = getRoleConfig(userData);

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-lg">🔱</div>
        <div>
          <h1 className="text-2xl font-bold text-white">Gabinetes</h1>
          <p className="text-sm text-rose-400">Gerencie todas as estruturas políticas da plataforma</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setShowForm(!showForm)}><Plus size={18} />{showForm ? "Cancelar" : "Novo Gabinete"}</Button>
      </div>

      {showForm && (
        <GlassCard className="p-5">
          <h3 className="text-white font-semibold mb-4">Criar Novo Gabinete</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input label="Nome do Gabinete *" value={form.nome} onChange={(e) => handleNomeChange(e.target.value)} placeholder="Ex: Gabinete do Vereador" />
            <Input label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="Gerado automaticamente" disabled />
            <Select label="Cargo *" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} options={cargosOptions} />
            <Select label="Nível Político *" value={form.nivelPolitico} onChange={(e) => setForm({ ...form, nivelPolitico: e.target.value })} options={nivelOptions} />
            <Select label="Ciclo Eleitoral *" value={form.cicloEleitoral} onChange={(e) => setForm({ ...form, cicloEleitoral: e.target.value })} options={cicloOptions} />
            <Select label="Partido" value={form.partido} onChange={(e) => setForm({ ...form, partido: e.target.value, partidoOutro: "" })} options={[{ value: "", label: "Selecione..." }, ...partidosPrincipais.map((p) => ({ value: p, label: p })), { value: "__outro__", label: "Outro (digitar manualmente)" }]} />
            {form.partido === "__outro__" && (
              <Input label="Digite o partido" value={form.partidoOutro} onChange={(e) => setForm({ ...form, partidoOutro: e.target.value })} placeholder="Ex: Partido Novo" />
            )}
            <Select label="Vinculado a (opcional)" value={form.parentGabineteId} onChange={(e) => setForm({ ...form, parentGabineteId: e.target.value })} options={gabinetes.filter((g) => g.id !== form.slug).map((g) => ({ value: g.id!, label: `${g.nome} (${g.cargo})` }))} emptyMessage="Nenhum gabinete disponível. Crie primeiro o gabinete superior." />
            <Input label="Slogan" value={form.slogan} onChange={(e) => setForm({ ...form, slogan: e.target.value })} placeholder="Slogan do gabinete" />

            {/* SEÇÃO: Dados do Político */}
            <div className="md:col-span-3 border-t border-white/[0.06] pt-4 mt-2">
              <p className="text-sm font-semibold text-amber-400 mb-3">🎤 Dados do Político (conta executiva)</p>
            </div>
            <Input label="Nome do Político *" value={form.politicoNome} onChange={(e) => setForm({ ...form, politicoNome: e.target.value })} placeholder="Nome do político" />
            <Input label="Email do Político *" type="email" value={form.politicoEmail} onChange={(e) => setForm({ ...form, politicoEmail: e.target.value })} placeholder="email@politico.com" />
            <Input label="Senha do Político *" type="password" value={form.politicoSenha} onChange={(e) => setForm({ ...form, politicoSenha: e.target.value })} placeholder="Mínimo 6 caracteres" />

            {/* SEÇÃO: Dados do Assessor Principal */}
            <div className="md:col-span-3 border-t border-white/[0.06] pt-4 mt-2">
              <p className="text-sm font-semibold text-purple-400 mb-3">🏛️ Dados do Assessor Principal (conta operacional)</p>
            </div>
            <Input label="Nome do Assessor *" value={form.assessorNome} onChange={(e) => setForm({ ...form, assessorNome: e.target.value })} placeholder="Nome do assessor" />
            <Input label="Email do Assessor *" type="email" value={form.assessorEmail} onChange={(e) => setForm({ ...form, assessorEmail: e.target.value })} placeholder="email@assessor.com" />
            <Input label="Senha do Assessor *" type="password" value={form.assessorSenha} onChange={(e) => setForm({ ...form, assessorSenha: e.target.value })} placeholder="Mínimo 6 caracteres" />

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Cor Principal</label>
              <input type="color" value={form.corPrincipal} onChange={(e) => setForm({ ...form, corPrincipal: e.target.value })} className="w-full h-10 bg-white/5 border border-white/10 rounded-xl cursor-pointer" />
            </div>
            <div className="md:col-span-2 lg:col-span-3"><Button type="submit" loading={saving}><UserPlus size={18} />{saving ? "Criando..." : "Criar Gabinete"}</Button></div>
          </form>
        </GlassCard>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><svg className="animate-spin h-8 w-8 text-rose-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gabinetes.map((g) => (
            <GlassCard key={g.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: `#${getPartyColors(g.politicoPartido).p}` }}>{g.nome.charAt(0)}</div>
                  <div>
                    <h3 className="text-white font-semibold">{g.nome}</h3>
                    <p className="text-xs text-white/40">{g.cargo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => window.open(`/gabinete/${g.id}`, "_blank")} className="text-white/30 hover:text-emerald-400 transition-colors" title="Abrir painel do gabinete"><ExternalLink size={14} /></button>
                  <button onClick={() => openEdit(g)} className="text-white/30 hover:text-amber-400 transition-colors" title="Editar"><Pencil size={14} /></button>
                  <button onClick={() => excluirGabinete(g.id!, g.nome)} className="text-white/30 hover:text-red-400 transition-colors" title="Excluir"><Trash2 size={14} /></button>
                  <Badge variant={g.ativo ? "success" : "default"}>{g.ativo ? "Ativo" : "Inativo"}</Badge>
                </div>
              </div>
              <div className="text-sm text-white/60 mb-3">
                <p>🎯 {g.politicoNome}</p>
                <p>📧 {g.politicoEmail}</p>
                {g.politicoPartido && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `#${getPartyColors(g.politicoPartido).a}`, color: `#${getPartyColors(g.politicoPartido).d}` }}>
                    🏛️ {g.politicoPartido}
                  </span>
                )}
                {g.slogan && <p className="text-white/40 text-xs mt-1 italic">"{g.slogan}"</p>}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                <span className="text-sm text-white/50"><Globe size={14} className="inline mr-1" />{eleitorCounts[g.id!] || 0} eleitores</span>
                <button onClick={() => toggleGabinete(g.id!, g.ativo)} className={`text-xs ${g.ativo ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"} transition-colors`}>
                  <Power size={14} className="inline mr-1" />{g.ativo ? "Desativar" : "Ativar"}
                </button>
              </div>
            </GlassCard>
          ))}
          {gabinetes.length === 0 && <p className="col-span-full text-center text-white/30 py-12">Nenhum gabinete cadastrado</p>}
        </div>
      )}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Editar Gabinete">
        <div className="space-y-4">
          <Input label="Nome do Gabinete" value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
          <Input label="Slug" value={editForm.slug} onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })} />
          <Input label="Cargo" value={editForm.cargo} onChange={(e) => setEditForm({ ...editForm, cargo: e.target.value })} />
          <Input label="Slogan" value={editForm.slogan} onChange={(e) => setEditForm({ ...editForm, slogan: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Cor Principal</label>
            <input type="color" value={editForm.corPrincipal} onChange={(e) => setEditForm({ ...editForm, corPrincipal: e.target.value })} className="w-full h-10 bg-white/5 border border-white/10 rounded-xl cursor-pointer" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleEdit} className="flex-1">Salvar Alterações</Button>
            <Button variant="ghost" onClick={() => setEditModal(null)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

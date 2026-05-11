"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { buscarCandidatos, cadastrarCandidato, importarCandidatos, registrarAtividade } from "@/lib/firestore";
import { Candidato } from "@/types";
import { isSuperOrMaster, isAssessor } from "@/lib/permissions";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { UserPlus, Upload, FileSpreadsheet, Loader2, Plus, Trash2, HelpCircle } from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

export default function CandidatosPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{ nome: string; partido: string; numero: string; cargo: string; ativo: boolean }[]>([]);
  const [form, setForm] = useState({ nome: "", partido: "", numero: "", cargo: "" });
  const [showAjuda, setShowAjuda] = useState(false);

  useEffect(() => {
    if (userData && !isSuperOrMaster(userData) && !isAssessor(userData) && !isAssessor(userData)) {
      router.push("/dashboard");
      return;
    }
    load();
  }, [userData]);

  async function load() {
    if (!userData?.gabineteId && !userData?.campanhaId) { setLoading(false); return; }
    try {
      const data = await buscarCandidatos(userData.gabineteId || userData.campanhaId!);
      setCandidatos(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const gabineteId = userData?.gabineteId || userData?.campanhaId || "";
    if (!gabineteId || !form.nome || !form.partido || !form.numero || !form.cargo) {
      toast.error("Preencha todos os campos");
      return;
    }
    setSaving(true);
    try {
      await cadastrarCandidato({
        gabineteId, nome: form.nome,
        partido: form.partido, numero: form.numero, cargo: form.cargo, ativo: true,
      });
      await registrarAtividade({
        acao: "criar_candidato", usuarioId: userData!.uid, usuarioNome: userData!.nome,
        usuarioRole: userData!.role, detalhes: `Cadastrou candidato ${form.nome}`,
      });
      toast.success("Candidato cadastrado!");
      setForm({ nome: "", partido: "", numero: "", cargo: "" });
      setShowForm(false);
      load();
    } catch (e) { toast.error("Erro ao cadastrar"); } finally { setSaving(false); }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
        const parsed = rows.map((r: any) => ({
          nome: String(r.Nome || r.nome || "").trim(),
          partido: String(r.Partido || r.partido || "").trim(),
          numero: String(r.Numero || r.numero || "").trim(),
          cargo: String(r.Cargo || r.cargo || "").trim(),
          ativo: true,
        })).filter((r) => r.nome);
        if (parsed.length === 0) { toast.error("Nenhum dado válido encontrado na planilha"); return; }
        setPreview(parsed);
        toast.success(`${parsed.length} candidatos detectados`);
      } catch { toast.error("Erro ao ler planilha"); }
    };
    reader.readAsArrayBuffer(file);
  }

  async function confirmImport() {
    if ((!userData?.gabineteId && !userData?.campanhaId) || preview.length === 0) return;
    setImporting(true);
    try {
      await importarCandidatos(userData.gabineteId || userData.campanhaId!, preview);
      await registrarAtividade({
        acao: "importar_candidatos", usuarioId: userData.uid, usuarioNome: userData.nome,
        usuarioRole: userData.role, detalhes: `Importou ${preview.length} candidatos via planilha`,
      });
      toast.success(`${preview.length} candidatos importados!`);
      setPreview([]);
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (e) { toast.error("Erro ao importar"); } finally { setImporting(false); }
  }

  const podeGerenciar = isSuperOrMaster(userData) || isAssessor(userData) || isAssessor(userData);

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Candidatos</h1>
          <p className="text-white/50 text-sm mt-1">Gerencie os candidatos do gabinete</p>
        </div>
        {podeGerenciar && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setShowAjuda(true)} title="Ver formato da planilha">
              <HelpCircle size={16} /> Modelo
            </Button>
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Importar Planilha
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus size={18} /> {showForm ? "Cancelar" : "Novo Candidato"}
            </Button>
          </div>
        )}
      </div>

      {showForm && (
        <GlassCard className="p-5">
          <h3 className="text-white font-semibold mb-4">Novo Candidato</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input label="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do candidato" />
            <Input label="Partido *" value={form.partido} onChange={(e) => setForm({ ...form, partido: e.target.value })} placeholder="Ex: PT, PSDB..." />
            <Input label="Número *" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="Número de campanha" />
            <Input label="Cargo *" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} placeholder="Ex: Vereador" />
            <div className="md:col-span-2 lg:col-span-4"><Button type="submit" loading={saving}><UserPlus size={18} /> {saving ? "Salvando..." : "Cadastrar"}</Button></div>
          </form>
        </GlassCard>
      )}

      {preview.length > 0 && (
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-emerald-400" />
              Pré-visualização ({preview.length} candidatos)
            </h3>
            <div className="flex items-center gap-2">
              <Button onClick={confirmImport} loading={importing} variant="danger">
                <Upload size={16} /> {importing ? "Importando..." : "Confirmar Importação"}
              </Button>
              <Button variant="ghost" onClick={() => { setPreview([]); if (fileRef.current) fileRef.current.value = ""; }}>
                Cancelar
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-60 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 border-b border-white/[0.06]">
                  <th className="text-left py-2 px-2 font-medium">Nome</th>
                  <th className="text-left py-2 px-2 font-medium">Partido</th>
                  <th className="text-left py-2 px-2 font-medium">Número</th>
                  <th className="text-left py-2 px-2 font-medium">Cargo</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((c, i) => (
                  <tr key={i} className="border-b border-white/[0.03]">
                    <td className="py-2 px-2 text-white/80">{c.nome}</td>
                    <td className="py-2 px-2 text-white/60">{c.partido}</td>
                    <td className="py-2 px-2 text-white/60">{c.numero}</td>
                    <td className="py-2 px-2 text-white/60">{c.cargo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-emerald-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {candidatos.map((c) => (
            <GlassCard key={c.id} className="p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-white font-semibold text-lg">{c.nome}</h3>
                <Badge>{c.partido}</Badge>
              </div>
              <div className="text-sm text-white/60 space-y-1">
                <p>Nº <span className="text-white/80 font-mono">{c.numero}</span></p>
                <p>Cargo: {c.cargo}</p>
              </div>
            </GlassCard>
          ))}
          {candidatos.length === 0 && !loading && (
            <p className="col-span-full text-center text-white/30 py-12">
              Nenhum candidato cadastrado. {podeGerenciar && "Crie um novo ou importe via planilha."}
            </p>
          )}
        </div>
      )}

      <Modal open={showAjuda} onClose={() => setShowAjuda(false)} title="Formato da Planilha">
        <div className="space-y-4 text-sm">
          <p className="text-white/70">
            A planilha deve conter as colunas abaixo. O sistema identifica automaticamente pelos nomes das colunas (não diferencia maiúsculo/minúsculo).
          </p>
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5">
                  <th className="text-left py-2.5 px-3 text-emerald-400 font-medium">Nome</th>
                  <th className="text-left py-2.5 px-3 text-emerald-400 font-medium">Partido</th>
                  <th className="text-left py-2.5 px-3 text-emerald-400 font-medium">Número</th>
                  <th className="text-left py-2.5 px-3 text-emerald-400 font-medium">Cargo</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-white/[0.06]">
                  <td className="py-2.5 px-3 text-white/80">João Silva</td>
                  <td className="py-2.5 px-3 text-white/60">PT</td>
                  <td className="py-2.5 px-3 text-white/60">13123</td>
                  <td className="py-2.5 px-3 text-white/60">Vereador</td>
                </tr>
                <tr className="border-t border-white/[0.06]">
                  <td className="py-2.5 px-3 text-white/80">Maria Souza</td>
                  <td className="py-2.5 px-3 text-white/60">PSDB</td>
                  <td className="py-2.5 px-3 text-white/60">45123</td>
                  <td className="py-2.5 px-3 text-white/60">Prefeito</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-white/5 rounded-xl p-3 space-y-1.5">
            <p className="text-white/60">📌 <span className="text-white/80">Formatos aceitos:</span> .xlsx, .xls, .csv</p>
            <p className="text-white/60">📌 <span className="text-white/80">Colunas obrigatórias:</span> Nome, Partido, Número, Cargo</p>
            <p className="text-white/60">📌 <span className="text-white/80">Dica:</span> Crie no Excel as 4 colunas, preencha os dados e salve como .xlsx</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { cadastrarEleitor, buscarEleitores, verificarTituloDuplicado, registrarAtividade, excluirEleitor } from "@/lib/firestore";
import { estados, cidades } from "@/lib/estados-cidades";
import { Eleitor } from "@/types";
import { formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { UserPlus, Search, Trash2, Loader2, Edit3, Pencil } from "lucide-react";
import { EditarEleitorModal } from "@/components/forms/EditarEleitorModal";
import toast from "react-hot-toast";
import { isSuperAdmin, isAdmin, isPolitico, isCoordenador, isColaborador, getRoleConfig } from "@/lib/permissions";

const grauOptions = [
  { value: "forte", label: "Forte" },
  { value: "medio", label: "Médio" },
  { value: "fraco", label: "Fraco" },
  { value: "indeciso", label: "Indeciso" },
];

export default function EleitoresPage() {
  const { userData } = useAuth();
  const [form, setForm] = useState({ nomeCompleto: "", telefone: "", tituloEleitoral: "", estado: "", cidade: "", bairro: "", grauApoio: "", observacoes: "" });
  const [cidadesDisponiveis, setCidadesDisponiveis] = useState<string[]>([]);
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editingEleitor, setEditingEleitor] = useState<Eleitor | null>(null);

  useEffect(() => { loadEleitores(); }, [userData]);

  async function loadEleitores() {
    setLoading(true);
    try {
      const campanhaId = isSuperAdmin(userData) ? undefined : userData?.campanhaId;
      const colaboradorId = isColaborador(userData) ? userData?.uid : undefined;
      const data = await buscarEleitores(campanhaId, colaboradorId);
      setEleitores(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  function handleEstadoChange(sigla: string) {
    setForm({ ...form, estado: sigla, cidade: "" });
    setCidadesDisponiveis(cidades[sigla] || []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userData) return;
    if (!form.nomeCompleto || !form.telefone || !form.tituloEleitoral || !form.estado || !form.cidade || !form.grauApoio) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const duplicado = await verificarTituloDuplicado(form.tituloEleitoral);
      if (duplicado) { toast.error("Título eleitoral já cadastrado!"); setSaving(false); return; }
      await cadastrarEleitor({
        campanhaId: userData.campanhaId || "",
        nomeCompleto: form.nomeCompleto, telefone: form.telefone, tituloEleitoral: form.tituloEleitoral,
        estado: form.estado, cidade: form.cidade, bairro: form.bairro, grauApoio: form.grauApoio as any,
        observacoes: form.observacoes, colaboradorId: userData.uid, colaboradorNome: userData.nome,
        coordenadorId: userData.coordenadorId || userData.uid, coordenadorNome: userData.role === "coordenador" ? userData.nome : undefined,
      });
      await registrarAtividade({ acao: "cadastro_eleitor", usuarioId: userData.uid, usuarioNome: userData.nome, usuarioRole: userData.role, detalhes: `Cadastrou o eleitor ${form.nomeCompleto}` });
      toast.success("Eleitor cadastrado com sucesso!");
      setForm({ nomeCompleto: "", telefone: "", tituloEleitoral: "", estado: "", cidade: "", bairro: "", grauApoio: "", observacoes: "" });
      setCidadesDisponiveis([]);
      loadEleitores();
    } catch (e) { toast.error("Erro ao cadastrar eleitor"); } finally { setSaving(false); }
  }

  async function handleExcluir(id: string, nome: string) {
    if (!confirm(`Excluir ${nome}?`)) return;
    try { await excluirEleitor(id); toast.success("Eleitor excluído"); loadEleitores(); } catch (e) { toast.error("Erro ao excluir"); }
  }

  const filtered = eleitores.filter((e) => e.nomeCompleto.toLowerCase().includes(search.toLowerCase()) || e.cidade.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Cadastro de Eleitores</h1>
        <p className="text-white/50 text-sm mt-1">Cadastro rápido e simplificado para equipes de rua</p>
      </div>
      <GlassCard className="p-4 md:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input label="Nome Completo *" value={form.nomeCompleto} onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })} placeholder="Nome do eleitor" />
            <Input label="Telefone *" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(99) 99999-9999" />
            <Input label="Título Eleitoral *" value={form.tituloEleitoral} onChange={(e) => setForm({ ...form, tituloEleitoral: e.target.value })} placeholder="Número do título" />
            <Select label="Estado *" value={form.estado} onChange={(e) => handleEstadoChange(e.target.value)} options={estados.map((e) => ({ value: e.sigla, label: `${e.sigla} - ${e.nome}` }))} />
            <Select label="Cidade *" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} options={cidadesDisponiveis.map((c) => ({ value: c, label: c }))} disabled={!form.estado} />
            <Input label="Bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} placeholder="Bairro" />
            <Select label="Grau de Apoio *" value={form.grauApoio} onChange={(e) => setForm({ ...form, grauApoio: e.target.value })} options={grauOptions} />
            <div className="md:col-span-2 lg:col-span-1">
              <Input label="Observações" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Observações (opcional)" />
            </div>
          </div>
          <Button type="submit" loading={saving} className="w-full md:w-auto"><UserPlus size={18} />{saving ? "Salvando..." : "Cadastrar Eleitor"}</Button>
        </form>
      </GlassCard>
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar por nome ou cidade..." className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" />
        </div>
        <span className="text-sm text-white/40">{eleitores.length} registros</span>
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-emerald-500" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 border-b border-white/[0.06]">
                <th className="text-left py-3 px-2 font-medium">Nome</th>
                <th className="text-left py-3 px-2 font-medium">Telefone</th>
                <th className="text-left py-3 px-2 font-medium">Cidade/Estado</th>
                <th className="text-left py-3 px-2 font-medium">Grau</th>
                <th className="text-left py-3 px-2 font-medium">Colaborador</th>
                <th className="text-left py-3 px-2 font-medium">Data</th>
                {(isAdmin(userData) || isSuperAdmin(userData) || isPolitico(userData) || isCoordenador(userData)) && <th className="text-left py-3 px-2 font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((eleitor) => (
                <tr key={eleitor.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-2 text-white/80">{eleitor.nomeCompleto}</td>
                  <td className="py-3 px-2 text-white/60">{eleitor.telefone}</td>
                  <td className="py-3 px-2 text-white/60">{eleitor.cidade}/{eleitor.estado}</td>
                  <td className="py-3 px-2"><Badge variant={eleitor.grauApoio === "forte" ? "success" : eleitor.grauApoio === "medio" ? "warning" : eleitor.grauApoio === "fraco" ? "danger" : "info"}>{eleitor.grauApoio}</Badge></td>
                  <td className="py-3 px-2 text-white/60">{eleitor.colaboradorNome}</td>
                  <td className="py-3 px-2 text-white/40 text-xs">{formatDate(eleitor.criadoEm)}</td>
                  {(isAdmin(userData) || isSuperAdmin(userData) || isPolitico(userData) || isCoordenador(userData)) && (
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditingEleitor(eleitor)} className="text-white/30 hover:text-emerald-400 transition-colors" title="Editar">
                          <Pencil size={16} />
                        </button>
                        {(isAdmin(userData) || isSuperAdmin(userData)) && (
                          <button onClick={() => handleExcluir(eleitor.id!, eleitor.nomeCompleto)} className="text-white/30 hover:text-red-400 transition-colors" title="Excluir">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-white/30">{search ? "Nenhum resultado encontrado" : "Nenhum eleitor cadastrado ainda"}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {editingEleitor && (
        <EditarEleitorModal
          eleitor={editingEleitor}
          open={!!editingEleitor}
          onClose={() => setEditingEleitor(null)}
          onSaved={loadEleitores}
        />
      )}
    </div>
  );
}

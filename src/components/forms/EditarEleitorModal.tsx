"use client";

import { useState } from "react";
import { Eleitor } from "@/types";
import { atualizarEleitor, registrarAtividade } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { estados, cidades } from "@/lib/estados-cidades";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

interface Props {
  eleitor: Eleitor;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const grauOptions = [
  { value: "forte", label: "Forte" },
  { value: "medio", label: "Médio" },
  { value: "fraco", label: "Fraco" },
  { value: "indeciso", label: "Indeciso" },
];

export function EditarEleitorModal({ eleitor, open, onClose, onSaved }: Props) {
  const { userData } = useAuth();
  const [form, setForm] = useState({
    nomeCompleto: eleitor.nomeCompleto,
    telefone: eleitor.telefone,
    tituloEleitoral: eleitor.tituloEleitoral,
    estado: eleitor.estado,
    cidade: eleitor.cidade,
    bairro: eleitor.bairro,
    grauApoio: eleitor.grauApoio,
    observacoes: eleitor.observacoes,
    colaboradorNome: eleitor.colaboradorNome,
    coordenadorNome: eleitor.coordenadorNome || "",
  });
  const [cidadesLista, setCidadesLista] = useState(cidades[eleitor.estado] || []);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!userData || !eleitor.id) return;
    setSaving(true);
    try {
      await atualizarEleitor(eleitor.id, {
        nomeCompleto: form.nomeCompleto,
        telefone: form.telefone,
        tituloEleitoral: form.tituloEleitoral,
        estado: form.estado,
        cidade: form.cidade,
        bairro: form.bairro,
        grauApoio: form.grauApoio as any,
        observacoes: form.observacoes,
        colaboradorNome: form.colaboradorNome,
        coordenadorNome: form.coordenadorNome || undefined,
        editadoPor: userData.uid,
        editadoPorNome: userData.nome,
      });
      await registrarAtividade({
        acao: "editou_eleitor", usuarioId: userData.uid, usuarioNome: userData.nome,
        usuarioRole: userData.role, detalhes: `Editou eleitor ${eleitor.nomeCompleto}`,
      });
      toast.success("Eleitor atualizado!");
      onSaved();
      onClose();
    } catch (e) { toast.error("Erro ao atualizar"); } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Editar: ${eleitor.nomeCompleto}`}>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        <Select
          label="Grau de Apoio"
          value={form.grauApoio}
          onChange={(e) => setForm({ ...form, grauApoio: e.target.value as any })}
          options={grauOptions}
        />
        <Input label="Nome" value={form.nomeCompleto} onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })} />
        <Input label="Telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
        <Input label="Título Eleitoral" value={form.tituloEleitoral} onChange={(e) => setForm({ ...form, tituloEleitoral: e.target.value })} />
        <Select
          label="Estado"
          value={form.estado}
          onChange={(e) => { setForm({ ...form, estado: e.target.value, cidade: "" }); setCidadesLista(cidades[e.target.value] || []); }}
          options={estados.map((e) => ({ value: e.sigla, label: `${e.sigla} - ${e.nome}` }))}
        />
        <Select
          label="Cidade"
          value={form.cidade}
          onChange={(e) => setForm({ ...form, cidade: e.target.value })}
          options={cidadesLista.map((c) => ({ value: c, label: c }))}
        />
        <Input label="Bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
        <Input label="Colaborador" value={form.colaboradorNome} onChange={(e) => setForm({ ...form, colaboradorNome: e.target.value })} />
        <Input label="Coordenador" value={form.coordenadorNome} onChange={(e) => setForm({ ...form, coordenadorNome: e.target.value })} />
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Observações</label>
          <textarea
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all h-20 resize-none"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} loading={saving} className="flex-1">Salvar Alterações</Button>
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Eleitor, Candidato } from "@/types";
import { atualizarEleitor, registrarAtividade, buscarCandidatos } from "@/lib/firestore";
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

const tipoDocOptions = [
  { value: "titulo", label: "Título de Eleitor" },
  { value: "cpf", label: "CPF" },
  { value: "rg", label: "RG" },
];

export function EditarEleitorModal({ eleitor, open, onClose, onSaved }: Props) {
  const { userData } = useAuth();
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [form, setForm] = useState({
    nomeCompleto: eleitor.nomeCompleto,
    telefone: eleitor.telefone || "",
    tipoDocumento: eleitor.tipoDocumento || "titulo",
    documento: eleitor.documento || "",
    cep: eleitor.cep || "",
    logradouro: eleitor.logradouro || "",
    numero: eleitor.numero || "",
    complemento: eleitor.complemento || "",
    estado: eleitor.estado,
    cidade: eleitor.cidade,
    bairro: eleitor.bairro,
    grauApoio: eleitor.grauApoio,
    candidatoId: eleitor.candidatoId || "",
    observacoes: eleitor.observacoes,
    colaboradorNome: eleitor.colaboradorNome,
    coordenadorNome: eleitor.coordenadorNome || "",
  });
  const [cidadesLista, setCidadesLista] = useState(cidades[eleitor.estado] || []);
  const [saving, setSaving] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  useEffect(() => {
    if (userData?.campanhaId) {
      buscarCandidatos(userData.campanhaId).then(setCandidatos).catch(() => {});
    }
  }, [userData]);

  async function buscarCep(cep: string) {
    const cepLimpo = cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f, cep: cepLimpo,
          logradouro: data.logradouro || f.logradouro,
          bairro: data.bairro || f.bairro,
          cidade: data.localidade || f.cidade,
          estado: data.uf || f.estado,
        }));
        setCidadesLista(cidades[data.uf] || []);
      }
    } catch {} finally { setBuscandoCep(false); }
  }

  async function handleSave() {
    if (!userData || !eleitor.id) return;
    setSaving(true);
    try {
      const data: Record<string, any> = {
        nomeCompleto: form.nomeCompleto,
        tipoDocumento: form.tipoDocumento,
        documento: form.documento,
        estado: form.estado,
        cidade: form.cidade,
        bairro: form.bairro,
        grauApoio: form.grauApoio,
        observacoes: form.observacoes,
        colaboradorNome: form.colaboradorNome,
        editadoPor: userData.uid,
        editadoPorNome: userData.nome,
      };
      if (form.telefone) data.telefone = form.telefone;
      if (form.cep) data.cep = form.cep;
      if (form.logradouro) data.logradouro = form.logradouro;
      if (form.numero) data.numero = form.numero;
      if (form.complemento) data.complemento = form.complemento;
      if (form.candidatoId) data.candidatoId = form.candidatoId;
      if (form.coordenadorNome) data.coordenadorNome = form.coordenadorNome;
      await atualizarEleitor(eleitor.id, data);
      await registrarAtividade({
        acao: "editou_eleitor", usuarioId: userData.uid, usuarioNome: userData.nome,
        usuarioRole: userData.role, detalhes: `Editou eleitor ${eleitor.nomeCompleto}`,
      });
      toast.success("Eleitor atualizado!");
      onSaved();
      onClose();
    } catch (e) { toast.error("Erro ao atualizar"); } finally { setSaving(false); }
  }

  const docLabel = form.tipoDocumento === "titulo" ? "Título Eleitoral" : form.tipoDocumento === "cpf" ? "CPF" : "RG";

  return (
    <Modal open={open} onClose={onClose} title={`Editar: ${eleitor.nomeCompleto}`}>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        <Select
          label="Grau de Apoio"
          value={form.grauApoio}
          onChange={(e) => setForm({ ...form, grauApoio: e.target.value as any })}
          options={grauOptions}
        />
        <Select
          label="Tipo de Documento"
          value={form.tipoDocumento}
          onChange={(e) => setForm({ ...form, tipoDocumento: e.target.value as any })}
          options={tipoDocOptions}
        />
        <Input label={`${docLabel}`} value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
        <Input label="Nome" value={form.nomeCompleto} onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })} />
        <Input label="Telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
        <Input label="CEP" value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} onBlur={(e) => buscarCep(e.target.value)} placeholder="00000-000" maxLength={9} />
        <Input label="Logradouro" value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} />
        <Input label="Número" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
        <Input label="Complemento" value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
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
        {candidatos.length > 0 && (
          <Select
            label="Candidato"
            value={form.candidatoId}
            onChange={(e) => setForm({ ...form, candidatoId: e.target.value })}
            options={candidatos.map((c) => ({ value: c.id!, label: `${c.nome} (${c.partido})` }))}
          />
        )}
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
        {buscandoCep && <p className="text-sm text-white/40 animate-pulse">Buscando CEP...</p>}
        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} loading={saving} className="flex-1">Salvar Alterações</Button>
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}
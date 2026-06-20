"use client";

import { useState, useEffect } from "react";
import { Eleitor, Candidato } from "@/types";
import { atualizarEleitor, registrarAtividade, buscarCandidatos } from "@/lib/firestore";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { estados, getCidades, getBairros } from "@/lib/estados-cidades";
import { isSuperOrMaster, isAssessor, isCoordenador, isColaborador } from "@/lib/permissions";
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

const MOTIVOS_PRINCIPAIS = [
  { value: "", label: "Selecione (opcional)..." },
  { value: "nao_conhece", label: "Não conhece o candidato" },
  { value: "apoia_outro", label: "Já apoia outro candidato" },
  { value: "nao_gosta", label: "Não gosta do político" },
  { value: "partido", label: "Insatisfação com o partido" },
  { value: "reeleicao", label: "Não vota em reeleição" },
  { value: "presenca", label: "Falta presença no bairro" },
  { value: "promessa", label: "Promessa não cumprida" },
  { value: "sem_interesse", label: "Sem interesse político" },
  { value: "outro", label: "Outro" },
];

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
  const isOperacional = !!(userData && (isColaborador(userData) || isCoordenador(userData) || isAssessor(userData) || isSuperOrMaster(userData)));
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
    motivoPrincipal: eleitor.motivoPrincipal || "",
  });
  const [cidadesLista, setCidadesLista] = useState(getCidades(eleitor.estado));
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
        const novoEstado = data.uf || "";
        setForm((f) => ({
          ...f, cep: cepLimpo,
          logradouro: data.logradouro || f.logradouro,
          // If estado changes, only keep bairro if CEP provides one
          bairro: data.bairro || (novoEstado && novoEstado !== f.estado ? "" : f.bairro),
          cidade: data.localidade || f.cidade,
          estado: novoEstado || f.estado,
        }));
        if (novoEstado) setCidadesLista(getCidades(novoEstado));
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
      if (form.motivoPrincipal) data.motivoPrincipal = form.motivoPrincipal;
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
        <div>
          <Select
            label="Grau de Apoio"
            value={form.grauApoio}
            onChange={(e) => setForm({ ...form, grauApoio: e.target.value as any })}
            options={grauOptions}
          />
          <p className="mt-1 text-xs text-white/30">
            Forte = vai votar com certeza · Médio = simpatiza · Fraco = resistência · Indeciso = ainda não decidiu
          </p>
        </div>
        <Select
          label="Tipo de Documento"
          value={form.tipoDocumento}
          onChange={(e) => setForm({ ...form, tipoDocumento: e.target.value as any })}
          options={tipoDocOptions}
        />
        <Input label={`${docLabel}`} value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
        <Input label="Nome" value={form.nomeCompleto} onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })} />
        <Input type="tel" label="Telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
        <Input label="CEP" value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} onBlur={(e) => buscarCep(e.target.value)} placeholder="00000-000" maxLength={9} />
        <Input label="Logradouro" value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} />
        <Input label="Número" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
        <Input label="Complemento" value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
        <Select
          label="Estado"
          value={form.estado}
          onChange={(e) => { setForm({ ...form, estado: e.target.value, cidade: "", bairro: "" }); setCidadesLista(getCidades(e.target.value)); }}
          options={estados.map((e) => ({ value: e.sigla, label: `${e.sigla} - ${e.nome}` }))}
        />
        <Select
          label="Cidade"
          value={form.cidade}
          onChange={(e) => setForm({ ...form, cidade: e.target.value, bairro: "" })}
          options={cidadesLista.map((c) => ({ value: c, label: c }))}
        />
        {isOperacional ? (
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Bairro</label>
            <input
              list="edit-bairros-datalist"
              value={form.bairro}
              onChange={(e) => setForm({ ...form, bairro: e.target.value })}
              placeholder="Digite ou selecione o bairro"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            />
            <datalist id="edit-bairros-datalist">
              {getBairros(form.cidade).map((b) => (
                <option key={`${form.cidade}-${b}`} value={b} />
              ))}
            </datalist>
          </div>
        ) : (
          <Input label="Bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
        )}
        {isOperacional && (
          <Select
            label="Motivo Principal"
            value={form.motivoPrincipal}
            onChange={(e) => setForm({ ...form, motivoPrincipal: e.target.value })}
            options={MOTIVOS_PRINCIPAIS}
          />
        )}
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
            placeholder={isOperacional ? "Detalhes adicionais (opcional)" : ""}
            rows={isOperacional ? 3 : 2}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none"
          />
        </div>
        {buscandoCep && <p className="text-sm text-white/40 animate-pulse">Buscando CEP...</p>}
        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} loading={saving} className="flex-1">Salvar Alterações</Button>
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
        </div>

        <div className="pt-2 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={async () => {
              if (!userData || !eleitor.id) return;
              try {
                await addDoc(collection(db, "_solicitacoes_lgpd"), {
                  eleitorId: eleitor.id,
                  eleitorNome: eleitor.nomeCompleto,
                  documento: eleitor.documento || "",
                  tipo: "exclusao",
                  status: "pendente",
                  solicitadoPorId: userData.uid,
                  solicitadoPorNome: userData.nome,
                  campanhaId: eleitor.campanhaId,
                  criadoEm: serverTimestamp(),
                });
                await registrarAtividade({ acao: "solicitar_exclusao_lgpd", usuarioId: userData.uid, usuarioNome: userData.nome, usuarioRole: userData.role, detalhes: `Solicitou exclusão LGPD para ${eleitor.nomeCompleto}` });
                toast.success("Solicitação de exclusão registrada. O responsável irá processar em até 48h.");
                onClose();
              } catch { toast.error("Erro ao registrar solicitação"); }
            }}
            className="w-full text-xs text-white/20 hover:text-red-400/60 transition-colors py-1"
          >
            Solicitar exclusão de dados deste eleitor (LGPD)
          </button>
        </div>
      </div>
    </Modal>
  );
}
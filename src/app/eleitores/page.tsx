"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cadastrarEleitor, buscarEleitores, verificarDocumentoDuplicado, registrarAtividade, excluirEleitor, buscarCandidatos } from "@/lib/firestore";
import { estados, cidades } from "@/lib/estados-cidades";
import { Eleitor, Candidato, AppUser } from "@/types";
import { formatDate, mascaraCPF, mascaraTelefone, mascaraCEP, mascaraDocumento } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { BuscaGlobal } from "@/components/ui/BuscaGlobal";
import { BuscaOperacional, FiltrosOperacionais } from "@/components/ui/BuscaOperacional";
import { UserPlus, Trash2, Loader2, Pencil } from "lucide-react";
import { EditarEleitorModal } from "@/components/forms/EditarEleitorModal";
import { EmptyState } from "@/components/ui/EmptyState";

import toast from "react-hot-toast";
import { isSuperOrMaster, isAssessor, isCoordenador, isColaborador } from "@/lib/permissions";

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

const formInitial = {
  nomeCompleto: "", tipoDocumento: "titulo" as const, documento: "",
  telefone: "", cep: "", logradouro: "", numero: "", complemento: "",
  estado: "", cidade: "", bairro: "", grauApoio: "", voto: "", candidatoId: "", observacoes: "",
};

function salvarRascunho(dados: typeof formInitial) {
  try { localStorage.setItem("rascunho_eleitor", JSON.stringify(dados)); } catch {}
}

function carregarRascunho(): typeof formInitial | null {
  try {
    const raw = localStorage.getItem("rascunho_eleitor");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function limparRascunho() {
  try { localStorage.removeItem("rascunho_eleitor"); } catch {}
}

const opcoesVoto = [
  { value: "sim", label: "Votará no candidato" },
  { value: "branco", label: "Branco" },
  { value: "nulo", label: "Nulo" },
  { value: "indeciso", label: "Indeciso" },
  { value: "nao_informou", label: "Não informou" },
];

export default function EleitoresPage() {
  const { userData } = useAuth();
  const [form, setForm] = useState(() => carregarRascunho() || formInitial);
  const [cidadesDisponiveis, setCidadesDisponiveis] = useState<string[]>([]);
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [editingEleitor, setEditingEleitor] = useState<Eleitor | null>(null);
  const [filtros, setFiltros] = useState<FiltrosOperacionais>({ texto: "" });
  const [todosAssessores, setTodosAssessores] = useState<AppUser[]>([]);
  const [todosCoordenadores, setTodosCoordenadores] = useState<AppUser[]>([]);
  const [todosColaboradores, setTodosColaboradores] = useState<AppUser[]>([]);

  useEffect(() => { loadEleitores(); loadUsuarios(); }, [userData]);

  async function loadUsuarios() {
    try {
      const [aSnap, cSnap, colSnap] = await Promise.all([
        getDocs(query(collection(db, "usuarios"), where("role", "==", "assessor"))),
        getDocs(query(collection(db, "usuarios"), where("role", "==", "coordenador"))),
        getDocs(query(collection(db, "usuarios"), where("role", "==", "colaborador"))),
      ]);
      setTodosAssessores(aSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
      setTodosCoordenadores(cSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
      setTodosColaboradores(colSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
    } catch (e) { console.error(e); }
  }

  useEffect(() => {
    const id = userData?.gabineteId || userData?.campanhaId;
    if (id) {
      buscarCandidatos(id).then(setCandidatos).catch(() => {});
    }
  }, [userData]);

  useEffect(() => { salvarRascunho(form); }, [form]);

  async function loadEleitores() {
    setLoading(true);
    try {
      const campanhaId = isSuperOrMaster(userData) ? undefined : userData?.campanhaId;
      const colaboradorId = isColaborador(userData) ? userData?.uid : undefined;
      const data = await buscarEleitores(campanhaId, colaboradorId);
      setEleitores(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  function handleEstadoChange(sigla: string) {
    setForm((f) => ({ ...f, estado: sigla, cidade: "" }));
    setCidadesDisponiveis(cidades[sigla] || []);
  }

  async function buscarCep(cep: string) {
    const cepLimpo = cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        const siglaEstado = data.uf;
        setForm((f) => ({
          ...f, cep: cepLimpo,
          logradouro: data.logradouro || f.logradouro,
          bairro: data.bairro || f.bairro,
          cidade: data.localidade || f.cidade,
          estado: siglaEstado || f.estado,
        }));
        setCidadesDisponiveis(cidades[siglaEstado] || []);
      }
    } catch {} finally { setBuscandoCep(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userData) return;
    if (!form.nomeCompleto || !form.grauApoio) {
      toast.error("Preencha o nome e o grau de apoio");
      return;
    }
    setSaving(true);
    try {
      if (form.documento) {
        const duplicado = await verificarDocumentoDuplicado(form.documento, userData?.gabineteId || userData?.campanhaId);
        if (duplicado) { toast.error("Documento já cadastrado!"); setSaving(false); return; }
      }
      const eleitorData: Record<string, any> = {
        campanhaId: userData?.gabineteId || userData?.campanhaId || "",
        nomeCompleto: form.nomeCompleto,
        tipoDocumento: form.tipoDocumento, documento: form.documento,
        estado: form.estado, cidade: form.cidade, bairro: form.bairro,
        grauApoio: form.grauApoio,
        observacoes: form.observacoes,
        colaboradorId: userData.uid, colaboradorNome: userData.nome,
        coordenadorId: userData.coordenadorId || "",
      };
      if (form.telefone) eleitorData.telefone = form.telefone;
      if (form.cep) eleitorData.cep = form.cep;
      if (form.logradouro) eleitorData.logradouro = form.logradouro;
      if (form.numero) eleitorData.numero = form.numero;
      if (form.complemento) eleitorData.complemento = form.complemento;
      if (form.voto) eleitorData.voto = form.voto;
      if (form.candidatoId) eleitorData.candidatoId = form.candidatoId;
      if (userData.role === "coordenador") eleitorData.coordenadorNome = userData.nome;
      await cadastrarEleitor(eleitorData);
      await registrarAtividade({ acao: "cadastro_eleitor", usuarioId: userData.uid, usuarioNome: userData.nome, usuarioRole: userData.role, detalhes: `Cadastrou o eleitor ${form.nomeCompleto}` });
      toast.success("Eleitor cadastrado com sucesso!");
      setForm({ ...formInitial });
      limparRascunho();
      setCidadesDisponiveis([]);
      loadEleitores();
    } catch (e) { console.error("ERRO AO CADASTRAR ELEITOR:", e); toast.error("Erro ao cadastrar eleitor"); } finally { setSaving(false); }
  }

  async function handleExcluir(id: string, nome: string) {
    if (!confirm(`Excluir ${nome}?`)) return;
    try { await excluirEleitor(id); toast.success("Eleitor excluído"); loadEleitores(); } catch (e) { toast.error("Erro ao excluir"); }
  }

  const docLabel = form.tipoDocumento === "titulo" ? "Título Eleitoral" : form.tipoDocumento === "cpf" ? "CPF" : "RG";

  const eleitoresFiltrados = useMemo(() => {
    let lista = eleitores;
    if (filtros.texto) {
      const q = filtros.texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      lista = lista.filter((e) =>
        e.nomeCompleto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) ||
        e.cidade?.toLowerCase().includes(q)
      );
    }
    if (filtros.coordenadorId) {
      lista = lista.filter((e) => e.coordenadorId === filtros.coordenadorId);
    }
    if (filtros.colaboradorId) {
      lista = lista.filter((e) => e.colaboradorId === filtros.colaboradorId);
    }
    if (filtros.gabineteId) {
      lista = lista.filter((e) => e.campanhaId === filtros.gabineteId);
    }
    if (filtros.assessorId) {
      const gabId = todosAssessores.find((a) => a.uid === filtros.assessorId)?.gabineteId;
      if (gabId) lista = lista.filter((e) => e.campanhaId === gabId);
    }
    return lista;
  }, [eleitores, filtros, todosAssessores]);

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Cadastro de Eleitores</h1>
          <p className="text-white/50 text-sm mt-1">Cadastro rápido e simplificado para equipes de rua</p>
        </div>
        <BuscaGlobal userData={userData} />
      </div>
      <GlassCard className="p-4 md:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input label="Nome Completo *" value={form.nomeCompleto} onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })} placeholder="Nome do eleitor" />
            <Select label="Tipo de Documento" value={form.tipoDocumento} onChange={(e) => setForm({ ...form, tipoDocumento: e.target.value as any, documento: "" })} options={tipoDocOptions} />
            <Input label={docLabel} value={form.documento} onChange={(e) => setForm({ ...form, documento: mascaraDocumento(form.tipoDocumento, e.target.value) })} placeholder={`Número do ${docLabel}`} maxLength={14} />
            <Input label="Telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: mascaraTelefone(e.target.value) })} placeholder="(99) 99999-9999" maxLength={15} />
            <Input label="CEP" value={form.cep} onChange={(e) => setForm({ ...form, cep: mascaraCEP(e.target.value) })} onBlur={(e) => buscarCep(e.target.value)} placeholder="00000-000" maxLength={9} />
            <Input label="Logradouro" value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} placeholder="Rua, Av..." />
            <Input label="Número" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="Nº" />
            <Select label="Complemento" value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} options={[{ value: "", label: "Selecione..." }, { value: "Casa", label: "Casa" }, { value: "Apartamento", label: "Apartamento" }, { value: "Sala Comercial", label: "Sala Comercial" }, { value: "Kitnet", label: "Kitnet" }, { value: "Cobertura", label: "Cobertura" }, { value: "Flat", label: "Flat" }, { value: "Loft", label: "Loft" }, { value: "Condomínio", label: "Condomínio" }, { value: "Sítio", label: "Sítio" }, { value: "Chácara", label: "Chácara" }, { value: "Fazenda", label: "Fazenda" }, { value: "__outro__", label: "Outro (digitar)" }]} />
            {form.complemento === "__outro__" && (
              <Input label="Digite o complemento" value={""} onChange={(e) => setForm({ ...form, complemento: e.target.value })} placeholder="Ex: Fundos, 2º andar..." />
            )}
            <Select label="Estado" value={form.estado} onChange={(e) => handleEstadoChange(e.target.value)} options={estados.map((e) => ({ value: e.sigla, label: `${e.sigla} - ${e.nome}` }))} />
            <Select label="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} options={cidadesDisponiveis.map((c) => ({ value: c, label: c }))} disabled={!form.estado} />
            <Input label="Bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} placeholder="Bairro" />
            <Select label="Grau de Apoio *" value={form.grauApoio} onChange={(e) => setForm({ ...form, grauApoio: e.target.value })} options={grauOptions} />
            <Select label="Intenção de Voto" value={form.voto} onChange={(e) => setForm({ ...form, voto: e.target.value, candidatoId: "" })} options={opcoesVoto} />
            {form.voto === "sim" && candidatos.length > 0 && (
              <Select label="Candidato" value={form.candidatoId} onChange={(e) => setForm({ ...form, candidatoId: e.target.value })} options={candidatos.map((c) => ({ value: c.id!, label: `${c.nome} (${c.partido})` }))} />
            )}
            {form.voto === "sim" && candidatos.length === 0 && (
              <p className="text-sm text-amber-400 flex items-center gap-2 self-end pb-2">Cadastre candidatos primeiro na página Candidatos</p>
            )}
            <div className="md:col-span-2 lg:col-span-1">
              <Input label="Observações" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Observações (opcional)" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving} className="w-full md:w-auto">
              <UserPlus size={18} />{saving ? "Salvando..." : "Cadastrar Eleitor"}
            </Button>
            {buscandoCep && <span className="text-sm text-white/40 animate-pulse">Buscando CEP...</span>}
          </div>
        </form>
      </GlassCard>
      <BuscaOperacional
        pagina="eleitores"
        userData={userData}
        assessores={todosAssessores}
        coordenadores={todosCoordenadores}
        colaboradores={todosColaboradores}
        onFilter={setFiltros}
      />
      <div className="flex items-center gap-3">
        <span className="text-sm text-white/40">{eleitoresFiltrados.length} registros</span>
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-emerald-500" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 border-b border-white/[0.06]">
                <th className="text-left py-3 px-2 font-medium">Nome</th>
                <th className="text-left py-3 px-2 font-medium">Documento</th>
                <th className="text-left py-3 px-2 font-medium">Telefone</th>
                <th className="text-left py-3 px-2 font-medium">Cidade/Estado</th>
                <th className="text-left py-3 px-2 font-medium">Grau</th>
                <th className="text-left py-3 px-2 font-medium">Colaborador</th>
                <th className="text-left py-3 px-2 font-medium">Data</th>
                {(isAssessor(userData) || isSuperOrMaster(userData) || isCoordenador(userData)) && <th className="text-left py-3 px-2 font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {eleitoresFiltrados.map((eleitor) => (
                <tr key={eleitor.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-2 text-white/80">{eleitor.nomeCompleto}</td>
                  <td className="py-3 px-2 text-white/60 text-xs">{eleitor.tipoDocumento?.toUpperCase()}: {eleitor.documento}</td>
                  <td className="py-3 px-2 text-white/60">{eleitor.telefone || "-"}</td>
                  <td className="py-3 px-2 text-white/60">{eleitor.cidade}/{eleitor.estado}</td>
                  <td className="py-3 px-2"><Badge variant={eleitor.grauApoio === "forte" ? "success" : eleitor.grauApoio === "medio" ? "warning" : eleitor.grauApoio === "fraco" ? "danger" : "info"}>{eleitor.grauApoio}</Badge></td>
                  <td className="py-3 px-2 text-white/60">{eleitor.colaboradorNome}</td>
                  <td className="py-3 px-2 text-white/40 text-xs">{formatDate(eleitor.criadoEm)}</td>
                  {(isAssessor(userData) || isSuperOrMaster(userData) || isCoordenador(userData)) && (
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditingEleitor(eleitor)} className="text-white/30 hover:text-emerald-400 transition-colors" title="Editar">
                          <Pencil size={16} />
                        </button>
                        {(isAssessor(userData) || isSuperOrMaster(userData)) && (
                          <button onClick={() => handleExcluir(eleitor.id!, eleitor.nomeCompleto)} className="text-white/30 hover:text-red-400 transition-colors" title="Excluir">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {eleitoresFiltrados.length === 0 && <tr><td colSpan={8} className="py-4"><EmptyState icon={filtros.texto ? "🔍" : "📋"} title={filtros.texto ? "Nenhum resultado encontrado" : "Nenhum eleitor cadastrado"} description={filtros.texto ? "Tente buscar por nome ou cidade diferente" : "Colaboradores ainda não cadastraram eleitores"} /></td></tr>}
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
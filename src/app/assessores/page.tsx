"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { collection, getDocs, query, orderBy, where, doc, setDoc, updateDoc, getDoc, deleteDoc } from "firebase/firestore";
import { createAuthUser, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { AppUser, Gabinete, Eleitor, ROLE_CONFIG } from "@/types";
import { getRoleConfig, isSuperOrMaster, isPrefeito, isAssessor, isPolitico, canViewAssessores, canManageUsers } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { BuscaGlobal } from "@/components/ui/BuscaGlobal";
import { BuscaOperacional, FiltrosOperacionais } from "@/components/ui/BuscaOperacional";
import { Shield, UserPlus, Mail, Pencil, Building2, Trash2, MapPin, Users, TrendingUp, TrendingDown, X, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { formatDate, sugerirEmail, parseDate } from "@/lib/utils";
import { registrarAtividade } from "@/lib/firestore";
import { Modal } from "@/components/ui/Modal";

// ── Tag input para cidades ────────────────────────────────────────────────────

function CidadesInput({
  value,
  onChange,
  label = "Cidades sob responsabilidade",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  label?: string;
}) {
  const [texto, setTexto] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function adicionar() {
    const cidade = texto.trim();
    if (!cidade) return;
    if (!value.includes(cidade)) onChange([...value, cidade]);
    setTexto("");
    inputRef.current?.focus();
  }

  function remover(c: string) {
    onChange(value.filter((x) => x !== c));
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-white/60">{label}</label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }}
          placeholder="Ex: Recife, Caruaru…"
          className="flex-1 bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-purple-500/50"
        />
        <button
          type="button"
          onClick={adicionar}
          className="px-3 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors text-sm font-medium flex items-center gap-1"
        >
          <Plus size={14} /> Adicionar
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((c) => (
            <span
              key={c}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 text-xs border border-purple-500/20"
            >
              <MapPin size={10} className="shrink-0" />
              {c}
              <button
                type="button"
                onClick={() => remover(c)}
                className="ml-0.5 text-purple-400/60 hover:text-purple-300 transition-colors"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      {value.length === 0 && (
        <p className="text-xs text-white/20 italic">Nenhuma cidade adicionada — assessor sem território definido</p>
      )}
    </div>
  );
}

export default function AssessoresPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [assessores, setAssessores] = useState<AppUser[]>([]);
  const [form, setForm] = useState({ email: "", password: "", nome: "", gabineteVinculoId: "", cidades: [] as string[] });
  const [emailManual, setEmailManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", email: "", cidades: [] as string[] });
  const [excluirModal, setExcluirModal] = useState<AppUser | null>(null);
  const [excluirSaving, setExcluirSaving] = useState(false);
  const [todosGabinetes, setTodosGabinetes] = useState<Gabinete[]>([]);
  const [filtros, setFiltros] = useState<FiltrosOperacionais>({ texto: "" });

  const [gabinetesMap, setGabinetesMap] = useState<Record<string, { nome: string; politicoNome: string; cargo: string }>>({});
  const [coordenaoresExec, setCoordenadoresExec] = useState<AppUser[]>([]);
  const [eleitoresExec, setEleitoresExec] = useState<Eleitor[]>([]);
  const [ordenacao, setOrdenacao] = useState<"forca" | "criticos" | "crescimento" | "estagnados">("forca");
  const podeAcessar = isSuperOrMaster(userData) || isPolitico(userData) || isPrefeito(userData) || isAssessor(userData);
  const podeGerenciar = isSuperOrMaster(userData) || isAssessor(userData);

  useEffect(() => {
    if (userData && !podeAcessar) { router.push("/dashboard"); return; }
    loadAssessores();
  }, [userData]);

  useEffect(() => {
    if (form.nome && !emailManual) {
      const sugestao = sugerirEmail(form.nome, "assessor");
      if (sugestao) setForm((f) => ({ ...f, email: sugestao }));
    }
  }, [form.nome]);

  async function loadGabinetesMap() {
    try {
      const snap = await getDocs(query(collection(db, "campanhas"), orderBy("criadoEm", "desc")));
      const map: Record<string, { nome: string; politicoNome: string; cargo: string }> = {};
      snap.docs.forEach((d) => {
        const g = d.data() as Gabinete;
        if (d.id) map[d.id] = { nome: g.nome, politicoNome: g.politicoNome, cargo: g.cargo?.replace(/_/g, " ") };
      });
      setGabinetesMap(map);
    } catch (e) { console.error(e); }
  }

  async function loadAssessores() {
    try {
      const constraints: any[] = [where("role", "==", "assessor")];
      if (!isSuperOrMaster(userData)) {
        const scopeId = userData?.gabineteId || userData?.campanhaId;
        if (!scopeId) { setAssessores([]); setLoading(false); return; }
        constraints.push(where(userData?.gabineteId ? "gabineteId" : "campanhaId", "==", scopeId));
      }
      constraints.push(orderBy("criadoEm", "desc"));
      const q = query(collection(db, "usuarios"), ...constraints);
      const snap = await getDocs(q);
      setAssessores(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
      if (isSuperOrMaster(userData)) {
        await loadGabinetesMap();
        const gSnap = await getDocs(collection(db, "campanhas"));
        setTodosGabinetes(gSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Gabinete)));
      }
      if (userData && isPolitico(userData)) {
        const scopeId = userData?.gabineteId || userData?.campanhaId;
        if (scopeId) {
          const fieldName = userData?.gabineteId ? "gabineteId" : "campanhaId";
          const [coordSnap, elSnap] = await Promise.all([
            getDocs(query(collection(db, "usuarios"), where("role", "==", "coordenador"), where(fieldName, "==", scopeId))),
            getDocs(query(collection(db, "eleitores"), where("campanhaId", "==", scopeId))),
          ]);
          setCoordenadoresExec(coordSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
          setEleitoresExec(elSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor)));
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password || !form.nome) { toast.error("Preencha todos os campos"); return; }
    if (isSuperOrMaster(userData) && !form.gabineteVinculoId) { toast.error("Selecione o gabinete para vincular o assessor"); return; }
    setSaving(true);
    try {
      const gabineteId = isSuperOrMaster(userData) ? form.gabineteVinculoId : (userData?.gabineteId || userData?.campanhaId || "");
      const dados: Record<string, any> = {
        email: form.email, nome: form.nome, role: "assessor",
        gabineteId, campanhaId: gabineteId,
        criadoEm: new Date(), ativo: true, criadoPor: userData?.uid,
      };
      if (form.cidades.length > 0) dados.cidades = form.cidades;
      if (form.cidades.length > 0) dados.cidadePrincipal = form.cidades[0];
      await createAuthUser(form.email, form.password, dados);
      await registrarAtividade({ acao: "criar_assessor", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Criou assessor ${form.nome}${form.cidades.length > 0 ? ` — território: ${form.cidades.join(", ")}` : ""}` });
      toast.success("Assessor criado!");
      setForm({ email: "", password: "", nome: "", gabineteVinculoId: "", cidades: [] });
      setEmailManual(false);
      loadAssessores();
    } catch (error: any) { toast.error(error.code === "auth/email-already-in-use" ? "Email já está em uso" : "Erro ao criar"); } finally { setSaving(false); }
  }

  async function handleToggleStatus(uid: string, ativo: boolean) {
    try { await updateDoc(doc(db, "usuarios", uid), { ativo: !ativo }); toast.success(`Assessor ${ativo ? "desativado" : "ativado"}`); loadAssessores(); } catch (e) { toast.error("Erro"); }
  }

  function openEdit(c: AppUser) {
    setEditForm({ nome: c.nome, email: c.email, cidades: c.cidades ?? (c.cidadePrincipal ? [c.cidadePrincipal] : []) });
    setEditModal(c);
  }

  async function handleEdit() {
    if (!editModal) return;
    try {
      const patch: Record<string, any> = { nome: editForm.nome, email: editForm.email, cidades: editForm.cidades };
      if (editForm.cidades.length > 0) patch.cidadePrincipal = editForm.cidades[0];
      await updateDoc(doc(db, "usuarios", editModal.uid), patch);
      await registrarAtividade({ acao: "editou_assessor", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Editou assessor ${editModal.nome}` });
      toast.success("Assessor atualizado!"); setEditModal(null); loadAssessores();
    } catch (e) { toast.error("Erro ao atualizar"); }
  }

  async function handleExcluir() {
    if (!excluirModal) return;
    setExcluirSaving(true);
    try {
      await deleteDoc(doc(db, "usuarios", excluirModal.uid));
      await registrarAtividade({ acao: "excluiu_assessor", usuarioId: userData!.uid, usuarioNome: userData!.nome, usuarioRole: userData!.role, detalhes: `Excluiu assessor ${excluirModal.nome}` });
      toast.success("Assessor excluído!");
      setExcluirModal(null);
      loadAssessores();
    } catch (e) { toast.error("Erro ao excluir"); } finally { setExcluirSaving(false); }
  }

  const statsExec = useMemo(() => {
    if (!userData || !isPolitico(userData)) return [];
    const agora = Date.now();
    return assessores.map((a) => {
      const meusCoords = coordenaoresExec.filter((c) => c.assessorId === a.uid);
      const coordIds = new Set(meusCoords.map((c) => c.uid));
      const meusEleitores = eleitoresExec.filter((e) => coordIds.has(e.coordenadorId));

      // Usa cidades[] se disponível, senão derive do cidadePrincipal/cidade ou dos eleitores
      const territorio = (() => {
        if (a.cidades && a.cidades.length > 0) return a.cidades.join(", ");
        if (a.cidadePrincipal) return a.cidadePrincipal;
        if (a.cidade) return a.cidade;
        const contagem: Record<string, number> = {};
        meusEleitores.forEach((e) => { contagem[e.cidade] = (contagem[e.cidade] || 0) + 1; });
        return Object.entries(contagem).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
      })();

      const totalEleitores = meusEleitores.length;
      const fortes = meusEleitores.filter((e) => e.grauApoio === "forte").length;
      const forca = totalEleitores > 0 ? Math.round((fortes / totalEleitores) * 100) : 0;
      const recentes30 = meusEleitores.filter((e) => parseDate(e.criadoEm).getTime() > agora - 30 * 86400000).length;
      const prev30 = meusEleitores.filter((e) => { const t = parseDate(e.criadoEm).getTime(); return t > agora - 60 * 86400000 && t <= agora - 30 * 86400000; }).length;
      const tendencia = prev30 > 0 ? Math.round(((recentes30 - prev30) / prev30) * 100) : recentes30 > 0 ? 100 : 0;

      return { uid: a.uid, nome: a.nome, ativo: a.ativo, territorio, cidades: a.cidades ?? [], totalEleitores, totalCoords: meusCoords.length, forca, recentes30, tendencia };
    });
  }, [assessores, coordenaoresExec, eleitoresExec, userData]);

  const statsExecOrdenados = useMemo(() => {
    const lista = [...statsExec];
    if (ordenacao === "forca") {
      return lista.sort((a, b) => b.forca - a.forca || b.totalEleitores - a.totalEleitores);
    }
    if (ordenacao === "criticos") {
      const score = (s: typeof statsExec[0]) =>
        (100 - s.forca) * 0.6 + (s.recentes30 === 0 ? 40 : 0) + (s.tendencia < 0 ? 15 : 0);
      return lista.sort((a, b) => score(b) - score(a));
    }
    if (ordenacao === "crescimento") {
      return lista.sort((a, b) => b.tendencia - a.tendencia || b.recentes30 - a.recentes30);
    }
    return lista.sort((a, b) => a.recentes30 - b.recentes30 || a.tendencia - b.tendencia);
  }, [statsExec, ordenacao]);

  const assessoresFiltrados = useMemo(() => {
    let lista = assessores;
    if (filtros.texto) {
      const q = filtros.texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      lista = lista.filter((c) =>
        c.nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    }
    if (filtros.gabineteId) {
      lista = lista.filter((c) => (c.gabineteId || c.campanhaId) === filtros.gabineteId);
    }
    return lista;
  }, [assessores, filtros]);

  if (!userData || !podeAcessar) return null;
  const config = getRoleConfig(userData);

  if (isPolitico(userData)) {
    const totalBracos = statsExec.length;
    const bracosAtivos = statsExec.filter((s) => s.recentes30 > 0).length;
    const totalEleitoresCobertos = statsExec.reduce((sum, s) => sum + s.totalEleitores, 0);
    const totalCoordenadores = coordenaoresExec.length;

    return (
      <div className="space-y-6 animate-in">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-lg`}>🗺️</div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Força Territorial</h1>
            <p className="text-sm text-amber-400/70">
              {totalBracos} {totalBracos === 1 ? "braço regional" : "braços regionais"} do mandato
              {bracosAtivos > 0 && ` · ${bracosAtivos} com atividade nos últimos 30 dias`}
            </p>
          </div>
          <BuscaGlobal userData={userData} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <GlassCard className="p-4 text-center">
            <p className="text-3xl font-bold text-white">{totalBracos}</p>
            <p className="text-xs text-white/40 mt-1">Braços regionais</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-400">{bracosAtivos}</p>
            <p className="text-xs text-white/40 mt-1">Com atividade recente</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-3xl font-bold text-white">{totalEleitoresCobertos.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-white/40 mt-1">Eleitores cobertos</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-3xl font-bold text-white">{totalCoordenadores}</p>
            <p className="text-xs text-white/40 mt-1">Coordenadores ativos</p>
          </GlassCard>
        </div>

        {!loading && statsExec.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-white/20 pr-1 tracking-wide uppercase">Prioridade</span>
            {(
              [
                { key: "forca",       label: "Mais fortes" },
                { key: "criticos",    label: "Críticos"    },
                { key: "crescimento", label: "Crescimento" },
                { key: "estagnados",  label: "Estagnados"  },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setOrdenacao(key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                  ordenacao === key
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    : "text-white/30 border-white/[0.07] hover:text-white/55 hover:border-white/20"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <svg className="animate-spin h-6 w-6 text-amber-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {statsExecOrdenados.map((s) => {
              const statusAtivo = s.recentes30 > 0;
              const statusVazio = s.totalEleitores === 0;
              const statusLabel = statusAtivo ? "Território Ativo" : statusVazio ? "Sem base mapeada" : "Presença Reduzida";
              const statusDot   = statusAtivo ? "bg-emerald-400" : statusVazio ? "bg-white/20" : "bg-amber-400";
              const statusText  = statusAtivo ? "text-emerald-400" : statusVazio ? "text-white/30" : "text-amber-400";

              return (
                <div key={s.uid} className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06] space-y-3 hover:border-white/[0.10] transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-bold text-sm">
                        {s.nome.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-white font-semibold text-sm truncate">{s.nome}</p>
                    </div>
                    <div className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-full bg-white/[0.04] ${statusText}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                      <span className="text-xs font-medium whitespace-nowrap">{statusLabel}</span>
                    </div>
                  </div>

                  {/* Território: multi-cidade se disponível */}
                  {s.cidades.length > 1 ? (
                    <div className="flex flex-wrap gap-1">
                      {s.cidades.map((c) => (
                        <span key={c} className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/[0.04] text-white/60 text-[11px]">
                          <MapPin size={9} className="text-white/30 shrink-0" />{c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-sm">
                      <MapPin size={13} className="text-white/30 shrink-0" />
                      <span className={s.territorio ? "text-white/70 font-medium" : "text-white/25 italic"}>
                        {s.territorio ?? "Território não definido"}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/[0.05]">
                    <div className="text-center">
                      <p className="text-white font-bold text-lg leading-tight">{s.totalEleitores}</p>
                      <p className="text-white/30 text-xs mt-0.5">eleitores</p>
                    </div>
                    <div className="text-center border-x border-white/[0.05]">
                      <div className="flex items-center justify-center gap-1">
                        <Users size={12} className="text-white/30" />
                        <p className="text-white font-bold text-lg leading-tight">{s.totalCoords}</p>
                      </div>
                      <p className="text-white/30 text-xs mt-0.5">coords</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-bold text-lg leading-tight ${s.forca >= 40 ? "text-emerald-400" : s.forca >= 20 ? "text-amber-400" : s.totalEleitores > 0 ? "text-red-400" : "text-white/30"}`}>
                        {s.totalEleitores > 0 ? `${s.forca}%` : "—"}
                      </p>
                      <p className="text-white/30 text-xs mt-0.5">força</p>
                    </div>
                  </div>

                  {s.totalEleitores > 0 && (
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className={s.recentes30 > 0 ? "text-emerald-400" : "text-white/25"}>
                        {s.recentes30 > 0 ? `+${s.recentes30} nos últimos 30d` : "Sem novos cadastros em 30d"}
                      </span>
                      {s.tendencia !== 0 && (
                        <span className={`flex items-center gap-0.5 font-medium ${s.tendencia > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {s.tendencia > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {s.tendencia > 0 ? "+" : ""}{s.tendencia}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {statsExec.length === 0 && (
              <p className="col-span-full text-center text-white/30 py-12">Nenhum braço territorial cadastrado</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-lg`}>🏛️</div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Assessores Parlamentares</h1>
          <p className="text-sm text-purple-400">Gerencie a equipe de assessores do gabinete</p>
        </div>
        <BuscaGlobal userData={userData} />
      </div>

      {podeGerenciar && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4"><UserPlus size={18} className="text-purple-400" /><h3 className="text-white font-semibold">Criar Assessor</h3></div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {isSuperOrMaster(userData) && (
                <Select
                  label="Vincular ao gabinete"
                  value={form.gabineteVinculoId}
                  onChange={(e) => setForm({ ...form, gabineteVinculoId: e.target.value })}
                  options={[{ value: "", label: "Selecione o gabinete..." }, ...todosGabinetes.map((g) => ({ value: g.id!, label: `${g.nome} (${g.cargo?.replace(/_/g, " ")})` }))]}
                />
              )}
              <Input label="Nome" value={form.nome} onChange={(e) => { setForm({ ...form, nome: e.target.value }); }} placeholder="Nome do assessor" />
              <Input label="Email" type="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setEmailManual(true); }} onFocus={() => setEmailManual(true)} placeholder="email@exemplo.com" />
              <Input label="Senha" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
            </div>
            <CidadesInput
              value={form.cidades}
              onChange={(cidades) => setForm({ ...form, cidades })}
            />
            <div><Button type="submit" loading={saving}><UserPlus size={18} />{saving ? "Criando..." : "Criar Assessor"}</Button></div>
          </form>
        </GlassCard>
      )}

      <BuscaOperacional
        pagina="assessores"
        userData={userData}
        assessores={assessores}
        gabinetes={todosGabinetes}
        onFilter={setFiltros}
      />
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4"><Shield size={18} className="text-purple-400" /><h3 className="text-white font-semibold">Assessores do Gabinete <span className="ml-2 text-sm font-normal text-white/40">({assessoresFiltrados.length})</span></h3></div>
        {loading ? (
          <div className="flex justify-center py-8"><svg className="animate-spin h-6 w-6 text-purple-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assessoresFiltrados.map((c) => {
              const cidadesDoAssessor = c.cidades && c.cidades.length > 0
                ? c.cidades
                : c.cidadePrincipal ? [c.cidadePrincipal] : [];
              return (
                <div key={c.uid} className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold">{c.nome.charAt(0)}</div>
                      <div>
                        <p className="text-white font-medium text-sm">{c.nome}</p>
                        <div className="flex items-center gap-1"><Mail size={12} className="text-white/30" /><p className="text-xs text-white/40">{c.email}</p></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {podeGerenciar && <button onClick={() => openEdit(c)} className="text-white/30 hover:text-purple-400 transition-colors" title="Editar"><Pencil size={14} /></button>}
                      {podeGerenciar && isSuperOrMaster(userData) && userData?.uid !== c.uid && (
                        <button onClick={() => setExcluirModal(c)} className="text-white/30 hover:text-red-400 transition-colors" title="Excluir"><Trash2 size={14} /></button>
                      )}
                      <Badge variant={c.ativo ? "success" : "default"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                    </div>
                  </div>

                  {/* Cidades sob responsabilidade */}
                  {cidadesDoAssessor.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {cidadesDoAssessor.map((cidade) => (
                        <span key={cidade} className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300/80 text-[11px] border border-purple-500/15">
                          <MapPin size={9} className="shrink-0" />{cidade}
                        </span>
                      ))}
                    </div>
                  )}
                  {cidadesDoAssessor.length === 0 && (
                    <p className="text-xs text-white/20 italic">Sem território definido</p>
                  )}

                  {isSuperOrMaster(userData) && c.gabineteId && gabinetesMap[c.gabineteId] && (
                    <div className="flex items-center gap-1.5 text-xs text-white/50">
                      <Building2 size={12} className="shrink-0 text-white/30" />
                      <span>Gabinete: <span className="text-white/70">{gabinetesMap[c.gabineteId].nome}</span></span>
                      <span className="text-white/20">·</span>
                      <span className="text-white/40">{gabinetesMap[c.gabineteId].cargo}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-white/30">Criado em: {formatDate(c.criadoEm)}</span>
                    {userData?.uid !== c.uid && (
                      <button onClick={() => handleToggleStatus(c.uid, c.ativo)} className={`${c.ativo ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"} transition-colors`}>
                        {c.ativo ? "Desativar" : "Ativar"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {assessoresFiltrados.length === 0 && <p className="col-span-full text-center text-white/30 py-8">{filtros.texto ? "Nenhum assessor encontrado" : "Nenhum assessor cadastrado neste gabinete"}</p>}
          </div>
        )}
      </GlassCard>

      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Editar Assessor">
        <div className="space-y-4">
          <Input label="Nome" value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
          <Input label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <CidadesInput
            value={editForm.cidades}
            onChange={(cidades) => setEditForm({ ...editForm, cidades })}
          />
          <div className="flex gap-3 pt-2">
            <Button onClick={handleEdit} className="flex-1">Salvar</Button>
            <Button variant="ghost" onClick={() => setEditModal(null)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!excluirModal} onClose={() => setExcluirModal(null)} title="Excluir Assessor">
        <div className="space-y-4">
          <p className="text-white/60 text-sm">
            Tem certeza que deseja excluir <strong className="text-white">{excluirModal?.nome}</strong>?
          </p>
          <p className="text-red-400/70 text-xs">Esta ação remove o usuário do Firestore. Não é reversível.</p>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleExcluir} loading={excluirSaving} className="flex-1 bg-red-500/20 text-red-400 hover:bg-red-500/30">Excluir</Button>
            <Button variant="ghost" onClick={() => setExcluirModal(null)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

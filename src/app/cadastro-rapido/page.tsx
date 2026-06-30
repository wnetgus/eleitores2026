"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { estados, cidades as cidadesMap } from "@/lib/estados-cidades";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { CheckCircle2, WifiOff, ChevronLeft, Zap } from "lucide-react";
import { isColaborador, isCoordenador, isAssessor } from "@/lib/permissions";
import toast from "react-hot-toast";

type GrauApoio = "forte" | "medio" | "indeciso" | "fraco";

const GRAU: { value: GrauApoio; label: string; color: string }[] = [
  { value: "forte", label: "Forte", color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" },
  { value: "medio", label: "Médio", color: "bg-blue-500/20 border-blue-500/40 text-blue-300" },
  { value: "indeciso", label: "Indeciso", color: "bg-amber-500/20 border-amber-500/40 text-amber-300" },
  { value: "fraco", label: "Fraco", color: "bg-red-500/20 border-red-500/40 text-red-300" },
];

const SELECTED: Record<GrauApoio, string> = {
  forte: "bg-emerald-500 border-emerald-400 text-white",
  medio: "bg-blue-500 border-blue-400 text-white",
  indeciso: "bg-amber-500 border-amber-400 text-white",
  fraco: "bg-red-500 border-red-400 text-white",
};

export default function CadastroRapidoPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const isOnline = useNetworkStatus();
  const nomeRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    nomeCompleto: "",
    telefone: "",
    estado: "PE",
    cidade: "",
    bairro: "",
    grauApoio: "" as GrauApoio | "",
    observacoes: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [count, setCount] = useState(0);
  const [cidadesLista, setCidadesLista] = useState<string[]>([]);

  useEffect(() => {
    setCidadesLista(cidadesMap[form.estado] || []);
    setForm((f) => ({ ...f, cidade: "" }));
  }, [form.estado]);

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => {
        setSaved(false);
        setForm((f) => ({
          ...f,
          nomeCompleto: "",
          telefone: "",
          bairro: "",
          observacoes: "",
          grauApoio: "",
        }));
        nomeRef.current?.focus();
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [saved]);

  const canAccess = userData && (isColaborador(userData) || isCoordenador(userData) || isAssessor(userData));

  async function handleSalvar() {
    if (!userData) return;
    if (!form.nomeCompleto.trim() || !form.cidade || !form.grauApoio) return;

    setSaving(true);
    try {
      await addDoc(collection(db, "eleitores"), {
        campanhaId: userData.campanhaId || userData.gabineteId || "",
        nomeCompleto: form.nomeCompleto.trim(),
        telefone: form.telefone.trim() || null,
        estado: form.estado,
        cidade: form.cidade,
        bairro: form.bairro.trim() || "",
        grauApoio: form.grauApoio,
        observacoes: form.observacoes.trim() || "",
        colaboradorId: userData.uid || "",
        colaboradorNome: userData.nome || "",
        coordenadorId: userData.coordenadorId || "",
        tipoDocumento: "cpf",
        documento: "",
        criadoEm: Timestamp.now(),
        atualizadoEm: Timestamp.now(),
        fonte: "cadastro_rapido",
      });
      setCount((c) => c + 1);
      setSaved(true);
    } catch (e: unknown) {
      // With persistentLocalCache, addDoc resolves locally when offline — this catch
      // only fires on genuine errors (permission denied, invalid data, etc.)
      console.error("Cadastro Rápido:", e);
      const code = (e as { code?: string })?.code;
      const msg = code === "permission-denied" ? "Sem permissão para salvar." : "Erro ao salvar. Tente novamente.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!userData) return null;

  return (
    <div data-testid="pagina-cadastro-rapido" className="h-dvh bg-[#0a0a0f] flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-14 pb-4 border-b border-white/8">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center active:bg-white/10"
        >
          <ChevronLeft size={20} className="text-white/60" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-violet-400" />
            <span className="text-white font-bold">Cadastro Rápido</span>
          </div>
          <p className="text-[11px] text-white/30">
            {isOnline ? "Online" : "Offline — salvando localmente"}
          </p>
        </div>
        {count > 0 && (
          <div className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25">
            <span className="text-emerald-300 text-xs font-bold">{count} cadastrado{count > 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Offline badge */}
      {!isOnline && (
        <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <WifiOff size={14} className="text-amber-400 shrink-0" />
          <p className="text-amber-300 text-xs">Sem internet — dados sincronizados ao reconectar</p>
        </div>
      )}

      {/* Form */}
      <div className="flex-1 px-4 py-5 space-y-4 overflow-y-auto">

        {/* Nome */}
        <div>
          <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">
            Nome completo *
          </label>
          <input
            data-testid="input-nome-eleitor"
            ref={nomeRef}
            autoFocus
            type="text"
            inputMode="text"
            autoCapitalize="words"
            autoComplete="name"
            value={form.nomeCompleto}
            onChange={(e) => setForm((f) => ({ ...f, nomeCompleto: e.target.value }))}
            placeholder="Nome do eleitor"
            className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-white text-base px-4 placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 focus:bg-white/8"
          />
        </div>

        {/* Telefone */}
        <div>
          <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">
            WhatsApp
          </label>
          <input
            data-testid="input-telefone-eleitor"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.telefone}
            onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
            placeholder="(81) 99999-9999"
            className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-white text-base px-4 placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 focus:bg-white/8"
          />
        </div>

        {/* Estado + Cidade */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">Estado *</label>
            <select
              value={form.estado}
              onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
              className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-white text-base px-4 focus:outline-none focus:border-violet-500/50 appearance-none"
            >
              {estados.map((e) => (
                <option key={e.sigla} value={e.sigla} className="bg-[#1a1a2e]">{e.sigla}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">Cidade *</label>
            <select
              data-testid="input-cidade-eleitor"
              value={form.cidade}
              onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
              className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-white text-base px-4 focus:outline-none focus:border-violet-500/50 appearance-none"
            >
              <option value="" className="bg-[#1a1a2e]">Selecionar</option>
              {cidadesLista.map((c) => (
                <option key={c} value={c} className="bg-[#1a1a2e]">{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Bairro */}
        <div>
          <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">Bairro</label>
          <input
            data-testid="input-bairro-eleitor"
            type="text"
            inputMode="text"
            autoCapitalize="words"
            value={form.bairro}
            onChange={(e) => setForm((f) => ({ ...f, bairro: e.target.value }))}
            placeholder="Nome do bairro"
            className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-white text-base px-4 placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 focus:bg-white/8"
          />
        </div>

        {/* Força eleitoral */}
        <div>
          <label className="block text-xs font-semibold text-white/50 mb-3 uppercase tracking-wider">
            Força eleitoral *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {GRAU.map((g) => {
              const isSelected = form.grauApoio === g.value;
              return (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, grauApoio: g.value }))}
                  className={`h-14 rounded-2xl border text-sm font-bold transition-all active:scale-95
                    ${isSelected ? SELECTED[g.value] : `${g.color} opacity-60`}`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Observações */}
        <div>
          <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">
            Observação
          </label>
          <textarea
            rows={2}
            inputMode="text"
            value={form.observacoes}
            onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            placeholder="Contexto, demanda, referência..."
            className="w-full rounded-2xl bg-white/5 border border-white/10 text-white text-base px-4 py-3 placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 focus:bg-white/8 resize-none"
          />
        </div>
      </div>

      {/* Botão fixo no rodapé */}
      <div className="px-4 pb-8 pt-3 border-t border-white/8 bg-[#0a0a0f]">
        <button
          data-testid="btn-salvar-eleitor"
          onClick={handleSalvar}
          disabled={saving || !form.nomeCompleto.trim() || !form.cidade || !form.grauApoio}
          className={`w-full h-16 rounded-2xl font-bold text-lg transition-all active:scale-98
            ${saved
              ? "bg-emerald-500 text-white"
              : "bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-30 disabled:cursor-not-allowed"
            }`}
        >
          {saved ? (
            <span className="flex items-center justify-center gap-2">
              <CheckCircle2 size={22} />
              <span data-testid="feedback-salvo-eleitor">Salvo!</span>
            </span>
          ) : saving ? "Salvando..." : "Salvar Eleitor"}
        </button>
      </div>
    </div>
  );
}

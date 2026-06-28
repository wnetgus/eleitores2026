"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { createAuthUser } from "@/lib/firebase";
import { registrarAtividade } from "@/lib/firestore";
import { getCidades } from "@/lib/estados-cidades";
import { Crown, Users, CheckCircle, ChevronRight, MapPin, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

const ESTADOS_PE = ["PE"];
const CIDADES_PE = getCidades("PE");

const STEPS = [
  { id: 1, label: "Boas-vindas" },
  { id: 2, label: "Primeiro Assessor" },
  { id: 3, label: "Pronto" },
];

export default function OnboardingPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [assessorCriado, setAssessorCriado] = useState<{ nome: string; email: string } | null>(null);

  const [form, setForm] = useState({
    nome: "", email: "", password: "111111", cidades: [] as string[],
  });

  const campanhaId = userData?.campanhaId || userData?.gabineteId || "";
  const nomeGabinete = userData?.nome || "Seu gabinete";

  function toggleCidade(cidade: string) {
    setForm((f) => ({
      ...f,
      cidades: f.cidades.includes(cidade)
        ? f.cidades.filter((c) => c !== cidade)
        : [...f.cidades, cidade],
    }));
  }

  async function handleCriarAssessor(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.email) {
      toast.error("Preencha nome e email do assessor");
      return;
    }
    if (form.cidades.length === 0) {
      toast.error("Selecione pelo menos uma cidade para o assessor");
      return;
    }
    setSaving(true);
    try {
      const dados: Record<string, any> = {
        email: form.email,
        nome: form.nome,
        role: "assessor",
        gabineteId: campanhaId,
        campanhaId,
        criadoEm: new Date(),
        ativo: true,
        criadoPor: userData?.uid,
        cidades: form.cidades,
        cidadePrincipal: form.cidades[0],
      };
      await createAuthUser(form.email, form.password, dados);
      await registrarAtividade({
        acao: "criar_assessor",
        usuarioId: userData!.uid,
        usuarioNome: userData!.nome,
        usuarioRole: userData!.role,
        detalhes: `[ONBOARDING] Criou assessor ${form.nome} — território: ${form.cidades.join(", ")}`,
      });
      setAssessorCriado({ nome: form.nome, email: form.email });
      setStep(3);
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        toast.error("Este email já está cadastrado no sistema");
      } else {
        toast.error("Erro ao criar assessor", { duration: 4000 });
      }
    } finally {
      setSaving(false);
    }
  }

  function concluir() {
    if (typeof window !== "undefined") {
      localStorage.setItem("onboarding_completo", "1");
    }
    router.push("/dashboard");
  }

  function pularOnboarding() {
    if (typeof window !== "undefined") {
      localStorage.setItem("onboarding_completo", "1");
    }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl">

        {/* Progresso */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
                step > s.id
                  ? "bg-emerald-500 text-white"
                  : step === s.id
                  ? "bg-white/10 border border-white/30 text-white"
                  : "bg-white/5 text-white/20"
              }`}>
                {step > s.id ? <CheckCircle size={14} /> : s.id}
              </div>
              <span className={`text-xs hidden sm:block ${step === s.id ? "text-white/70" : "text-white/20"}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-px mx-1 ${step > s.id ? "bg-emerald-500/50" : "bg-white/10"}`} />
              )}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Boas-vindas ── */}
        {step === 1 && (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-2">
              <Crown size={28} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Bem-vindo, {userData?.nome?.split(" ")[0]}.
              </h1>
              <p className="text-white/50 text-sm leading-relaxed">
                A plataforma <span className="text-white/80 font-semibold">Eleitores 2026</span> está configurada para{" "}
                <span className="text-emerald-400 font-semibold">{nomeGabinete}</span>.
              </p>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 text-left space-y-3">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">O que vamos fazer agora</p>
              <div className="space-y-2">
                {[
                  { icon: "1", text: "Criar seu primeiro assessor regional" },
                  { icon: "2", text: "Definir o território de atuação dele" },
                  { icon: "3", text: "Acesse o painel e comece a mobilizar" },
                ].map((item) => (
                  <div key={item.icon} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">
                      {item.icon}
                    </span>
                    <span className="text-sm text-white/60">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-400 transition-all"
              >
                Começar <ArrowRight size={16} />
              </button>
              <button
                onClick={pularOnboarding}
                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/40 text-sm hover:text-white/60 transition-all"
              >
                Pular
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Criar Assessor ── */}
        {step === 2 && (
          <form onSubmit={handleCriarAssessor} className="space-y-5">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-3">
                <Users size={24} className="text-violet-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Criar Assessor Regional</h2>
              <p className="text-white/40 text-sm">Este assessor vai gerenciar o território definido abaixo.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">
                  Nome completo
                </label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Carlos Menezes"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">
                  Email de acesso
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="assessor@exemplo.com"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">
                  Senha provisória
                </label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Senha inicial"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 transition-all"
                />
                <p className="text-[11px] text-white/25 mt-1">O assessor deve trocar a senha no primeiro acesso.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">
                  <MapPin size={11} className="inline mr-1" />
                  Território — Cidades de Pernambuco
                </label>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                  {CIDADES_PE.slice(0, 40).map((cidade) => (
                    <button
                      key={cidade}
                      type="button"
                      onClick={() => toggleCidade(cidade)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all ${
                        form.cidades.includes(cidade)
                          ? "bg-violet-500/20 border border-violet-500/30 text-violet-300 font-semibold"
                          : "text-white/40 hover:text-white/70 hover:bg-white/5"
                      }`}
                    >
                      {form.cidades.includes(cidade) && <span className="mr-1">✓</span>}
                      {cidade}
                    </button>
                  ))}
                </div>
                {form.cidades.length > 0 && (
                  <p className="text-xs text-violet-400 mt-1.5">
                    {form.cidades.length} cidade{form.cidades.length > 1 ? "s" : ""} selecionada{form.cidades.length > 1 ? "s" : ""}:{" "}
                    <span className="text-white/50">{form.cidades.slice(0, 3).join(", ")}{form.cidades.length > 3 ? "..." : ""}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/40 text-sm hover:text-white/60 transition-all"
              >
                ← Voltar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-violet-500 text-white font-semibold text-sm hover:bg-violet-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {saving ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Criando...
                  </>
                ) : (
                  <>
                    Criar Assessor <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 3: Sucesso ── */}
        {step === 3 && assessorCriado && (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-2">
              <CheckCircle size={28} className="text-emerald-400" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Tudo pronto!</h2>
              <p className="text-white/50 text-sm leading-relaxed">
                O assessor{" "}
                <span className="text-white font-semibold">{assessorCriado.nome}</span>{" "}
                foi criado com sucesso.
              </p>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 text-left space-y-3">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Credenciais de acesso</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Email</span>
                  <span className="text-xs font-mono text-white/80">{assessorCriado.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Senha provisória</span>
                  <span className="text-xs font-mono text-white/80">{form.password}</span>
                </div>
              </div>
              <p className="text-[11px] text-amber-400/70 pt-1">
                Compartilhe essas credenciais com o assessor pelo canal seguro da equipe.
              </p>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 text-left space-y-2">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Próximos passos</p>
              {[
                "O assessor faz login e define seu território",
                "Ele cria os coordenadores da região",
                "Os coordenadores cadastram os mobilizadores",
                "Mobilizadores registram os eleitores",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-emerald-500 text-sm shrink-0 mt-0.5">→</span>
                  <span className="text-sm text-white/50">{item}</span>
                </div>
              ))}
            </div>

            <button
              onClick={concluir}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-400 transition-all"
            >
              Ir para o Painel <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

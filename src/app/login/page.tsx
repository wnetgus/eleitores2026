"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Shield, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.push("/dashboard");
  }, [user, router]);

  const doLogin = async () => {
    if (!email || !password) { toast.error("Preencha todos os campos"); return; }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Login realizado com sucesso!");
      router.push("/dashboard");
    } catch (error: any) {
      const messages: Record<string, string> = {
        "auth/user-not-found": "Usuário não encontrado",
        "auth/wrong-password": "Senha incorreta",
        "auth/invalid-credential": "Credenciais inválidas",
        "auth/invalid-email": "Email inválido",
        "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde",
      };
      toast.error(messages[error.code] || `Erro ao fazer login (${error.code ?? "unknown"})`);
    } finally {
      setLoading(false);
    }
  };

  const onEnterKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") doLogin();
  };

  const doResetSenha = async () => {
    if (!email) { toast.error("Digite seu email para receber o link de redefinição"); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Link de redefinição enviado! Verifique sua caixa de entrada.");
    } catch (error: any) {
      const messages: Record<string, string> = {
        "auth/user-not-found": "Email não encontrado",
        "auth/invalid-email": "Email inválido",
      };
      toast.error(messages[error.code] || "Erro ao enviar email de redefinição");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-black to-blue-900/20" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.06] rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center mb-4 shadow-lg shadow-emerald-600/20">
              <Shield size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Eleitores 2026</h1>
            <p className="text-white/50 text-sm mt-1">Plataforma de Gestão Política</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={onEnterKey}
                placeholder="seu@email.com"
                autoComplete="email"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
              />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-white/70 mb-1.5">Senha</label>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onEnterKey}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-white/40 hover:text-white/70 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={doLogin}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm
                transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? "Entrando..." : "Entrar"}
            </button>
            <button
              type="button"
              onClick={doResetSenha}
              className="w-full text-center text-xs text-white/30 hover:text-white/50 transition-colors pt-1"
            >
              Esqueci minha senha
            </button>
          </div>

          <div className="mt-6 p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
            <p className="text-xs text-white/40 text-center">
              Acesso autorizado apenas para membros da equipe
            </p>
          </div>

          <p className="mt-4 text-center text-xs text-white/20">
            Ao acessar, você concorda com nossa{" "}
            <a href="/privacidade" className="text-white/40 underline hover:text-white/60 transition-colors">
              Política de Privacidade
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

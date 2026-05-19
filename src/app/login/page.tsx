"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Shield, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";

// ─── SHARED DEBUG SYSTEM ─────────────────────────────────────────────────────
// Uses window.__dbg (global array) so both this module AND AuthContext
// can write to the same buffer without needing localStorage.
// Also tries localStorage as secondary persistence across hard reloads.

declare global {
  interface Window { __dbg: string[] }
}

export function dbgWrite(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  if (typeof window === "undefined") return;
  if (!window.__dbg) window.__dbg = [];
  window.__dbg.push(line);
  if (window.__dbg.length > 80) window.__dbg.shift();
  try { localStorage.setItem("eleitores_debug", JSON.stringify(window.__dbg)); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const router = useRouter();

  // Restore any logs from previous hard-reload session
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!window.__dbg) window.__dbg = [];
      if (window.__dbg.length === 0) {
        try {
          const prev: string[] = JSON.parse(localStorage.getItem("eleitores_debug") || "[]");
          window.__dbg.push(...prev);
        } catch {}
      }
    }
    dbgWrite("LOGIN:mount");
  }, []);

  // Poll window.__dbg every 300ms — catches AuthContext logs too
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof window !== "undefined" && window.__dbg) {
        setLines([...window.__dbg]);
      }
    }, 300);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll to latest log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  useEffect(() => {
    dbgWrite("LOGIN:user-effect uid=" + (user?.uid ?? "null"));
    if (user) {
      dbgWrite("LOGIN:redirect→/dashboard");
      router.push("/dashboard");
    }
  }, [user, router]);

  // ── HANDLER: extracted so both button onClick and Enter key can call it ──
  const doLogin = async () => {
    dbgWrite("LOGIN:start email=" + email);
    if (!email || !password) {
      toast.error("Preencha todos os campos");
      return;
    }
    setLoading(true);
    try {
      dbgWrite("LOGIN:before-signin");
      const cred = await signInWithEmailAndPassword(auth, email, password);
      dbgWrite("LOGIN:signin-success uid=" + cred.user.uid);
      toast.success("Login realizado com sucesso!");
      dbgWrite("LOGIN:router-push→/dashboard");
      router.push("/dashboard");
    } catch (error: any) {
      dbgWrite("LOGIN:error code=" + (error?.code ?? "unknown"));
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

  return (
    <>
      {/* ─── PAINEL FIXO — z-99999 — SEMPRE VISÍVEL ────────────────────────── */}
      <div
        style={{ zIndex: 99999, position: "fixed", top: 0, left: 0, right: 0 }}
        className="bg-red-950 border-b-4 border-yellow-400"
      >
        <div className="flex items-center justify-between px-3 py-1.5 bg-yellow-400">
          <span className="text-red-950 text-[11px] font-black tracking-widest uppercase">
            Debug Log — {lines.length} eventos
          </span>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.__dbg = [];
              try { localStorage.removeItem("eleitores_debug"); } catch {}
              setLines([]);
            }}
            className="text-red-950 text-[11px] font-bold bg-white/50 px-2 py-0.5 rounded"
          >
            LIMPAR
          </button>
        </div>
        <div
          style={{ maxHeight: "11rem", overflowY: "auto" }}
          className="px-2 py-1"
        >
          {lines.length === 0 ? (
            <p className="text-yellow-500/60 text-[10px] font-mono">aguardando logs…</p>
          ) : (
            lines.map((l, i) => (
              <p
                key={i}
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
                className="text-yellow-200 text-[10px] font-mono leading-tight"
              >
                {l}
              </p>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* ─── PÁGINA DE LOGIN ────────────────────────────────────────────────── */}
      <div
        className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{ paddingTop: "13rem" }}
      >
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

            {/* ── INPUTS: sem <form> — evita submit nativo escapar do React ── */}
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

              {/* type="button" — nunca dispara submit nativo */}
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
            </div>

            <div className="mt-6 p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
              <p className="text-xs text-white/40 text-center">
                Acesso autorizado apenas para membros da equipe
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

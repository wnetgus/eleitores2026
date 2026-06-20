"use client";

import React from "react";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

interface State {
  hasError: boolean;
  errorMessage: string;
}

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  async componentDidCatch(error: Error, info: React.ErrorInfo) {
    try {
      await addDoc(collection(db, "_erros"), {
        message: error.message,
        stack: error.stack?.slice(0, 2000) || "",
        componentStack: info.componentStack?.slice(0, 1000) || "",
        url: typeof window !== "undefined" ? window.location.pathname : "",
        criadoEm: serverTimestamp(),
      });
    } catch {
      // silencia — não podemos deixar o logger causar mais erros
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-lg font-bold text-white">Algo deu errado</h2>
            <p className="text-white/40 text-sm">
              Este erro foi registrado automaticamente. Recarregue a página para continuar.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 transition-all"
            >
              Recarregar
            </button>
            {process.env.NODE_ENV === "development" && (
              <p className="text-xs text-red-400/70 font-mono text-left bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                {this.state.errorMessage}
              </p>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

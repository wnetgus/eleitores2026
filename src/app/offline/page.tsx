"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center mb-6">
        <WifiOff size={28} className="text-amber-400" />
      </div>
      <h1 className="text-white text-xl font-bold mb-2">Sem conexão</h1>
      <p className="text-white/40 text-sm mb-8 max-w-xs">
        Verifique sua internet. Cadastros feitos antes de perder conexão estão salvos e serão sincronizados automaticamente.
      </p>
      <Link
        href="/cadastro-rapido"
        className="px-6 py-3 rounded-2xl bg-violet-600 text-white font-semibold text-sm"
      >
        Cadastro Rápido
      </Link>
    </div>
  );
}

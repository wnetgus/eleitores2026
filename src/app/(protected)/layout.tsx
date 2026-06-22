"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { NotificacoesProvider } from "@/contexts/NotificacoesContext";
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !userData)) router.push("/login");
  }, [user, userData, loading, router]);

  if (loading || !user || !userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-emerald-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-white/50 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <NotificacoesProvider>
      <div className="min-h-screen bg-background">
        <OfflineBanner />
        <Sidebar />
        <main className="lg:pl-65 transition-all duration-300 min-h-screen">
          <div className="p-4 md:p-6 lg:p-8 pt-16 lg:pt-6 max-w-screen-2xl mx-auto overflow-x-hidden">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>
    </NotificacoesProvider>
  );
}

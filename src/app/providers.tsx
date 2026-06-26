"use client";

import { useEffect } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificacoesProvider } from "@/contexts/NotificacoesContext";
import { Toaster } from "react-hot-toast";

const LEGACY_KEYS = ["eleitores_debug", "login_debug_log"];
const BUILD_KEY = "_bid";

function CacheBuster() {
  // Build ID check — detects stale cached JS after a new Vercel deploy
  useEffect(() => {
    const buildId = process.env.NEXT_PUBLIC_BUILD_ID;
    if (!buildId) return;

    // Remove debug artifacts left from dev investigation
    LEGACY_KEYS.forEach((k) => {
      try { localStorage.removeItem(k); } catch {}
    });

    try {
      const stored = localStorage.getItem(BUILD_KEY);
      if (stored && stored !== buildId) {
        // Stale bundle detected — reload once to fetch fresh assets
        localStorage.setItem(BUILD_KEY, buildId);
        window.location.reload();
        return;
      }
      localStorage.setItem(BUILD_KEY, buildId);
    } catch {}
  }, []);

  // BFCache detection — Chrome mobile restores pages from memory on back-navigation,
  // bypassing network. e.persisted=true means the page came from BFCache.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificacoesProvider>
        <CacheBuster />
        {children}
        <Toaster
          position="top-right"
          gutter={8}
          toastOptions={{
            duration: 3000,
            style: {
              background: "#1a1a2e",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px",
              padding: "12px 16px",
              fontSize: "14px",
            },
            success: {
              iconTheme: { primary: "#10b981", secondary: "#fff" },
              style: { borderColor: "rgba(16, 185, 129, 0.3)" },
            },
            error: {
              iconTheme: { primary: "#ef4444", secondary: "#fff" },
              style: { borderColor: "rgba(239, 68, 68, 0.3)" },
            },
          }}
        />
      </NotificacoesProvider>
    </AuthProvider>
  );
}

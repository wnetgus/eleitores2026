"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}

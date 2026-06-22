"use client";

import { WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export function OfflineBanner() {
  const isOnline = useNetworkStatus();
  if (isOnline) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[200] bg-amber-500/95 backdrop-blur-sm px-4 py-2 flex items-center justify-center gap-2 text-black text-sm font-semibold">
      <WifiOff size={15} />
      Sem conexão — cadastros salvos localmente e sincronizados ao reconectar
    </div>
  );
}

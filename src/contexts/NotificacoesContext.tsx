"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Notificacao, marcarLida, marcarTodasLidas, arquivarNotificacao } from "@/lib/notificacoes";
import toast from "react-hot-toast";

interface NotificacoesContextValue {
  notificacoes: Notificacao[];
  naoLidas: number;
  loading: boolean;
  marcarLida: (id: string) => Promise<void>;
  marcarTodasLidas: () => Promise<void>;
  arquivar: (id: string) => Promise<void>;
}

const NotificacoesContext = createContext<NotificacoesContextValue>({
  notificacoes: [],
  naoLidas: 0,
  loading: true,
  marcarLida: async () => {},
  marcarTodasLidas: async () => {},
  arquivar: async () => {},
});

export function NotificacoesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const primeiroRef = useRef(true);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }

    primeiroRef.current = true;
    const q = query(
      collection(db, "notificacoes"),
      where("usuarioId", "==", user.uid),
      where("arquivada", "==", false),
      orderBy("criadaEm", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notificacao));

      if (!primeiroRef.current) {
        snap.docChanges()
          .filter((c) => c.type === "added")
          .forEach((c) => {
            const n = c.doc.data() as Notificacao;
            const cfg = { determinacao: "📋", missao: "⚡", alerta: "⚠️", meta: "🎯", prestacao: "✅", sistema: "🔔" };
            toast(`${cfg[n.tipo] || "🔔"} ${n.titulo}`, { duration: 5000 });
          });
      }
      primeiroRef.current = false;
      setNotificacoes(docs);
      setLoading(false);
    }, (err) => { console.error("[onSnapshot notificacoes]", err); setLoading(false); });

    return () => unsub();
  }, [user?.uid]);

  const uid = user?.uid || "";

  return (
    <NotificacoesContext.Provider value={{
      notificacoes,
      naoLidas: notificacoes.filter((n) => !n.lida).length,
      loading,
      marcarLida,
      marcarTodasLidas: () => marcarTodasLidas(uid),
      arquivar: arquivarNotificacao,
    }}>
      {children}
    </NotificacoesContext.Provider>
  );
}

export function useNotificacoes() {
  return useContext(NotificacoesContext);
}

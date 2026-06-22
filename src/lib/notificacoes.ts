import {
  collection, addDoc, updateDoc, doc, getDocs,
  query, where, limit, Timestamp, writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type NotifTipo = "determinacao" | "missao" | "alerta" | "meta" | "prestacao" | "sistema";
export type NotifPrioridade = "baixa" | "media" | "alta" | "critica";

export interface Notificacao {
  id?: string;
  campanhaId: string;
  usuarioId: string;
  tipo: NotifTipo;
  titulo: string;
  descricao: string;
  link?: string;
  lida: boolean;
  arquivada: boolean;
  prioridade: NotifPrioridade;
  origem?: string;
  origemTipo?: string;
  remetenteNome?: string;
  chave?: string;
  criadaEm: Timestamp;
}

export async function criarNotificacao(dados: Omit<Notificacao, "id" | "lida" | "arquivada" | "criadaEm">): Promise<void> {
  try {
    // Dedup: se chave fornecida, não cria se já existe
    if (dados.chave) {
      const existe = await getDocs(
        query(
          collection(db, "notificacoes"),
          where("campanhaId", "==", dados.campanhaId),
          where("chave", "==", dados.chave),
          limit(1)
        )
      );
      if (!existe.empty) return;
    }
    await addDoc(collection(db, "notificacoes"), {
      ...dados,
      lida: false,
      arquivada: false,
      criadaEm: Timestamp.now(),
    });
  } catch (e) {
    console.error("criarNotificacao:", e);
  }
}

export async function marcarLida(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, "notificacoes", id), { lida: true });
  } catch (e) {
    console.error("marcarLida:", e);
  }
}

export async function marcarTodasLidas(usuarioId: string): Promise<void> {
  try {
    const snap = await getDocs(
      query(collection(db, "notificacoes"), where("usuarioId", "==", usuarioId), where("lida", "==", false))
    );
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, { lida: true }));
    await batch.commit();
  } catch (e) {
    console.error("marcarTodasLidas:", e);
  }
}

export async function arquivarNotificacao(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, "notificacoes", id), { arquivada: true, lida: true });
  } catch (e) {
    console.error("arquivarNotificacao:", e);
  }
}

export function tempoRelativo(ts: Timestamp): string {
  const diff = Date.now() - ts.toMillis();
  const min = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (diff < 60000) return "agora";
  if (min < 60) return `${min} min`;
  if (h < 24) return `${h}h`;
  if (d === 1) return "ontem";
  return `${d}d`;
}

export const TIPO_CONFIG: Record<NotifTipo, { icon: string; cor: string; label: string }> = {
  determinacao: { icon: "📋", cor: "text-violet-400 bg-violet-500/10 border-violet-500/20", label: "Determinação" },
  missao:       { icon: "⚡", cor: "text-blue-400 bg-blue-500/10 border-blue-500/20",       label: "Missão" },
  alerta:       { icon: "⚠️", cor: "text-amber-400 bg-amber-500/10 border-amber-500/20",   label: "Alerta" },
  meta:         { icon: "🎯", cor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Meta" },
  prestacao:    { icon: "✅", cor: "text-green-400 bg-green-500/10 border-green-500/20",    label: "Prestação" },
  sistema:      { icon: "🔔", cor: "text-white/40 bg-white/5 border-white/10",              label: "Sistema" },
};

export const PRIO_COR: Record<NotifPrioridade, string> = {
  baixa:   "text-white/30",
  media:   "text-blue-400",
  alta:    "text-amber-400",
  critica: "text-red-400",
};

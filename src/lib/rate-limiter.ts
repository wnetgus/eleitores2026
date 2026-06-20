import { adminDb } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const WINDOW_SECONDS = 60;

/**
 * Verifica rate limit por IP+action usando Firestore.
 * Retorna true se o request deve ser bloqueado.
 */
export async function isRateLimited(ip: string, action: string, maxRequests = 10): Promise<boolean> {
  const key = `${action}:${ip}`;
  const ref = adminDb.doc(`_rate_limits/${key}`);
  const now = Date.now();
  const windowStart = now - WINDOW_SECONDS * 1000;

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        tx.set(ref, { count: 1, windowStart: now, updatedAt: FieldValue.serverTimestamp() });
        return false;
      }
      const data = snap.data()!;
      if (data.windowStart < windowStart) {
        tx.update(ref, { count: 1, windowStart: now, updatedAt: FieldValue.serverTimestamp() });
        return false;
      }
      if (data.count >= maxRequests) return true;
      tx.update(ref, { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
      return false;
    });
    return result;
  } catch {
    return false;
  }
}

export function getClientIp(req: Request): string {
  // Usar o ÚLTIMO IP da cadeia: é o que o Vercel/proxy adiciona e é confiável.
  // O primeiro pode ser forjado pelo atacante via header X-Forwarded-For.
  return (
    req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

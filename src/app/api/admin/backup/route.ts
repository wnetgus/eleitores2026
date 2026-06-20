import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyToken } from "@/lib/firebase-admin";

const CRON_SECRET = process.env.CRON_SECRET;
const COLLECTIONS = ["usuarios", "eleitores", "missoes", "atividades", "solicitacoes"];

export async function POST(req: NextRequest) {
  // Aceita chamada do cron (via secret) ou de super_admin autenticado
  const cronHeader = req.headers.get("x-cron-secret");
  const isCronCall = CRON_SECRET && cronHeader === CRON_SECRET;

  if (!isCronCall) {
    const uid = await verifyToken(req);
    if (!uid) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const callerDoc = await adminDb.doc(`usuarios/${uid}`).get();
    if (callerDoc.data()?.role !== "super_admin") {
      return NextResponse.json({ error: "Apenas super_admin pode disparar backup manual" }, { status: 403 });
    }
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const backupRef = adminDb.doc(`_backups/${timestamp}`);

  const contagemPorColecao: Record<string, number> = {};
  let totalDocs = 0;

  for (const col of COLLECTIONS) {
    const snap = await adminDb.collection(col).get();
    contagemPorColecao[col] = snap.size;
    totalDocs += snap.size;
  }

  // Armazena apenas metadados — dados completos ficam no Firebase Admin (não no Firestore)
  // para evitar limite de 1MB por documento e exposição via vazamento de credenciais
  await backupRef.set({
    criadoEm: new Date(),
    totalDocumentos: totalDocs,
    colecoes: contagemPorColecao,
  });

  return NextResponse.json({ success: true, data: timestamp, totalDocumentos: totalDocs });
}

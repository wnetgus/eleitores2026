#!/usr/bin/env node
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8");
  for (const line of env.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
} catch { /* vars já no ambiente */ }

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!privateKey || !clientEmail || !projectId) {
  console.error("❌ Variáveis de ambiente não encontradas.");
  process.exit(1);
}
if (getApps().length === 0) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

async function main() {
  const snap = await db.collection("usuarios").get();
  const afetados = snap.docs.filter((d) => {
    const data = d.data();
    return data.gabineteId && !data.campanhaId;
  });

  if (afetados.length === 0) {
    console.log("✓ Nenhum documento necessita correção.");
    return;
  }

  console.log(`\nDocumentos a corrigir: ${afetados.length}\n`);

  const batch = db.batch();
  for (const doc of afetados) {
    const data = doc.data();
    const campanhaId = data.gabineteId;
    console.log(`  → ${data.nome || doc.id} | role: ${data.role} | campanhaId = ${campanhaId}`);
    batch.update(doc.ref, { campanhaId });
  }

  await batch.commit();
  console.log(`\n✅ ${afetados.length} documento(s) atualizados com sucesso.\n`);

  // Revalidação: re-ler os documentos
  console.log("Revalidando...\n");
  for (const doc of afetados) {
    const after = (await doc.ref.get()).data();
    console.log(`  ${after.nome || doc.id}`);
    console.log(`    campanhaId : ${after.campanhaId ?? "(ausente)"}`);
    console.log(`    gabineteId : ${after.gabineteId ?? "(ausente)"}`);
    console.log(`    match      : ${after.campanhaId === after.gabineteId ? "✓ OK" : "✗ DIVERGÊNCIA"}`);
  }
  console.log();
}

main().catch((e) => { console.error(e); process.exit(1); });

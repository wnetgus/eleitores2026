#!/usr/bin/env node
/**
 * limpar-cenario-fake.mjs
 * Remove cirurgicamente o cenário fake usando o manifesto de IDs.
 * Não toca em nenhum outro dado da plataforma.
 *
 * USO:
 *   node scripts/limpar-cenario-fake.mjs --confirm
 *
 * SEM --confirm: mostra o que seria removido (dry-run).
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// ============================================================
// ENV
// ============================================================
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envContent = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* vars já podem estar no ambiente */ }

// ============================================================
// CORES
// ============================================================
const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", cyan: "\x1b[36m",
};
const log = (msg, c = C.reset) => console.log(c + msg + C.reset);

// ============================================================
// FIREBASE ADMIN
// ============================================================
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!privateKey || !clientEmail || !projectId) {
  log("❌ Variáveis de ambiente não encontradas.", C.red);
  log("   Necessário: FIREBASE_ADMIN_PRIVATE_KEY, FIREBASE_ADMIN_CLIENT_EMAIL, NEXT_PUBLIC_FIREBASE_PROJECT_ID", C.yellow);
  process.exit(1);
}
if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const auth = getAuth();
const db = getFirestore();
const MANIFEST = db.collection("_seed_manifest").doc("cenario_01");

const IS_CONFIRM = process.argv.includes("--confirm");
const SUPER_EMAIL = "wnetgus@gmail.com";

// ============================================================
// DELETAR EM BATCH (máx 500 por operação)
// ============================================================
async function deletarDocs(collection, ids, dryRun) {
  if (!ids || ids.length === 0) return 0;
  if (dryRun) {
    log(`  [dry-run] ${collection}: ${ids.length} documentos seriam removidos`, C.dim);
    return ids.length;
  }
  for (let i = 0; i < ids.length; i += 500) {
    const batch = db.batch();
    ids.slice(i, i + 500).forEach((id) => batch.delete(db.collection(collection).doc(id)));
    await batch.commit();
  }
  log(`  🗑️  ${collection}: ${ids.length} documentos removidos`, C.red);
  return ids.length;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  log("\n" + "═".repeat(60), C.cyan);
  log("  🧹  LIMPEZA DO CENÁRIO FAKE — ELEITORES 2026", C.bold + C.cyan);
  log("═".repeat(60) + "\n", C.cyan);

  // Ler manifesto
  const snap = await MANIFEST.get();
  if (!snap.exists) {
    log("✅ Nenhum cenário fake encontrado. Nada a remover.", C.green);
    log("   (manifesto _seed_manifest/cenario_01 não existe)\n");
    process.exit(0);
  }

  const data = snap.data();
  const { gabineteIds = [], usuarioIds = [], eleitorIds = [], authUids = [] } = data;
  const criadoEm = data.criadoEm?.toDate?.()?.toLocaleDateString("pt-BR") ?? "desconhecida";

  // Mostrar resumo
  log(`  Manifesto encontrado (criado em: ${criadoEm})`, C.blue);
  log(`  • ${gabineteIds.length} gabinete(s)`);
  log(`  • ${usuarioIds.length} usuário(s) no Firestore`);
  log(`  • ${eleitorIds.length} eleitor(es)`);
  log(`  • ${authUids.length} usuário(s) no Firebase Auth`);
  log(`  • 1 manifesto (_seed_manifest/cenario_01)\n`);

  if (!IS_CONFIRM) {
    log("⚠️  DRY-RUN — nada foi removido.", C.yellow);
    log("   Para executar a limpeza real, adicione --confirm:", C.yellow);
    log("   node scripts/limpar-cenario-fake.mjs --confirm\n", C.dim);

    await deletarDocs("eleitores", eleitorIds, true);
    await deletarDocs("usuarios", usuarioIds, true);
    await deletarDocs("campanhas", gabineteIds, true);
    log(`  [dry-run] Auth: ${authUids.length} usuários seriam removidos`, C.dim);
    log(`  [dry-run] manifesto: seria removido\n`, C.dim);
    process.exit(0);
  }

  // Confirmação explícita via flag --confirm
  log("⚠️  ATENÇÃO: Esta operação é irreversível.", C.bold + C.red);
  log(`   Removendo ${eleitorIds.length} eleitores, ${usuarioIds.length} usuários, ${authUids.length} contas Auth...\n`, C.yellow);

  // Deletar na ordem: eleitores → usuários → gabinetes → auth → manifesto
  let total = 0;

  total += await deletarDocs("eleitores", eleitorIds, false);
  total += await deletarDocs("usuarios", usuarioIds, false);
  total += await deletarDocs("campanhas", gabineteIds, false);

  // Auth — nunca remove o super admin por segurança adicional
  const superUid = await auth.getUserByEmail(SUPER_EMAIL).then((u) => u.uid).catch(() => null);
  const uidsParaRemover = authUids.filter((uid) => uid !== superUid);
  if (uidsParaRemover.length > 0) {
    const result = await auth.deleteUsers(uidsParaRemover);
    log(`  🗑️  Auth: ${result.successCount} usuários removidos${result.failureCount > 0 ? ` (${result.failureCount} falhas)` : ""}`, C.red);
    total += result.successCount;
  }

  // Remover manifesto
  await MANIFEST.delete();
  log(`  🗑️  Manifesto removido`, C.red);

  // Verificação: buscar documentos _fake restantes
  const verificacao = await db.collection("eleitores").where("_fake", "==", true).limit(1).get();
  if (!verificacao.empty) {
    log("\n⚠️  Atenção: ainda existem documentos _fake em 'eleitores'. Verifique manualmente.", C.yellow);
  }

  log("\n" + "═".repeat(60), C.green);
  log("  ✅  CENÁRIO FAKE REMOVIDO COM SUCESSO", C.bold + C.green);
  log("═".repeat(60), C.green);
  log(`\n  Total removido: ${total} documentos + ${uidsParaRemover.length} contas Auth`);
  log(`  ${SUPER_EMAIL} preservado.\n`);
}

main().catch((e) => {
  log(`\n❌ Erro: ${e.message}`, C.red);
  console.error(e);
  process.exit(1);
});

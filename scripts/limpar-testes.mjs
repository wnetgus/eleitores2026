#!/usr/bin/env node

/**
 * ============================================================
 *  SCRIPT DE LIMPEZA DE TESTES — ELEITORES 2026
 * ============================================================
 * 
 * ATENÇÃO: Este script EXCLUI PERMANENTEMENTE dados de teste.
 * 
 * O que ele faz:
 *   1. Exclui TODOS os usuários do Firebase Authentication
 *      (exceto wnetgus@gmail.com)
 *   2. Exclui TODOS os documentos do Firestore:
 *      - eleitores
 *      - candidatos
 *      - atividades
 *      - metas
 *      - campanhas (gabinetes)
 *      - usuarios (não-admin)
 * 
 * USO:
 *   # Apenas autenticação (mais rápido):
 *   node scripts/limpar-testes.mjs --auth
 * 
 *   # Apenas Firestore:
 *   node scripts/limpar-testes.mjs --firestore
 * 
 *   # Tudo (padrão):
 *   node scripts/limpar-testes.mjs --all
 * 
 * ============================================================
 *  SEGURANÇA
 * ============================================================
 * - Sempre pede confirmação antes de executar
 * - Preserva o email wnetgus@gmail.com
 * - Preserva Admin Masters no Firestore
 * ============================================================
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import * as readline from "readline";

// Carregar .env.local manualmente
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Remover aspas se houver
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch (e) {
  console.error("❌ Erro ao ler .env.local:", e.message);
  process.exit(1);
}

// ============================================================
// CONFIG
// ============================================================
const SUPER_ADMIN_EMAIL = "wnetgus@gmail.com";
const COLOR_RED = "\x1b[31m";
const COLOR_YELLOW = "\x1b[33m";
const COLOR_GREEN = "\x1b[32m";
const COLOR_CYAN = "\x1b[36m";
const COLOR_RESET = "\x1b[0m";
const COLOR_BOLD = "\x1b[1m";

function log(msg, color = COLOR_RESET) {
  console.log(color + msg + COLOR_RESET);
}

function question(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(prompt, (a) => { rl.close(); resolve(a); }));
}

// ============================================================
// VERIFICAR ARGUMENTOS
// ============================================================
const args = process.argv.slice(2);
const mode = args.includes("--auth") ? "auth" : args.includes("--firestore") ? "firestore" : "all";

log("\n" + "=".repeat(60), COLOR_CYAN);
log("🧹  LIMPEZA DE TESTES — ELEITORES 2026", COLOR_CYAN);
log("=".repeat(60), COLOR_CYAN);
log(`Modo: ${mode === "all" ? "Completo (Auth + Firestore)" : mode === "auth" ? "Apenas Authentication" : "Apenas Firestore"}`, COLOR_YELLOW);
log(`Preservado: ${SUPER_ADMIN_EMAIL}`, COLOR_GREEN);
log("=".repeat(60) + "\n", COLOR_CYAN);

// ============================================================
// INICIALIZAR FIREBASE ADMIN
// ============================================================
function initAdmin() {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!privateKey || !clientEmail) {
    log("❌ Variáveis de ambiente não configuradas!", COLOR_RED);
    log("   Certifique-se de ter FIREBASE_ADMIN_PRIVATE_KEY e FIREBASE_ADMIN_CLIENT_EMAIL no .env.local", COLOR_YELLOW);
    log("   Ou exporte como variável de ambiente antes de executar.", COLOR_YELLOW);
    log("", COLOR_RESET);
    log("   $env:FIREBASE_ADMIN_PRIVATE_KEY='...'; $env:FIREBASE_ADMIN_CLIENT_EMAIL='...'", COLOR_YELLOW);
    process.exit(1);
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
}

// ============================================================
// LIMPAR AUTHENTICATION
// ============================================================
async function limparAuth() {
  log("\n📋 Limpando Authentication...", COLOR_YELLOW);
  const auth = getAuth();
  let total = 0;
  let nextPageToken;

  do {
    const listResult = await auth.listUsers(100, nextPageToken);
    const uids = listResult.users
      .filter((u) => u.email !== SUPER_ADMIN_EMAIL)
      .map((u) => u.uid);

    if (uids.length > 0) {
      await auth.deleteUsers(uids);
      total += uids.length;
      const emails = listResult.users.filter((u) => u.email !== SUPER_ADMIN_EMAIL).map((u) => u.email).join(", ");
      log(`  🗑️  ${uids.length} usuários: ${emails}`, COLOR_RED);
    }
    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  log(`✅ Authentication: ${total} usuários removidos (${SUPER_ADMIN_EMAIL} preservado)`, COLOR_GREEN);
  return total;
}

// ============================================================
// LIMPAR FIRESTORE
// ============================================================
async function limparFirestore() {
  log("\n📋 Limpando Firestore...", COLOR_YELLOW);
  const db = getFirestore();
  let total = 0;

  // Coleções que serão completamente limpas
  const colecoesLimpar = ["eleitores", "candidatos", "atividades", "metas", "campanhas"];

  for (const nomeColecao of colecoesLimpar) {
    const snap = await db.collection(nomeColecao).get();
    if (snap.empty) {
      log(`  📭 ${nomeColecao}: vazio`, COLOR_RESET);
      continue;
    }
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    log(`  🗑️  ${nomeColecao}: ${snap.size} documentos removidos`, COLOR_RED);
    total += snap.size;
  }

  // Coleção usuarios: remover apenas não-admin
  const userSnap = await db.collection("usuarios").get();
  const userBatch = db.batch();
  let userCount = 0;
  userSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.role !== "super_admin" && data.role !== "admin_master") {
      userBatch.delete(d.ref);
      userCount++;
    }
  });
  if (userCount > 0) {
    await userBatch.commit();
    log(`  🗑️  usuarios: ${userCount} não-admin removidos`, COLOR_RED);
  } else {
    log(`  📭 usuarios: nenhum não-admin encontrado`, COLOR_RESET);
  }
  total += userCount;

  log(`✅ Firestore: ${total} documentos removidos (admins preservados)`, COLOR_GREEN);
  return total;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  log("\n" + "═".repeat(60), COLOR_BOLD + COLOR_RED);
  log("⚠️  ATENÇÃO! Esta operação NÃO pode ser desfeita.", COLOR_BOLD + COLOR_RED);
  log("═".repeat(60), COLOR_BOLD + COLOR_RED);
  log("", COLOR_RESET);

  const tipos = mode === "all" ? "usuários (Auth) + dados (Firestore)" : mode === "auth" ? "usuários (Authentication)" : "dados (Firestore)";
  const confirm = await question(`${COLOR_YELLOW}Digite "LIMPAR" para confirmar a exclusão de ${tipos}: ${COLOR_RESET}`);

  if (confirm !== "LIMPAR") {
    log("❌ Operação cancelada.", COLOR_RED);
    process.exit(0);
  }

  log("\n🔐 Inicializando Firebase Admin...", COLOR_CYAN);
  initAdmin();

  let authCount = 0;
  let firestoreCount = 0;

  if (mode === "all" || mode === "auth") {
    authCount = await limparAuth();
  }
  if (mode === "all" || mode === "firestore") {
    firestoreCount = await limparFirestore();
  }

  log("\n" + "=".repeat(60), COLOR_GREEN);
  log("✅  LIMPEZA CONCLUÍDA!", COLOR_GREEN);
  if (authCount > 0) log(`   • Authentication: ${authCount} usuários removidos`, COLOR_GREEN);
  if (firestoreCount > 0) log(`   • Firestore: ${firestoreCount} documentos removidos`, COLOR_GREEN);
  log("=".repeat(60), COLOR_GREEN);
  log(`\n📌 ${SUPER_ADMIN_EMAIL} preservado.`, COLOR_BOLD + COLOR_GREEN);
  log("📌 Admin Masters preservados.", COLOR_GREEN);
  process.exit(0);
}

main().catch((e) => {
  log(`\n❌ Erro: ${e.message}`, COLOR_RED);
  process.exit(1);
});

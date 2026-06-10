#!/usr/bin/env node
/**
 * criar-auth-coords-mobs.mjs
 *
 * Cria contas Auth para alguns coordenadores e colaboradores já existentes
 * no Firestore (Firestore-only). Usa o mesmo UID do documento Firestore,
 * preservando todas as referências de eleitores.
 *
 * USO:
 *   node scripts/criar-auth-coords-mobs.mjs
 *
 * Credenciais criadas: senha 111111 para todos.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
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

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", cyan: "\x1b[36m",
};
const log = (m, c = C.reset) => console.log(c + m + C.reset);

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!privateKey || !clientEmail || !projectId) {
  log("❌ Variáveis de ambiente não encontradas.", C.red);
  process.exit(1);
}
if (getApps().length === 0) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

const auth = getAuth();
const db = getFirestore();

const SENHA = "111111";
const QTD_POR_ROLE = 3; // quantas contas criar por role

async function criarAuthParaUsuario(docId, dados) {
  const { email, nome, role } = dados;
  try {
    await auth.createUser({ uid: docId, email, password: SENHA });
    log(`  ✅ [${role}] ${nome} — ${email}`, C.green);
    return true;
  } catch (e) {
    if (e.code === "auth/uid-already-exists" || e.code === "auth/email-already-in-use") {
      log(`  🔄 [${role}] ${nome} — ${email} (já existe, mantendo)`, C.yellow);
      return true;
    }
    log(`  ❌ [${role}] ${nome} — ${e.message}`, C.red);
    return false;
  }
}

async function buscarUsuarios(role, limite) {
  const snap = await db.collection("usuarios")
    .where("role", "==", role)
    .where("_fake", "==", true)
    .limit(limite)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function main() {
  log("\n" + "═".repeat(60), C.cyan);
  log("  🔑  CRIAR AUTH — COORDENADORES & COLABORADORES", C.bold + C.cyan);
  log("═".repeat(60) + "\n", C.cyan);

  const coordenadores = await buscarUsuarios("coordenador", QTD_POR_ROLE);
  const colaboradores = await buscarUsuarios("colaborador", QTD_POR_ROLE);

  if (coordenadores.length === 0 && colaboradores.length === 0) {
    log("❌ Nenhum registro fake encontrado. Rode o seed primeiro:", C.red);
    log("   npm run seed:fake\n", C.yellow);
    process.exit(1);
  }

  log("👥 COORDENADORES", C.blue + C.bold);
  const coordsOk = [];
  for (const u of coordenadores) {
    const ok = await criarAuthParaUsuario(u.id, u);
    if (ok) coordsOk.push(u);
  }

  log("\n👥 COLABORADORES", C.blue + C.bold);
  const mobsOk = [];
  for (const u of colaboradores) {
    const ok = await criarAuthParaUsuario(u.id, u);
    if (ok) mobsOk.push(u);
  }

  const pad = (s, n) => String(s ?? "").padEnd(n);

  log("\n" + "═".repeat(60), C.cyan);
  log("  📋  LOGINS GERADOS — senha: 111111", C.bold + C.cyan);
  log("═".repeat(60), C.cyan);
  log(`\n  ${pad("EMAIL", 32)} ${pad("NOME", 22)} CIDADE`, C.dim);
  log("  " + "─".repeat(56), C.dim);

  for (const u of coordsOk) {
    log(`  ${pad(u.email, 32)} ${pad(u.nome, 22)} ${u.cidade ?? ""} [coordenador]`);
  }
  log("  " + "─".repeat(56), C.dim);
  for (const u of mobsOk) {
    log(`  ${pad(u.email, 32)} ${pad(u.nome, 22)} ${u.cidade ?? ""} [colaborador]`);
  }

  log("\n  Todos os eleitores já vinculados a estes usuários são preservados.\n", C.dim);
}

main().catch(e => { console.error(e); process.exit(1); });

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

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", cyan: "\x1b[36m",
};

async function main() {
  // ── 1. Buscar Junior Walter por nome ────────────────────────────────
  console.log(`\n${C.bold}${C.cyan}═══ DIAGNÓSTICO: JUNIOR WALTER ═══${C.reset}\n`);

  const snap = await db.collection("usuarios").get();
  const todos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const jw = todos.filter((u) => (u.nome || "").toLowerCase().includes("junior walter"));

  if (jw.length === 0) {
    console.log(`${C.red}❌ Nenhum usuário com nome "Junior Walter" encontrado.${C.reset}`);
  } else {
    for (const u of jw) {
      console.log(`${C.bold}Usuário encontrado: ${u.nome}${C.reset}`);
      console.log(`  uid        : ${u.id}`);
      console.log(`  role       : ${u.role ?? "(ausente)"}`);
      console.log(`  campanhaId : ${u.campanhaId ?? "(ausente)"}`);
      console.log(`  gabineteId : ${u.gabineteId ?? "(ausente)"}`);
      console.log(`  criadoEm   : ${u.criadoEm ?? "(ausente)"}`);
      console.log(`  assessorId : ${u.assessorId ?? "(ausente)"}`);
      console.log(`  status     : ${u.status ?? "(ausente)"}`);
    }
  }

  // ── 2. Inconsistências na coleção inteira ───────────────────────────
  console.log(`\n${C.bold}${C.cyan}═══ INCONSISTÊNCIAS EM "usuarios" ═══${C.reset}\n`);

  const comGabSemCampanha = todos.filter(
    (u) => u.gabineteId && !u.campanhaId
  );

  const comAmbos = todos.filter(
    (u) => u.gabineteId && u.campanhaId && u.gabineteId !== u.campanhaId
  );

  // ── 2a. Tem gabineteId, campanhaId ausente
  console.log(`${C.yellow}▸ gabineteId preenchido + campanhaId AUSENTE: ${comGabSemCampanha.length} usuário(s)${C.reset}`);
  if (comGabSemCampanha.length > 0) {
    for (const u of comGabSemCampanha) {
      console.log(`  ${u.nome || "(sem nome)"} | ${u.role ?? "?"} | gabineteId: ${u.gabineteId}`);
    }
  }

  // ── 2b. Tem ambos, mas divergem
  console.log(`\n${C.yellow}▸ gabineteId ≠ campanhaId (ambos preenchidos): ${comAmbos.length} usuário(s)${C.reset}`);
  if (comAmbos.length > 0) {
    for (const u of comAmbos) {
      console.log(`  ${u.nome || "(sem nome)"} | ${u.role ?? "?"}`);
      console.log(`    campanhaId : ${u.campanhaId}`);
      console.log(`    gabineteId : ${u.gabineteId}`);
    }
  }

  // ── 3. Resumo por role ───────────────────────────────────────────────
  console.log(`\n${C.bold}${C.cyan}═══ RESUMO POR ROLE ═══${C.reset}\n`);
  const afetados = [...comGabSemCampanha, ...comAmbos];
  const porRole = {};
  for (const u of afetados) {
    const r = u.role || "desconhecido";
    porRole[r] = (porRole[r] || 0) + 1;
  }
  if (Object.keys(porRole).length === 0) {
    console.log(`${C.green}✓ Nenhuma inconsistência encontrada.${C.reset}`);
  } else {
    for (const [role, count] of Object.entries(porRole).sort()) {
      console.log(`  ${role}: ${count}`);
    }
    console.log(`\n  ${C.bold}Total afetados: ${afetados.length} / ${todos.length}${C.reset}`);
  }

  console.log();
}

main().catch((e) => { console.error(e); process.exit(1); });

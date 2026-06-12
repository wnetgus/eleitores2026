#!/usr/bin/env node
/**
 * religar-colaboradores-orfaos.mjs
 *
 * Detecta colaboradores cujo coordenadorId aponta para um usuário que não existe
 * mais no Firestore (UID antigo após reset do seed) e os revincula ao coordenador
 * correto pelo email.
 *
 * USO:
 *   node scripts/religar-colaboradores-orfaos.mjs
 *               → dry-run: mostra o que seria corrigido
 *
 *   node scripts/religar-colaboradores-orfaos.mjs --confirm
 *               → aplica as correções
 *
 * PARÂMETROS OPCIONAIS:
 *   --coord <email>   força o coordenador de destino (ex: coord.recife.boaviagem@mail.com)
 *                     se omitido, detecta automaticamente pelo assessorId da campanha
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// ── ENV ──────────────────────────────────────────────────────────
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
} catch {}

// ── FIREBASE ─────────────────────────────────────────────────────
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!privateKey || !clientEmail || !projectId) {
  console.error("❌ Variáveis FIREBASE_ADMIN_* não encontradas em .env.local");
  process.exit(1);
}
if (getApps().length === 0) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

const auth = getAuth();
const db   = getFirestore();

// ── ARGS ─────────────────────────────────────────────────────────
const IS_CONFIRM   = process.argv.includes("--confirm");
const coordEmailArg = (() => {
  const i = process.argv.indexOf("--coord");
  return i !== -1 ? process.argv[i + 1] : null;
})();

// ── CORES ────────────────────────────────────────────────────────
const C = { reset:"\x1b[0m", bold:"\x1b[1m", dim:"\x1b[2m", red:"\x1b[31m", green:"\x1b[32m", yellow:"\x1b[33m", cyan:"\x1b[36m" };
const log = (m, c = C.reset) => console.log(c + m + C.reset);

// ── MAIN ─────────────────────────────────────────────────────────
async function main() {
  log("\n" + "═".repeat(60), C.cyan);
  log("  🔗  RELIGAR COLABORADORES ÓRFÃOS — ELEITORES 2026", C.bold + C.cyan);
  log("═".repeat(60) + "\n", C.cyan);

  if (!IS_CONFIRM) {
    log("  ℹ️  DRY-RUN — nada será alterado.", C.yellow);
    log("     Adicione --confirm para aplicar.\n", C.dim);
  }

  // 1. Carregar todos os colaboradores
  log("  📦  Carregando colaboradores...", C.dim);
  const colabSnap = await db.collection("usuarios").where("role", "==", "colaborador").get();
  const colaboradores = colabSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  log(`       ${colaboradores.length} colaboradores encontrados`, C.dim);

  // 2. Obter todos os UIDs de coordenadores existentes
  log("  📦  Carregando coordenadores existentes...", C.dim);
  const coordSnap = await db.collection("usuarios").where("role", "==", "coordenador").get();
  const coordUidsExistentes = new Set(coordSnap.docs.map(d => d.id));
  log(`       ${coordUidsExistentes.size} coordenadores existentes`, C.dim);

  // 3. Detectar órfãos
  const orfaos = colaboradores.filter(c =>
    c.coordenadorId && !coordUidsExistentes.has(c.coordenadorId)
  );

  if (orfaos.length === 0) {
    log("\n  ✅  Nenhum colaborador órfão encontrado. Tudo vinculado corretamente.\n", C.green);
    return;
  }

  log(`\n  ⚠️  ${orfaos.length} colaborador(es) com coordenadorId inválido:\n`, C.yellow);
  for (const c of orfaos) {
    log(`       • ${c.nome || c.id} — coordenadorId: ${c.coordenadorId || "(vazio)"}`, C.dim);
  }

  // 4. Resolver coordenador de destino
  let coordDestino = null;

  if (coordEmailArg) {
    try {
      const coordAuthUser = await auth.getUserByEmail(coordEmailArg);
      const coordDoc = await db.collection("usuarios").doc(coordAuthUser.uid).get();
      if (!coordDoc.exists) throw new Error("Documento não encontrado");
      coordDestino = { uid: coordAuthUser.uid, ...coordDoc.data() };
      log(`\n  🎯  Coordenador de destino: ${coordDestino.nome} (${coordEmailArg})`, C.cyan);
      log(`       UID atual: ${coordDestino.uid}`, C.dim);
    } catch (e) {
      log(`\n  ❌  Coordenador não encontrado: ${coordEmailArg}`, C.red);
      log(`     Verifique o email e tente novamente.\n`);
      process.exit(1);
    }
  } else {
    // Sem --coord: listar os coordenadores existentes para escolha manual
    log(`\n  ℹ️  Coordenadores existentes (para usar com --coord <email>):\n`, C.cyan);
    for (const d of coordSnap.docs) {
      const data = d.data();
      log(`       • ${data.nome || d.id}  email: ${data.email || "(sem email)"}  UID: ${d.id}`, C.dim);
    }
    log(`\n  Execute novamente com:\n  node scripts/religar-colaboradores-orfaos.mjs --coord <email> [--confirm]\n`, C.yellow);
    return;
  }

  // 5. Aplicar (ou simular)
  log(`\n  ${IS_CONFIRM ? "✏️  Aplicando" : "📋  Simulando"} ${orfaos.length} atualização(ões)...\n`);
  let ok = 0, erros = 0;

  for (const c of orfaos) {
    const patch = {
      coordenadorId: coordDestino.uid,
      coordenadorNome: coordDestino.nome || "",
    };
    if (!IS_CONFIRM) {
      log(`  [dry-run] ${c.nome || c.id}: coordenadorId ${c.coordenadorId} → ${coordDestino.uid}`, C.dim);
      ok++;
      continue;
    }
    try {
      await db.collection("usuarios").doc(c.id).update(patch);
      log(`  ✅  ${c.nome || c.id} → vinculado a ${coordDestino.nome}`, C.green);
      ok++;
    } catch (e) {
      log(`  ❌  ${c.nome || c.id}: ${e.message}`, C.red);
      erros++;
    }
  }

  log("\n" + "═".repeat(60), IS_CONFIRM ? C.green : C.yellow);
  if (IS_CONFIRM) {
    log(`  ✅  ${ok} atualizado(s)${erros > 0 ? `, ${erros} erro(s)` : ""}`, C.bold + C.green);
  } else {
    log(`  📋  ${ok} seria(m) atualizado(s) — rode com --confirm para aplicar`, C.bold + C.yellow);
  }
  log("═".repeat(60) + "\n", IS_CONFIRM ? C.green : C.yellow);
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });

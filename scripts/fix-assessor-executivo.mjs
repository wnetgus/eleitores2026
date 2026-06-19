#!/usr/bin/env node
/**
 * fix-assessor-executivo.mjs
 *
 * Diagnóstico e reparo cirúrgico do usuário assessor.executivo@mail.com
 *
 * O script:
 *   1. Verifica se o uid existe em Firebase Authentication
 *   2. Se não existe → cria a conta (email + senha 111111)
 *   3. Se existe → reseta a senha para 111111
 *   4. Verifica o documento em Firestore `usuarios/{uid}`
 *   5. Se não existe ou está incorreto → cria/atualiza
 *   6. Detecta automaticamente o campanhaId correto (v4 > v3 > qualquer)
 *   7. Imprime uid, estado Auth e Firestore
 *
 * USO:
 *   node scripts/fix-assessor-executivo.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

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
const projectId   = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!privateKey || !clientEmail || !projectId) {
  log("❌ Variáveis de ambiente não encontradas. Verifique .env.local", C.red);
  process.exit(1);
}

if (getApps().length === 0) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

const auth = getAuth();
const db   = getFirestore();

const EMAIL = "assessor.executivo@mail.com";
const SENHA = "111111";
const NOME  = "Marcos Executivo";
const ROLE  = "assessor_executivo";

async function detectarCampanhaId() {
  // 1. Busca o deputado pelo email
  try {
    const depSnap = await db.collection("usuarios")
      .where("email", "==", "dep.federal@mail.com")
      .limit(1)
      .get();
    if (!depSnap.empty) {
      const data = depSnap.docs[0].data();
      const id = data.campanhaId || data.gabineteId;
      if (id) { log(`  📌 campanhaId via deputado: ${id}`, C.dim); return id; }
    }
  } catch (_) {}

  // 2. Qualquer manifesto seed
  for (const docId of ["cenario_v4", "cenario_01", "cenario_exec"]) {
    try {
      const m = await db.collection("_seed_manifest").doc(docId).get();
      if (m.exists) {
        const ids = m.data().gabineteIds ?? [];
        if (ids.length) { log(`  📌 campanhaId via manifesto (${docId}): ${ids[0]}`, C.dim); return ids[0]; }
      }
    } catch (_) {}
  }

  // 3. Qualquer campanha ativa (busca ampla, sem filtros)
  try {
    const campSnap = await db.collection("campanhas").limit(10).get();
    for (const d of campSnap.docs) {
      const data = d.data();
      if (data._fake || data.politicoEmail === "dep.federal@mail.com") {
        log(`  📌 campanhaId via campanhas collection: ${d.id} (${data.nome ?? ""})`, C.dim);
        return d.id;
      }
    }
    // Fallback absoluto: primeira campanha encontrada
    if (!campSnap.empty) {
      const id = campSnap.docs[0].id;
      log(`  📌 campanhaId (fallback absoluto): ${id}`, C.dim);
      return id;
    }
  } catch (_) {}

  log("  ⚠️  Nenhum gabinete encontrado. Execute npm run seed:v4 primeiro.", C.yellow);
  return null;
}

async function main() {
  log("\n" + "═".repeat(60), C.cyan);
  log("  🔍  DIAGNÓSTICO — assessor.executivo@mail.com", C.bold + C.cyan);
  log("═".repeat(60) + "\n", C.cyan);

  // ── 1. FIREBASE AUTH ───────────────────────────────────────────
  log("1. FIREBASE AUTHENTICATION", C.blue + C.bold);

  let uid;
  let authAcao;

  try {
    const user = await auth.getUserByEmail(EMAIL);
    uid = user.uid;
    authAcao = "existia";
    log(`  ✅ Conta existe`, C.green);
    log(`     uid:   ${uid}`, C.dim);
    log(`     email: ${user.email}`, C.dim);
    log(`     ativo: ${!user.disabled}`, C.dim);

    // Reseta a senha para garantir que é 111111
    await auth.updateUser(uid, { password: SENHA, disabled: false });
    log(`  🔑 Senha resetada para 111111`, C.yellow);

  } catch (e) {
    if (e.code === "auth/user-not-found") {
      log(`  ❌ Conta NÃO existe em Authentication`, C.red);
      log(`  ➕ Criando conta...`, C.yellow);

      const user = await auth.createUser({ email: EMAIL, password: SENHA });
      uid = user.uid;
      authAcao = "criada";
      log(`  ✅ Conta criada com sucesso`, C.green);
      log(`     uid:   ${uid}`, C.dim);
    } else {
      log(`  ❌ Erro inesperado: ${e.message}`, C.red);
      throw e;
    }
  }

  // ── 2. FIRESTORE ───────────────────────────────────────────────
  log("\n2. FIRESTORE — usuarios/" + uid, C.blue + C.bold);

  const campanhaId = await detectarCampanhaId();

  const docRef = db.collection("usuarios").doc(uid);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    log(`  ❌ Documento NÃO existe em Firestore`, C.red);
    log(`  ➕ Criando documento...`, C.yellow);

    await docRef.set({
      uid,
      email:            EMAIL,
      nome:             NOME,
      role:             ROLE,
      ativo:            true,
      gabineteId:       campanhaId ?? "",
      campanhaId:       campanhaId ?? "",
      cidadePrincipal:  "Recife",
      cidades:          ["Recife", "Caruaru", "Petrolina"],
      cidade:           "Recife",
      estado:           "PE",
      criadoEm:         Timestamp.now(),
      ultimaAtividade:  Timestamp.now(),
      _fake:            true,
    });
    log(`  ✅ Documento criado`, C.green);
  } else {
    const data = docSnap.data();
    log(`  ✅ Documento existe`, C.green);
    log(`     role:       ${data.role}`, C.dim);
    log(`     ativo:      ${data.ativo}`, C.dim);
    log(`     campanhaId: ${data.campanhaId}`, C.dim);

    // Verifica e corrige campos críticos
    const updates = {};
    if (data.role !== ROLE)        { updates.role        = ROLE; log(`  🔧 role corrigido: ${data.role} → ${ROLE}`, C.yellow); }
    if (!data.ativo)               { updates.ativo       = true; log(`  🔧 ativo corrigido: false → true`, C.yellow); }
    if (!data.campanhaId && campanhaId) { updates.campanhaId = campanhaId; updates.gabineteId = campanhaId; }
    if (!data.cidades)             { updates.cidades     = ["Recife", "Caruaru", "Petrolina"]; }

    if (Object.keys(updates).length > 0) {
      await docRef.update({ ...updates, ultimaAtividade: Timestamp.now() });
      log(`  ✅ Documento atualizado`, C.green);
    } else {
      log(`  ✅ Documento OK — nenhuma correção necessária`, C.green);
    }
  }

  // ── 3. VERIFICAÇÃO FINAL ──────────────────────────────────────
  log("\n3. VERIFICAÇÃO FINAL", C.blue + C.bold);

  const authUser   = await auth.getUser(uid);
  const fsDoc      = await db.collection("usuarios").doc(uid).get();
  const fsData     = fsDoc.data();

  const authOk = authUser.email === EMAIL && !authUser.disabled;
  const fsOk   = fsData?.role === ROLE && fsData?.ativo === true;

  log(`\n  AUTH:      ${authOk ? "✅ OK" : "❌ FALHOU"}`, authOk ? C.green : C.red);
  log(`  FIRESTORE: ${fsOk  ? "✅ OK" : "❌ FALHOU"}`, fsOk  ? C.green : C.red);

  // ── RESULTADO ─────────────────────────────────────────────────
  log("\n" + "═".repeat(60), C.cyan);
  log("  📋  RESULTADO FINAL", C.bold + C.cyan);
  log("═".repeat(60), C.cyan);

  log(`
  Email:      ${EMAIL}
  Senha:      ${SENHA}
  UID:        ${uid}
  Role:       ${ROLE}
  CampanhaId: ${fsData?.campanhaId ?? "(não encontrado)"}
  Auth:       ${authAcao === "criada" ? "✅ CRIADA AGORA" : "✅ EXISTIA — senha resetada"}
  Firestore:  ${!docSnap.exists ? "✅ CRIADO AGORA" : "✅ OK"}

  AÇÃO PARA TESTAR:
  → Abra o app e faça login com:
     email: ${EMAIL}
     senha: ${SENHA}
  `, C.reset);

  if (!authOk || !fsOk) {
    log("  ⚠️  Alguma verificação falhou. Revise os logs acima.", C.yellow);
    process.exit(1);
  }

  log("  ✅  assessor.executivo@mail.com pronto para login.\n", C.green);
}

main().catch((e) => {
  log(`\n❌ Erro fatal: ${e.message}`, C.red);
  console.error(e);
  process.exit(1);
});

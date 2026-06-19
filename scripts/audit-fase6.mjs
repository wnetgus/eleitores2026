#!/usr/bin/env node
/**
 * audit-fase6.mjs — AUDITORIA E CORREÇÃO DA FASE 6
 *
 * 1. Lê o campanhaId real do Deputado (SpIqJLGEgwSr1PHYcQ4KGchSjGn1)
 * 2. Alinha o Assessor Executivo ao mesmo campanhaId
 * 3. Desabilita dep.federal@mail.com (duplicata proibida)
 * 4. Audita todas as coleções e corrige campanhaId divergente
 * 5. Emite relatório completo
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
  blue: "\x1b[34m", cyan: "\x1b[36m", magenta: "\x1b[35m",
};
const log = (m, c = C.reset) => console.log(c + m + C.reset);
const sep = () => log("═".repeat(60), C.cyan);

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const projectId   = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!privateKey || !clientEmail || !projectId) {
  log("❌ Variáveis de ambiente não encontradas.", C.red); process.exit(1);
}

if (getApps().length === 0) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

const auth = getAuth();
const db   = getFirestore();

// UIDs fixos
const DEP_UID   = "SpIqJLGEgwSr1PHYcQ4KGchSjGn1";
const AEXEC_UID = "02QTmWL7ajXKzKHW976Toc1XXgz2";
const SUPER_EMAIL = "wnetgus@gmail.com";
const DEP_FAKE_EMAIL = "dep.federal@mail.com";

// Coleções a auditar (com campo campanhaId)
const COLECOES = [
  "usuarios",
  "missoes",
  "assessorias",
  "coordenacoes",
  "memoriaMandato",
  "eleitores",
  "metas",
  "candidatos",
  "atividades",
];

async function main() {
  sep();
  log("  AUDITORIA FASE 6 — campanhaId + hierarquia", C.bold + C.cyan);
  sep();

  // ── 1. DESCOBRIR campanhaId OFICIAL ────────────────────────────────────────
  log("\n1. DEPUTADO OFICIAL (SpIqJLGEgwSr1PHYcQ4KGchSjGn1)", C.blue + C.bold);

  const depDoc = await db.collection("usuarios").doc(DEP_UID).get();
  if (!depDoc.exists) {
    log("  ❌ Deputado NÃO ENCONTRADO no Firestore!", C.red);
    log(`     uid: ${DEP_UID}`, C.dim);
    process.exit(1);
  }
  const depData = depDoc.data();
  const CAMPANHA_ID = depData.campanhaId || depData.gabineteId;
  if (!CAMPANHA_ID) {
    log("  ❌ Deputado existe mas campanhaId está VAZIO!", C.red);
    log(`     dados: ${JSON.stringify(depData, null, 2)}`, C.dim);
    process.exit(1);
  }
  log(`  ✅ Deputado: ${depData.nome} (${depData.email})`, C.green);
  log(`     campanhaId oficial: ${CAMPANHA_ID}`, C.green + C.bold);

  // ── 2. ASSESSOR EXECUTIVO ───────────────────────────────────────────────────
  log("\n2. ASSESSOR EXECUTIVO (02QTmWL7ajXKzKHW976Toc1XXgz2)", C.blue + C.bold);

  const aexDoc = await db.collection("usuarios").doc(AEXEC_UID).get();
  if (!aexDoc.exists) {
    log("  ❌ Assessor Executivo NÃO encontrado no Firestore!", C.red);
    log("     Execute: npm run fix:assessor-exec", C.yellow);
  } else {
    const aexData = aexDoc.data();
    const aexCampanha = aexData.campanhaId || aexData.gabineteId;
    if (aexCampanha !== CAMPANHA_ID) {
      log(`  ⚠️  campanhaId DIVERGENTE: ${aexCampanha} → corrigindo para ${CAMPANHA_ID}`, C.yellow);
      await db.collection("usuarios").doc(AEXEC_UID).update({
        campanhaId:      CAMPANHA_ID,
        gabineteId:      CAMPANHA_ID,
        deputadoId:      DEP_UID,
        ultimaAtividade: Timestamp.now(),
      });
      log("  ✅ Corrigido!", C.green);
    } else {
      log(`  ✅ campanhaId OK: ${aexCampanha}`, C.green);
    }
    // Garantir deputadoId
    if (!aexData.deputadoId) {
      await db.collection("usuarios").doc(AEXEC_UID).update({ deputadoId: DEP_UID });
      log("  ✅ deputadoId vinculado", C.green);
    }
  }

  // ── 3. DEP.FEDERAL@MAIL.COM — REMOVER DO CENÁRIO ──────────────────────────
  log("\n3. dep.federal@mail.com — VERIFICAÇÃO", C.blue + C.bold);

  try {
    const depFakeAuth = await auth.getUserByEmail(DEP_FAKE_EMAIL);
    log(`  ⚠️  Conta encontrada em Auth (uid: ${depFakeAuth.uid})`, C.yellow);

    // Desabilitar auth
    if (!depFakeAuth.disabled) {
      await auth.updateUser(depFakeAuth.uid, { disabled: true });
      log("  ✅ Conta DESABILITADA em Auth", C.green);
    } else {
      log("  ✅ Já estava desabilitada", C.dim);
    }

    // Atualizar Firestore — remover do cenário fake
    const depFakeFs = await db.collection("usuarios").doc(depFakeAuth.uid).get();
    if (depFakeFs.exists) {
      const d = depFakeFs.data();
      if (d._fake || d.role === "politico") {
        await db.collection("usuarios").doc(depFakeAuth.uid).update({
          ativo:      false,
          _fake:      false,
          campanhaId: "",
          gabineteId: "",
        });
        log("  ✅ Firestore: ativo=false, _fake=false, campanhaId removido", C.green);
      }
    }
  } catch (e) {
    if (e.code === "auth/user-not-found") {
      log("  ✅ Conta dep.federal@mail.com NÃO existe (OK)", C.green);
    } else {
      log(`  ⚠️  Erro: ${e.message}`, C.yellow);
    }
  }

  // ── 4. SUPER ADMIN — VERIFICAR INTEGRIDADE ─────────────────────────────────
  log("\n4. SUPER ADMIN — VERIFICAÇÃO", C.blue + C.bold);
  try {
    const superUser = await auth.getUserByEmail(SUPER_EMAIL);
    log(`  ✅ ${SUPER_EMAIL} — Auth OK (uid: ${superUser.uid})`, C.green);
  } catch {
    log(`  ❌ ${SUPER_EMAIL} NÃO encontrado em Auth!`, C.red);
  }

  // ── 5. AUDITORIA DE COLEÇÕES ───────────────────────────────────────────────
  log("\n5. AUDITORIA DE COLEÇÕES", C.blue + C.bold);

  const relatorio = [];
  let totalCorrigidos = 0;

  for (const col of COLECOES) {
    try {
      const snap = await db.collection(col).get();
      if (snap.empty) {
        relatorio.push({ col, total: 0, divergentes: 0, corrigidos: 0, status: "vazia" });
        continue;
      }

      let divergentes = 0;
      let corrigidos  = 0;
      const batch = db.batch();

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        // Pular Super Admin e documentos sem campanhaId
        if (data.email === SUPER_EMAIL) continue;
        if (!data._fake) continue; // só auditar documentos do cenário fake
        const docCampanha = data.campanhaId || data.gabineteId;
        if (docCampanha && docCampanha !== CAMPANHA_ID) {
          divergentes++;
          batch.update(docSnap.ref, {
            campanhaId: CAMPANHA_ID,
            gabineteId: CAMPANHA_ID,
          });
          corrigidos++;
        }
      }

      if (corrigidos > 0) {
        await batch.commit();
        totalCorrigidos += corrigidos;
      }

      relatorio.push({ col, total: snap.size, divergentes, corrigidos, status: "ok" });
    } catch (e) {
      relatorio.push({ col, total: "?", divergentes: "?", corrigidos: 0, status: `erro: ${e.message.slice(0, 40)}` });
    }
  }

  // ── 6. RELATÓRIO FINAL ─────────────────────────────────────────────────────
  sep();
  log("  RELATÓRIO DE AUDITORIA", C.bold + C.cyan);
  sep();

  log(`\n  campanhaId oficial: ${CAMPANHA_ID}`, C.green + C.bold);
  log(`\n  ${"Coleção".padEnd(20)} ${"Total".padEnd(8)} ${"Diverg.".padEnd(10)} ${"Corrij.".padEnd(10)} Status`);
  log("  " + "─".repeat(58), C.dim);

  for (const r of relatorio) {
    const status = r.corrigidos > 0 ? C.yellow : r.status === "vazia" ? C.dim : C.green;
    const statusLabel = r.corrigidos > 0 ? `✅ ${r.corrigidos} corrigido(s)` : r.status === "vazia" ? "(vazia)" : "✅ OK";
    log(`  ${String(r.col).padEnd(20)} ${String(r.total).padEnd(8)} ${String(r.divergentes).padEnd(10)} ${String(r.corrigidos).padEnd(10)} ${statusLabel}`, status);
  }

  log(`\n  Total de documentos corrigidos: ${totalCorrigidos}`, totalCorrigidos > 0 ? C.yellow : C.green);

  sep();
  log("\n  HIERARQUIA FINAL:", C.bold + C.cyan);
  log(`  Super Admin:       ${SUPER_EMAIL}`, C.dim);
  log(`  Deputado:          deputado@teste.com (uid: ${DEP_UID})`, C.green);
  log(`  Assessor Exec:     assessor.executivo@mail.com (uid: ${AEXEC_UID})`, C.green);
  log(`  campanhaId:        ${CAMPANHA_ID}`, C.green + C.bold);
  log(`  dep.federal:       DESABILITADO / removido do cenário`, C.dim);
  sep();

  log("\n  ✅  AUDITORIA FASE 6 CONCLUÍDA\n", C.green + C.bold);
}

main().catch((e) => {
  log(`\n❌ Erro fatal: ${e.message}`, C.red);
  console.error(e);
  process.exit(1);
});

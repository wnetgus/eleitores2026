#!/usr/bin/env node
/**
 * patch-missoes-deputado-nome.mjs
 *
 * Corrige contaminação: seed-cenario-v4 usou DEPUTADO_NOME = "Ricardo Alves"
 * quando deveria ser "Ricardo Fonseca".
 *
 * Atualiza na coleção `missoes`:
 *   criadoPorNome : "Ricardo Alves" → "Ricardo Fonseca"
 *   deleg.nome    : "Ricardo Alves" → "Ricardo Fonseca"
 *
 * USO:
 *   node scripts/patch-missoes-deputado-nome.mjs
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const projectId   = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!privateKey || !clientEmail || !projectId) {
  console.error("❌ Variáveis de ambiente Firebase não encontradas."); process.exit(1);
}

if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const NOME_ERRADO  = "Ricardo Alves";
const NOME_CORRETO = "Ricardo Fonseca";

async function main() {
  const snap = await db.collection("missoes").get();
  let corrigidos = 0;

  const batch = db.batch();
  snap.forEach((doc) => {
    const d = doc.data();
    const update = {};

    if (d.criadoPorNome === NOME_ERRADO) update.criadoPorNome = NOME_CORRETO;
    if (d.deleg?.nome   === NOME_ERRADO) update["deleg.nome"] = NOME_CORRETO;

    if (Object.keys(update).length > 0) {
      batch.update(doc.ref, update);
      corrigidos++;
      console.log(`  ✏️  ${doc.id} —`, JSON.stringify(update));
    }
  });

  if (corrigidos === 0) {
    console.log("✅ Nenhuma missão com 'Ricardo Alves' encontrada. Nada a corrigir.");
    return;
  }

  await batch.commit();
  console.log(`\n✅ ${corrigidos} missão(ões) corrigida(s): "${NOME_ERRADO}" → "${NOME_CORRETO}"`);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });

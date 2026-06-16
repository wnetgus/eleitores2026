#!/usr/bin/env node
/**
 * limpar-ambiente.mjs
 * Fase 1 — verificação final de órfãos e referências cruzadas.
 * Fase 2 — execução da limpeza (Firestore + Auth).
 *
 * Preserva obrigatoriamente o Super Admin (wnetgus@gmail.com).
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

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
} catch { /* ok */ }

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!privateKey || !clientEmail || !projectId) { console.error("❌ Env ausente."); process.exit(1); }
if (getApps().length === 0) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();
const auth = getAuth();

const SUPER_ADMIN_EMAIL = "wnetgus@gmail.com";
const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};
const sep = () => console.log(`${C.dim}${"─".repeat(60)}${C.reset}`);

// Deleta em lotes (limite Firestore: 500 por batch)
async function deletarEmLotes(refs) {
  for (let i = 0; i < refs.length; i += 500) {
    const batch = db.batch();
    refs.slice(i, i + 500).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function main() {
  console.log(`\n${C.bold}${C.cyan}══════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}${C.cyan}  LIMPEZA CONTROLADA — VERIFICAÇÃO + EXECUÇÃO     ${C.reset}`);
  console.log(`${C.bold}${C.cyan}══════════════════════════════════════════════════${C.reset}\n`);

  // ── CARREGAR TODOS OS DADOS ──────────────────────────────────────────
  const [uSnap, cSnap, eSnap, mSnap, aSnap, smSnap] = await Promise.all([
    db.collection("usuarios").get(),
    db.collection("campanhas").get(),
    db.collection("eleitores").get(),
    db.collection("metas").get(),
    db.collection("atividades").get(),
    db.collection("_seed_manifest").get(),
  ]);

  const usuarios    = uSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  const campanhas   = cSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  const eleitores   = eSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  const metas       = mSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  const atividades  = aSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));

  const superAdmin = usuarios.find((u) => u.email === SUPER_ADMIN_EMAIL);
  if (!superAdmin) {
    console.error(`${C.bold}${C.red}❌ ABORTADO: Super Admin não encontrado (${SUPER_ADMIN_EMAIL}).${C.reset}`);
    process.exit(1);
  }

  const superAdminUid = superAdmin.id;
  const removerUsuarios  = usuarios.filter((u) => u.id !== superAdminUid);
  const removerUids      = new Set(removerUsuarios.map((u) => u.id));
  const removerCampanhas = campanhas; // todas são fictícias
  const removerEleitores = eleitores; // todos são de teste
  const removerMetas     = metas;     // todas são de teste
  const removerAtividades = atividades.filter((a) => a.usuarioId !== superAdminUid);
  const preservarAtividades = atividades.filter((a) => a.usuarioId === superAdminUid);

  // ── FASE 1: VERIFICAÇÃO DE COLEÇÕES ADICIONAIS ──────────────────────
  sep();
  console.log(`${C.bold}FASE 1 — VERIFICAÇÃO DE COLEÇÕES ADICIONAIS${C.reset}\n`);

  const todasColecoes = await db.listCollections();
  const idsColecoes = todasColecoes.map((c) => c.id);
  const conhecidas = new Set(["usuarios", "campanhas", "eleitores", "metas", "atividades", "_seed_manifest"]);
  const desconhecidas = idsColecoes.filter((id) => !conhecidas.has(id));

  console.log(`  Coleções encontradas: ${idsColecoes.join(", ")}`);
  if (desconhecidas.length > 0) {
    console.log(`  ${C.yellow}⚠ Coleções não mapeadas: ${desconhecidas.join(", ")}${C.reset}`);
  } else {
    console.log(`  ${C.green}✓ Nenhuma coleção adicional encontrada.${C.reset}`);
  }

  // ── FASE 1: VERIFICAÇÃO DE ÓRFÃOS ────────────────────────────────────
  sep();
  console.log(`${C.bold}FASE 1 — VERIFICAÇÃO DE DOCUMENTOS ÓRFÃOS${C.reset}\n`);

  const campanhaIdsRemover = new Set(removerCampanhas.map((c) => c.id));
  const usuarioIdsRemover  = removerUids;

  // eleitores com campanhaId referenciando campanha que não existe após limpeza
  const eleitoresOrfaos = eleitores.filter(
    (e) => e.campanhaId && !campanhaIdsRemover.has(e.campanhaId) && !campanhas.find((c) => c.id === e.campanhaId)
  );
  // metas com colaboradorId referenciando usuário que ficará (só super admin)
  const metasOrfas = metas.filter(
    (m) => m.colaboradorId && !removerUids.has(m.colaboradorId) && m.colaboradorId !== superAdminUid
  );
  // atividades referenciando usuários que não serão removidos nem o super admin
  const atividadesOrfas = atividades.filter(
    (a) => a.usuarioId && !removerUids.has(a.usuarioId) && a.usuarioId !== superAdminUid
  );

  const semOrfaos = eleitoresOrfaos.length === 0 && metasOrfas.length === 0 && atividadesOrfas.length === 0;

  console.log(`  Eleitores com campanhaId inválido : ${eleitoresOrfaos.length}`);
  console.log(`  Metas com colaboradorId inválido  : ${metasOrfas.length}`);
  console.log(`  Atividades com usuárioId inválido : ${atividadesOrfas.length}`);

  if (semOrfaos) {
    console.log(`\n  ${C.green}✓ Nenhum documento ficará órfão após a limpeza.${C.reset}`);
  } else {
    console.log(`\n  ${C.yellow}⚠ Documentos órfãos detectados — serão incluídos na limpeza.${C.reset}`);
  }

  // ── FASE 1: CONFIRMAÇÃO DO QUE SERÁ PRESERVADO ───────────────────────
  sep();
  console.log(`${C.bold}FASE 1 — REGISTROS PRESERVADOS${C.reset}\n`);
  console.log(`  ${C.green}✓ Super Admin${C.reset}`);
  console.log(`    Email : ${superAdmin.email}`);
  console.log(`    UID   : ${superAdmin.id}`);
  console.log(`    Role  : ${superAdmin.role}`);
  console.log(`  ${C.green}✓ Atividades do Super Admin: ${preservarAtividades.length} documento(s)${C.reset}`);
  console.log(`  ${C.green}✓ Conta Auth do Super Admin: preservada (não tocada)${C.reset}`);

  // ── FASE 2: EXECUÇÃO ─────────────────────────────────────────────────
  sep();
  console.log(`${C.bold}FASE 2 — EXECUÇÃO DA LIMPEZA${C.reset}\n`);

  // 2a. Deletar contas Auth dos usuários removidos
  console.log(`  Removendo contas Auth (${removerUsuarios.length} usuários)...`);
  const uidsAuth = removerUsuarios.map((u) => u.id);
  // deleteUsers aceita até 1000 por chamada
  for (let i = 0; i < uidsAuth.length; i += 1000) {
    const lote = uidsAuth.slice(i, i + 1000);
    const result = await auth.deleteUsers(lote);
    if (result.errors.length > 0) {
      result.errors.forEach((e) =>
        console.log(`    ${C.yellow}⚠ Auth não encontrado para uid ${e.index}: ${e.error.message}${C.reset}`)
      );
    }
  }
  console.log(`  ${C.green}✓ Auth removido para ${removerUsuarios.length} usuários.${C.reset}`);

  // 2b. Deletar documentos Firestore
  console.log(`\n  Removendo documentos Firestore...`);

  await deletarEmLotes(removerUsuarios.map((u) => u.ref));
  console.log(`  ${C.green}✓ usuarios      : ${removerUsuarios.length} removidos${C.reset}`);

  await deletarEmLotes(removerCampanhas.map((c) => c.ref));
  console.log(`  ${C.green}✓ campanhas     : ${removerCampanhas.length} removidas${C.reset}`);

  await deletarEmLotes(removerEleitores.map((e) => e.ref));
  console.log(`  ${C.green}✓ eleitores     : ${removerEleitores.length} removidos${C.reset}`);

  await deletarEmLotes(removerMetas.map((m) => m.ref));
  console.log(`  ${C.green}✓ metas         : ${removerMetas.length} removidas${C.reset}`);

  await deletarEmLotes(removerAtividades.map((a) => a.ref));
  console.log(`  ${C.green}✓ atividades    : ${removerAtividades.length} removidas${C.reset}`);

  await deletarEmLotes(smSnap.docs.map((d) => d.ref));
  console.log(`  ${C.green}✓ _seed_manifest: ${smSnap.size} removidos${C.reset}`);

  // ── FASE 3: VERIFICAÇÃO PÓS-LIMPEZA ─────────────────────────────────
  sep();
  console.log(`${C.bold}FASE 3 — VERIFICAÇÃO PÓS-LIMPEZA${C.reset}\n`);

  const [uPos, cPos, ePos, mPos, aPos, smPos] = await Promise.all([
    db.collection("usuarios").get(),
    db.collection("campanhas").get(),
    db.collection("eleitores").get(),
    db.collection("metas").get(),
    db.collection("atividades").get(),
    db.collection("_seed_manifest").get(),
  ]);

  const superAdminPos = uPos.docs.find((d) => d.id === superAdminUid);
  const superAdminOk  = !!superAdminPos && superAdminPos.data().email === SUPER_ADMIN_EMAIL;

  console.log(`  Coleção            Documentos restantes`);
  console.log(`  ──────────────────────────────────────`);
  console.log(`  usuarios           ${uPos.size}  ${uPos.size === 1 ? C.green + "✓" + C.reset : C.red + "⚠" + C.reset}`);
  console.log(`  campanhas          ${cPos.size}  ${cPos.size === 0 ? C.green + "✓" + C.reset : C.yellow + "⚠" + C.reset}`);
  console.log(`  eleitores          ${ePos.size}  ${ePos.size === 0 ? C.green + "✓" + C.reset : C.yellow + "⚠" + C.reset}`);
  console.log(`  metas              ${mPos.size}  ${mPos.size === 0 ? C.green + "✓" + C.reset : C.yellow + "⚠" + C.reset}`);
  console.log(`  atividades         ${aPos.size}  (${preservarAtividades.length} do Super Admin preservadas)`);
  console.log(`  _seed_manifest     ${smPos.size}  ${smPos.size === 0 ? C.green + "✓" + C.reset : C.yellow + "⚠" + C.reset}`);

  console.log(`\n  ${superAdminOk ? C.green + "✓" : C.red + "❌"} Super Admin intacto: ${SUPER_ADMIN_EMAIL} (uid: ${superAdminUid})${C.reset}`);

  // Verificar orphans pós-limpeza
  const eOrfaosPos = ePos.docs.filter((d) => {
    const data = d.data();
    return data.campanhaId && !cPos.docs.find((c) => c.id === data.campanhaId);
  });
  console.log(`  ${eOrfaosPos.length === 0 ? C.green + "✓" : C.yellow + "⚠"} Eleitores órfãos: ${eOrfaosPos.length}${C.reset}`);

  sep();
  console.log(`\n${C.bold}${C.green}LIMPEZA CONCLUÍDA.${C.reset}`);
  console.log(`Banco operacional — pronto para o novo cenário executivo.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });

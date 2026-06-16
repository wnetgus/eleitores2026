#!/usr/bin/env node
/**
 * auditoria-limpeza.mjs
 * Leitura apenas — não remove nada.
 * Mapeia o que seria removido vs preservado em cada coleção.
 */
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
} catch { /* ok */ }

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!privateKey || !clientEmail || !projectId) { console.error("❌ Env ausente."); process.exit(1); }
if (getApps().length === 0) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const SUPER_ADMIN_EMAIL = "wnetgus@gmail.com";

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", cyan: "\x1b[36m", magenta: "\x1b[35m",
};
const sep = () => console.log(`${C.dim}${"─".repeat(60)}${C.reset}`);

async function main() {
  console.log(`\n${C.bold}${C.cyan}══════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}${C.cyan}  AUDITORIA DE LIMPEZA — SOMENTE LEITURA          ${C.reset}`);
  console.log(`${C.bold}${C.cyan}══════════════════════════════════════════════════${C.reset}\n`);

  // ── 1. USUÁRIOS ─────────────────────────────────────────────────────
  sep();
  console.log(`${C.bold}COLEÇÃO: usuarios${C.reset}`);
  const uSnap = await db.collection("usuarios").get();
  const usuarios = uSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const superAdmin = usuarios.find((u) => u.email === SUPER_ADMIN_EMAIL);
  const preservarUsuarios = superAdmin ? [superAdmin] : [];
  const removerUsuarios = usuarios.filter((u) => u.email !== SUPER_ADMIN_EMAIL);

  console.log(`  Total         : ${usuarios.length}`);
  console.log(`  ${C.green}Preservar (${preservarUsuarios.length}):${C.reset}`);
  preservarUsuarios.forEach((u) => console.log(`    ✓ ${u.nome || u.email} [${u.role}] uid:${u.id}`));
  console.log(`  ${C.yellow}Remover   (${removerUsuarios.length}):${C.reset}`);
  const porRole = {};
  removerUsuarios.forEach((u) => { const r = u.role || "sem-role"; porRole[r] = (porRole[r] || 0) + 1; });
  Object.entries(porRole).sort().forEach(([role, count]) => console.log(`    - ${role}: ${count}`));

  // ── 2. CAMPANHAS ─────────────────────────────────────────────────────
  sep();
  console.log(`${C.bold}COLEÇÃO: campanhas${C.reset}`);
  const cSnap = await db.collection("campanhas").get();
  const campanhas = cSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Campanhas vinculadas ao Super Admin ou marcadas como sistema são preservadas
  // Todas as campanhas fictícias (sem usuário real vinculado) são removidas
  const superAdminCampanhaId = superAdmin?.campanhaId || superAdmin?.gabineteId;
  const preservarCampanhas = campanhas.filter((c) =>
    c.id === superAdminCampanhaId || c.tipo === "sistema" || c.sistema === true
  );
  const removerCampanhas = campanhas.filter((c) => !preservarCampanhas.find((p) => p.id === c.id));

  console.log(`  Total         : ${campanhas.length}`);
  console.log(`  ${C.green}Preservar (${preservarCampanhas.length}):${C.reset}`);
  if (preservarCampanhas.length === 0) console.log(`    (nenhuma)`);
  preservarCampanhas.forEach((c) => console.log(`    ✓ ${c.nome || c.id} [id:${c.id}]`));
  console.log(`  ${C.yellow}Remover   (${removerCampanhas.length}):${C.reset}`);
  removerCampanhas.forEach((c) => console.log(`    - ${c.nome || c.id} [id:${c.id}]`));

  // ── 3. ELEITORES ─────────────────────────────────────────────────────
  sep();
  console.log(`${C.bold}COLEÇÃO: eleitores${C.reset}`);
  const eSnap = await db.collection("eleitores").get();
  const eleitores = eSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Eleitores vinculados à campanha do super admin são preservados (se existirem)
  const preservarEleitores = superAdminCampanhaId
    ? eleitores.filter((e) => e.campanhaId === superAdminCampanhaId && !removerCampanhas.find((c) => c.id === e.campanhaId))
    : [];
  const removerEleitores = eleitores.filter((e) => !preservarEleitores.find((p) => p.id === e.id));
  console.log(`  Total         : ${eleitores.length}`);
  console.log(`  ${C.green}Preservar     : ${preservarEleitores.length}${C.reset}`);
  console.log(`  ${C.yellow}Remover       : ${removerEleitores.length}${C.reset}`);
  const porCampanha = {};
  removerEleitores.forEach((e) => { const c = e.campanhaId || "sem-campanha"; porCampanha[c] = (porCampanha[c] || 0) + 1; });
  Object.entries(porCampanha).forEach(([cid, count]) => {
    const nome = campanhas.find((c) => c.id === cid)?.nome || cid;
    console.log(`    - ${nome}: ${count} eleitores`);
  });

  // ── 4. METAS ─────────────────────────────────────────────────────────
  sep();
  console.log(`${C.bold}COLEÇÃO: metas${C.reset}`);
  const mSnap = await db.collection("metas").get();
  const metas = mSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Metas cujo colaboradorId pertence ao super admin são preservadas (improvável mas seguro checar)
  const idsPreservados = new Set(preservarUsuarios.map((u) => u.id));
  const preservarMetas = metas.filter((m) => idsPreservados.has(m.colaboradorId));
  const removerMetas = metas.filter((m) => !preservarMetas.find((p) => p.id === m.id));
  console.log(`  Total         : ${metas.length}`);
  console.log(`  ${C.green}Preservar     : ${preservarMetas.length}${C.reset}`);
  console.log(`  ${C.yellow}Remover       : ${removerMetas.length}${C.reset}`);

  // ── 5. ATIVIDADES ─────────────────────────────────────────────────────
  sep();
  console.log(`${C.bold}COLEÇÃO: atividades${C.reset}`);
  const aSnap = await db.collection("atividades").get();
  const atividades = aSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Atividades do super admin são preservadas
  const preservarAtividades = atividades.filter((a) => idsPreservados.has(a.usuarioId));
  const removerAtividades = atividades.filter((a) => !preservarAtividades.find((p) => p.id === a.id));
  console.log(`  Total         : ${atividades.length}`);
  console.log(`  ${C.green}Preservar     : ${preservarAtividades.length}${C.reset}`);
  console.log(`  ${C.yellow}Remover       : ${removerAtividades.length}${C.reset}`);

  // ── 6. _seed_manifest ────────────────────────────────────────────────
  sep();
  console.log(`${C.bold}COLEÇÃO: _seed_manifest${C.reset}`);
  const smSnap = await db.collection("_seed_manifest").get();
  console.log(`  Total         : ${smSnap.size} documento(s)`);
  smSnap.docs.forEach((d) => console.log(`  ${C.yellow}- ${d.id}${C.reset}`));
  console.log(`  ${C.yellow}Remover       : ${smSnap.size} (todos — controle de seed)${C.reset}`);

  // ── SUMÁRIO ──────────────────────────────────────────────────────────
  sep();
  console.log(`\n${C.bold}${C.cyan}SUMÁRIO DE IMPACTO${C.reset}\n`);
  console.log(`  Coleção            Remover    Preservar`);
  console.log(`  ──────────────────────────────────────`);
  console.log(`  usuarios           ${String(removerUsuarios.length).padEnd(10)} ${preservarUsuarios.length}`);
  console.log(`  campanhas          ${String(removerCampanhas.length).padEnd(10)} ${preservarCampanhas.length}`);
  console.log(`  eleitores          ${String(removerEleitores.length).padEnd(10)} ${preservarEleitores.length}`);
  console.log(`  metas              ${String(removerMetas.length).padEnd(10)} ${preservarMetas.length}`);
  console.log(`  atividades         ${String(removerAtividades.length).padEnd(10)} ${preservarAtividades.length}`);
  console.log(`  _seed_manifest     ${String(smSnap.size).padEnd(10)} 0`);

  const totalRemover = removerUsuarios.length + removerCampanhas.length + removerEleitores.length +
    removerMetas.length + removerAtividades.length + smSnap.size;
  const totalPreservar = preservarUsuarios.length + preservarCampanhas.length + preservarEleitores.length +
    preservarMetas.length + preservarAtividades.length;

  console.log(`  ──────────────────────────────────────`);
  console.log(`  ${C.yellow}TOTAL REMOVER  : ${totalRemover} documentos${C.reset}`);
  console.log(`  ${C.green}TOTAL PRESERVAR: ${totalPreservar} documentos${C.reset}`);

  console.log(`\n${C.bold}ROLLBACK:${C.reset} Não existe rollback automático após execução.`);
  console.log(`  Recomendação: exportar backup via Firebase Console antes de limpar.`);
  console.log(`  Alternativa : executar ${C.cyan}npm run seed:v3${C.reset} para recriar o cenário atual se necessário.\n`);

  if (superAdmin) {
    console.log(`${C.bold}${C.green}✓ Super Admin localizado e marcado para preservação:${C.reset}`);
    console.log(`  Email : ${superAdmin.email}`);
    console.log(`  UID   : ${superAdmin.id}`);
    console.log(`  Role  : ${superAdmin.role}`);
  } else {
    console.log(`${C.bold}${C.red}⚠ Super Admin NÃO encontrado na coleção usuarios.${C.reset}`);
    console.log(`  Email esperado: ${SUPER_ADMIN_EMAIL}`);
  }
  console.log();
}

main().catch((e) => { console.error(e); process.exit(1); });

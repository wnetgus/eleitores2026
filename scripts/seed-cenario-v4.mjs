#!/usr/bin/env node
/**
 * seed-cenario-v4.mjs — CENÁRIO EXECUTIVO v4.0
 *
 * Nova hierarquia oficial:
 *   Deputado Federal
 *     └─ Assessor Executivo        ← NOVO ROLE
 *          └─ Assessores Regionais (3)
 *               └─ Coordenadores (6)
 *                    └─ Mobilizadores (14)
 *                         └─ Eleitores (141)
 *
 * Fixes do v3:
 *   - Assessores agora têm campo `cidades: [...]` (array) além de `cidade`
 *   - Cria documentos em `assessorias` e `coordenacoes` (motor detecta corretamente)
 *   - Adiciona `assessor_executivo` entre deputado e assessores regionais
 *
 * USO:
 *   node scripts/seed-cenario-v4.mjs           (cria)
 *   node scripts/seed-cenario-v4.mjs --reset   (apaga e recria)
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

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
const MANIFEST = db.collection("_seed_manifest").doc("cenario_v4");

const SENHA = "111111";
const SUPER_EMAIL = "wnetgus@gmail.com";
const IS_RESET = process.argv.includes("--reset");

const ts = (dias) => Timestamp.fromDate(new Date(Date.now() - dias * 86_400_000));

let _docNum = 400001;
const proximoDoc = () => String(_docNum++).padStart(11, "0");

const NOMES_ELEITORES = [
  "João da Silva","Maria dos Santos","José Pereira","Ana Paula Oliveira",
  "Antônio Sousa","Francisca Lima","Raimundo Costa","Benedita Ferreira",
  "Francisco Alves","Conceição Ribeiro","Manoel Gomes","Luzia Cavalcanti",
  "Pedro Araújo","Josefa Rodrigues","Carlos Alberto Melo","Tereza Barros",
  "Luís Carlos Dias","Ednaldo Batista","Severina Teixeira","Cícero Moura",
  "Iracema Fonseca","Geraldo Pinto","Dalva Nascimento","Edmilson Cruz",
  "Zilda Borges","Expedito Lira","Gracinha Monteiro","Heraldo Vieira",
  "Sueli Correia","Nilton Braz","Rosângela Tavares","Valdir Nogueira",
  "Elza Porto","Wanderley Cunha","Nilda Ramos","Gilberto Azevedo",
  "Lourdes Cardoso","Adailton Freire","Marlene Sampaio","Dirceu Andrade",
];
let _nIdx = 0;
const proximoNomeEleitor = () => NOMES_ELEITORES[_nIdx++ % NOMES_ELEITORES.length];

function grauApoio(perfil) {
  const r = Math.random();
  if (perfil === "dominante")   { return r < 0.50 ? "forte" : r < 0.80 ? "medio" : r < 0.92 ? "fraco" : "indeciso"; }
  if (perfil === "equilibrado") { return r < 0.35 ? "forte" : r < 0.70 ? "medio" : r < 0.88 ? "fraco" : "indeciso"; }
  return r < 0.30 ? "forte" : r < 0.68 ? "medio" : r < 0.88 ? "fraco" : "indeciso";
}

async function criarUsuario(email, dados) {
  let uid;
  try {
    const u = await auth.createUser({ email, password: SENHA });
    uid = u.uid;
    log(`  ✅ [${dados.role}] ${email}`, C.green);
  } catch (e) {
    if (e.code === "auth/email-already-in-use") {
      const u = await auth.getUserByEmail(email);
      uid = u.uid;
      log(`  🔄 [${dados.role}] ${email} (reutilizando)`, C.yellow);
    } else {
      log(`  ❌ ${email}: ${e.message}`, C.red);
      return null;
    }
  }
  await db.collection("usuarios").doc(uid).set(
    { uid, email, ativo: true, _fake: true, ...dados },
    { merge: false }
  );
  return uid;
}

async function appendManifesto(campo, ids) {
  await MANIFEST.update({ [campo]: FieldValue.arrayUnion(...ids) });
}

// ─── ESTRUTURA DO CENÁRIO ────────────────────────────────────────────────────

const ESTRUTURA = [
  {
    email: "assessor.recife@mail.com",
    nome: "Carlos Menezes",
    cidade: "Recife", cidades: ["Recife"], estado: "PE", perfil: "dominante",
    coordenadores: [
      {
        email: "coord.recife.boaviagem@mail.com",
        nome: "Marcos Lima",
        bairro: "Boa Viagem", cidade: "Recife", estado: "PE",
        mobilizadores: [
          { email: "mob.recife.boaviagem.1@mail.com", nome: "Tânia Silva",   qtd: 15 },
          { email: "mob.recife.boaviagem.2@mail.com", nome: "Lucas Ramos",   qtd: 15 },
          { email: "mob.recife.boaviagem.3@mail.com", nome: "Beatriz Moura", qtd: 15 },
        ],
      },
      {
        email: "coord.recife.imbiribeira@mail.com",
        nome: "Juliana Costa",
        bairro: "Imbiribeira", cidade: "Recife", estado: "PE",
        mobilizadores: [
          { email: "mob.recife.imbiribeira.1@mail.com", nome: "Rafael Cruz",  qtd: 12 },
          { email: "mob.recife.imbiribeira.2@mail.com", nome: "Camila Pinto", qtd: 12 },
        ],
      },
    ],
  },
  {
    email: "assessor.caruaru@mail.com",
    nome: "Ana Ferreira",
    cidade: "Caruaru", cidades: ["Caruaru"], estado: "PE", perfil: "equilibrado",
    coordenadores: [
      {
        email: "coord.caruaru.centro@mail.com",
        nome: "Roberto Silva",
        bairro: "Centro", cidade: "Caruaru", estado: "PE",
        mobilizadores: [
          { email: "mob.caruaru.centro.1@mail.com", nome: "Anderson Dias", qtd: 10 },
          { email: "mob.caruaru.centro.2@mail.com", nome: "Sandra Barros", qtd: 10 },
          { email: "mob.caruaru.centro.3@mail.com", nome: "Felipe Torres", qtd: 10 },
        ],
      },
      {
        email: "coord.caruaru.indianopolis@mail.com",
        nome: "Fernanda Luz",
        bairro: "Indianópolis", cidade: "Caruaru", estado: "PE",
        mobilizadores: [
          { email: "mob.caruaru.indianopolis.1@mail.com", nome: "Vanessa Rocha", qtd: 8 },
          { email: "mob.caruaru.indianopolis.2@mail.com", nome: "Eduardo Melo",  qtd: 8 },
        ],
      },
    ],
  },
  {
    email: "assessor.petrolina@mail.com",
    nome: "Pedro Santos",
    cidade: "Petrolina", cidades: ["Petrolina"], estado: "PE", perfil: "crescendo",
    coordenadores: [
      {
        email: "coord.petrolina.centro@mail.com",
        nome: "Diego Campos",
        bairro: "Centro", cidade: "Petrolina", estado: "PE",
        mobilizadores: [
          { email: "mob.petrolina.centro.1@mail.com", nome: "Simone Araújo", qtd: 7 },
          { email: "mob.petrolina.centro.2@mail.com", nome: "Henrique Lima", qtd: 7 },
        ],
      },
      {
        email: "coord.petrolina.areia@mail.com",
        nome: "Patrícia Neves",
        bairro: "Areia", cidade: "Petrolina", estado: "PE",
        mobilizadores: [
          { email: "mob.petrolina.areia.1@mail.com", nome: "Letícia Souza",   qtd: 6 },
          { email: "mob.petrolina.areia.2@mail.com", nome: "Rodrigo Fonseca", qtd: 6 },
        ],
      },
    ],
  },
];

// ─── LIMPEZA ──────────────────────────────────────────────────────────────────

async function limparAnterior() {
  log("🗑️  Limpando cenário anterior (v4)...", C.yellow);
  const snap = await MANIFEST.get();
  if (!snap.exists) { log("  Nada a limpar.\n", C.dim); return; }
  const { authUids = [], usuarioIds = [], eleitorIds = [], gabineteIds = [], assessoriaIds = [], coordenacaoIds = [] } = snap.data();
  const superUid = await auth.getUserByEmail(SUPER_EMAIL).then(u => u.uid).catch(() => null);
  const uidsRemover = authUids.filter(u => u !== superUid);
  if (uidsRemover.length) await auth.deleteUsers(uidsRemover);
  for (let i = 0; i < usuarioIds.length; i += 500) {
    const b = db.batch();
    usuarioIds.slice(i, i + 500).forEach(id => b.delete(db.collection("usuarios").doc(id)));
    await b.commit();
  }
  for (let i = 0; i < eleitorIds.length; i += 500) {
    const b = db.batch();
    eleitorIds.slice(i, i + 500).forEach(id => b.delete(db.collection("eleitores").doc(id)));
    await b.commit();
  }
  for (const id of gabineteIds) await db.collection("campanhas").doc(id).delete();
  for (const id of assessoriaIds) await db.collection("assessorias").doc(id).delete().catch(() => {});
  for (const id of coordenacaoIds) await db.collection("coordenacoes").doc(id).delete().catch(() => {});
  await MANIFEST.delete();
  log("  ✅ Cenário anterior (v4) limpo.\n", C.green);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  log("\n" + "═".repeat(65), C.cyan);
  log("  🌱  SEED v4.0 — CENÁRIO EXECUTIVO — ELEITORES 2026", C.bold + C.cyan);
  log("═".repeat(65) + "\n", C.cyan);

  const snap = await MANIFEST.get();
  if (snap.exists && !IS_RESET) {
    log("⚠️  Cenário v4 já existe. Use --reset para recriar:", C.yellow);
    log("   npm run seed:v4:reset\n", C.dim);
    process.exit(0);
  }
  if (IS_RESET) await limparAnterior();

  const superUid = (await auth.getUserByEmail(SUPER_EMAIL)).uid;

  await MANIFEST.set({
    versao: "4.0", criadoEm: FieldValue.serverTimestamp(),
    gabineteIds: [], authUids: [], usuarioIds: [], eleitorIds: [],
    assessoriaIds: [], coordenacaoIds: [],
  });

  // ── GABINETE ──────────────────────────────────────────────────────
  log("📌 GABINETE", C.blue + C.bold);
  const gabRef = await db.collection("campanhas").add({
    nome: "Ricardo Alves — Pernambuco 2026",
    slug: "ricardo-alves-pernambuco-2026-v4",
    politicoNome: "Ricardo Alves",
    politicoEmail: "dep.federal@mail.com",
    politicoPartido: "AVANTE",
    politicoNumero: "7026",
    cargo: "deputado_federal",
    nivelPolitico: "federal",
    cicloEleitoral: "estadual_federal_2026",
    corPrincipal: "#2563eb",
    estado: "PE",
    municipios: ["Recife", "Caruaru", "Petrolina"],
    metaEleitoral: 10000,
    ativo: true,
    criadoPor: superUid,
    criadoEm: ts(30),
    _fake: true,
  });
  const gabId = gabRef.id;
  await gabRef.update({ gabineteId: gabId, campanhaId: gabId });
  await appendManifesto("gabineteIds", [gabId]);
  log(`  ✅ Gabinete: ${gabId}\n`, C.green);

  const BASE = { gabineteId: gabId, campanhaId: gabId, criadoPor: superUid };

  // ── DEPUTADO ──────────────────────────────────────────────────────
  log("🎤 DEPUTADO FEDERAL", C.blue + C.bold);
  const depUid = await criarUsuario("dep.federal@mail.com", {
    ...BASE, nome: "Ricardo Alves", role: "politico",
    cidadePrincipal: "Recife", cidades: ["Recife", "Caruaru", "Petrolina"],
    cidade: "Recife", estado: "PE",
    criadoEm: ts(30), ultimaAtividade: ts(0),
  });
  await appendManifesto("authUids", [depUid]);
  await appendManifesto("usuarioIds", [depUid]);

  // ── ASSESSOR EXECUTIVO ─────────────────────────────────────────────
  log("\n⚡ ASSESSOR EXECUTIVO", C.blue + C.bold);
  const aexUid = await criarUsuario("assessor.executivo@mail.com", {
    ...BASE, nome: "Marcos Executivo", role: "assessor_executivo",
    cidadePrincipal: "Recife", cidades: ["Recife", "Caruaru", "Petrolina"],
    cidade: "Recife", estado: "PE",
    criadoEm: ts(28), ultimaAtividade: ts(0),
  });
  await appendManifesto("authUids", [aexUid]);
  await appendManifesto("usuarioIds", [aexUid]);

  // ── ESTRUTURA TERRITORIAL ─────────────────────────────────────────
  log("\n🗺️  ESTRUTURA TERRITORIAL\n", C.blue + C.bold);

  let totalEleitores = 0;
  const allAuthUids = [];
  const allUsuarioIds = [];
  const allEleitorIds = [];
  const allAssessoriaIds = [];
  const allCoordenacaoIds = [];

  for (const assessorDef of ESTRUTURA) {
    log(`  ▶ ASSESSOR REGIONAL — ${assessorDef.cidade} [${assessorDef.perfil}]`, C.cyan);

    const assessorUid = await criarUsuario(assessorDef.email, {
      ...BASE,
      nome: assessorDef.nome,
      role: "assessor",
      assessorExecutivoId: aexUid,
      cidadePrincipal: assessorDef.cidade,
      cidade: assessorDef.cidade,
      cidades: assessorDef.cidades,
      estado: assessorDef.estado,
      criadoEm: ts(25), ultimaAtividade: ts(2),
    });
    if (!assessorUid) continue;
    allAuthUids.push(assessorUid);
    allUsuarioIds.push(assessorUid);

    // Criar documento de assessoria formal (motor detecta possuiAssessoria)
    const assessoriaRef = await db.collection("assessorias").add({
      municipio:     assessorDef.cidade,
      campanhaId:    gabId,
      assessorId:    assessorUid,
      assessorNome:  assessorDef.nome,
      status:        "ativa",
      criadoEm:      ts(24),
      criadoPor:     aexUid,
      criadoPorNome: "Marcos Executivo",
      _fake:         true,
    });
    allAssessoriaIds.push(assessoriaRef.id);
    log(`    📋 Assessoria criada: ${assessorDef.cidade}`, C.dim);

    for (const coordDef of assessorDef.coordenadores) {
      log(`    ▷ COORD — ${coordDef.bairro}`, C.dim);

      const coordUid = await criarUsuario(coordDef.email, {
        ...BASE,
        nome: coordDef.nome,
        role: "coordenador",
        assessorId: assessorUid,
        assessorExecutivoId: aexUid,
        bairro: coordDef.bairro,
        cidadePrincipal: coordDef.cidade,
        cidade: coordDef.cidade,
        estado: coordDef.estado,
        criadoEm: ts(20), ultimaAtividade: ts(3),
      });
      if (!coordUid) continue;
      allAuthUids.push(coordUid);
      allUsuarioIds.push(coordUid);

      // Criar documento de coordenação formal (motor detecta possuiCoordenacao)
      const coordenacaoRef = await db.collection("coordenacoes").add({
        municipio:       coordDef.cidade,
        campanhaId:      gabId,
        coordenadorId:   coordUid,
        coordenadorNome: coordDef.nome,
        assessorId:      assessorUid,
        bairro:          coordDef.bairro,
        status:          "ativa",
        criadoEm:        ts(19),
        criadoPor:       aexUid,
        criadoPorNome:   "Marcos Executivo",
        _fake:           true,
      });
      allCoordenacaoIds.push(coordenacaoRef.id);

      for (const mobDef of coordDef.mobilizadores) {
        const mobUid = await criarUsuario(mobDef.email, {
          ...BASE,
          nome: mobDef.nome,
          role: "colaborador",
          status: "ativo",
          coordenadorId: coordUid,
          assessorId: assessorUid,
          assessorExecutivoId: aexUid,
          bairro: coordDef.bairro,
          cidade: coordDef.cidade,
          estado: coordDef.estado,
          criadoEm: ts(15), ultimaAtividade: ts(1),
        });
        if (!mobUid) continue;
        allAuthUids.push(mobUid);
        allUsuarioIds.push(mobUid);

        const eleitorBatch = [];
        for (let e = 0; e < mobDef.qtd; e++) {
          const eRef = db.collection("eleitores").doc();
          eleitorBatch.push({
            ref: eRef,
            dados: {
              campanhaId: gabId,
              gabineteId: gabId,
              assessorId: assessorUid,
              assessorExecutivoId: aexUid,
              coordenadorId: coordUid,
              coordenadorNome: coordDef.nome,
              colaboradorId: mobUid,
              colaboradorNome: mobDef.nome,
              nomeCompleto: proximoNomeEleitor(),
              tipoDocumento: "titulo",
              documento: proximoDoc(),
              estado: coordDef.estado,
              cidade: coordDef.cidade,
              bairro: coordDef.bairro,
              grauApoio: grauApoio(assessorDef.perfil),
              observacoes: "",
              criadoEm: ts(Math.floor(Math.random() * 20) + 1),
              _fake: true,
            },
          });
        }

        for (let i = 0; i < eleitorBatch.length; i += 500) {
          const b = db.batch();
          eleitorBatch.slice(i, i + 500).forEach(({ ref, dados }) => b.set(ref, dados));
          await b.commit();
        }
        allEleitorIds.push(...eleitorBatch.map(({ ref }) => ref.id));
        totalEleitores += mobDef.qtd;
      }
    }
    log("", C.reset);
  }

  await appendManifesto("authUids",       allAuthUids);
  await appendManifesto("usuarioIds",     allUsuarioIds);
  await appendManifesto("eleitorIds",     allEleitorIds);
  await appendManifesto("assessoriaIds",  allAssessoriaIds);
  await appendManifesto("coordenacaoIds", allCoordenacaoIds);

  // ── RESUMO ────────────────────────────────────────────────────────
  log("═".repeat(65), C.cyan);
  log("  ✅  CENÁRIO v4.0 CRIADO COM SUCESSO", C.bold + C.green);
  log("═".repeat(65), C.cyan);

  log(`
  HIERARQUIA OFICIAL
  ══════════════════

  DEPUTADO FEDERAL
  ├─ email:  dep.federal@mail.com
  ├─ nome:   Ricardo Alves
  └─ senha:  111111

  ASSESSOR EXECUTIVO                ← NOVO
  ├─ email:  assessor.executivo@mail.com
  ├─ nome:   Marcos Executivo
  ├─ role:   assessor_executivo
  └─ senha:  111111

  ASSESSORES REGIONAIS (3)
  ├─ assessor.recife@mail.com      → Carlos Menezes    [Recife   · dominante]
  ├─ assessor.caruaru@mail.com     → Ana Ferreira      [Caruaru  · equilibrado]
  └─ assessor.petrolina@mail.com   → Pedro Santos      [Petrolina · crescendo]

  COORDENADORES (6)
  ├─ coord.recife.boaviagem@mail.com      → Marcos Lima    [Boa Viagem/Recife]
  ├─ coord.recife.imbiribeira@mail.com    → Juliana Costa  [Imbiribeira/Recife]
  ├─ coord.caruaru.centro@mail.com        → Roberto Silva  [Centro/Caruaru]
  ├─ coord.caruaru.indianopolis@mail.com  → Fernanda Luz   [Indianópolis/Caruaru]
  ├─ coord.petrolina.centro@mail.com      → Diego Campos   [Centro/Petrolina]
  └─ coord.petrolina.areia@mail.com       → Patrícia Neves [Areia/Petrolina]

  MOBILIZADORES (14)
  ├─ mob.recife.boaviagem.1@mail.com      → Tânia Silva
  ├─ mob.recife.boaviagem.2@mail.com      → Lucas Ramos
  ├─ mob.recife.boaviagem.3@mail.com      → Beatriz Moura
  ├─ mob.recife.imbiribeira.1@mail.com    → Rafael Cruz
  ├─ mob.recife.imbiribeira.2@mail.com    → Camila Pinto
  ├─ mob.caruaru.centro.1@mail.com        → Anderson Dias
  ├─ mob.caruaru.centro.2@mail.com        → Sandra Barros
  ├─ mob.caruaru.centro.3@mail.com        → Felipe Torres
  ├─ mob.caruaru.indianopolis.1@mail.com  → Vanessa Rocha
  ├─ mob.caruaru.indianopolis.2@mail.com  → Eduardo Melo
  ├─ mob.petrolina.centro.1@mail.com      → Simone Araújo
  ├─ mob.petrolina.centro.2@mail.com      → Henrique Lima
  ├─ mob.petrolina.areia.1@mail.com       → Letícia Souza
  └─ mob.petrolina.areia.2@mail.com       → Rodrigo Fonseca

  DOCUMENTOS FIRESTORE CRIADOS
  ├─ assessorias:   3  (Recife · Caruaru · Petrolina)
  ├─ coordenacoes:  6  (2 por município)
  └─ missoes:       0  (criadas via UI pelo Deputado)`);

  log(`\n  TOTAIS`, C.bold);
  log(`  ├─ Contas Auth:  ${2 + allAuthUids.length}  (dep + assessor_exec + equipe)`);
  log(`  ├─ Usuários FS:  ${2 + allUsuarioIds.length}`);
  log(`  ├─ Eleitores:    ${totalEleitores}`);
  log(`  ├─ Assessorias:  ${allAssessoriaIds.length}`);
  log(`  ├─ Coordenações: ${allCoordenacaoIds.length}`);
  log(`  └─ Gabinetes:    1`);
  log(`\n  Senha padrão de todos: 111111`);
  log(`\n  FLUXO DE TESTE:`);
  log(`  1. Login: dep.federal@mail.com → Dashboard → Criar Missão`);
  log(`  2. Login: assessor.executivo@mail.com → Missões → Aceitar → Executar`);
  log(`  3. Verificar: dashboard do deputado atualiza (IST, pendências somem)\n`);
}

main().catch((e) => { log(`\n❌ Erro fatal: ${e.message}`, C.red); process.exit(1); });

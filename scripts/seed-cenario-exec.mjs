#!/usr/bin/env node
/**
 * seed-cenario-exec.mjs — CENÁRIO EXECUTIVO DE ESTRESSE v1.0
 *
 * 1 deputado estadual · 5 assessores (A1=excelente…A5=inativo)
 * 14 coordenadores · 46 colaboradores · ~706 eleitores · 17 municípios PE
 *
 * USO:
 *   node scripts/seed-cenario-exec.mjs           (cria)
 *   node scripts/seed-cenario-exec.mjs --reset   (apaga e recria)
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

// ─────────────────────────────────────────────────────────────────
// ENV
// ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// CORES / LOG
// ─────────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", cyan: "\x1b[36m", magenta: "\x1b[35m",
};
const log = (m, c = C.reset) => console.log(c + m + C.reset);
const sep = (c = C.cyan) => log("─".repeat(70), c);

// ─────────────────────────────────────────────────────────────────
// FIREBASE
// ─────────────────────────────────────────────────────────────────
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!privateKey || !clientEmail || !projectId) {
  log("❌ Variáveis de ambiente não encontradas.", C.red); process.exit(1);
}
if (getApps().length === 0) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

const auth = getAuth();
const db = getFirestore();
const MANIFEST = db.collection("_seed_manifest").doc("cenario_exec");

// ─────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────
const SENHA       = "111111";
const SUPER_EMAIL = "wnetgus@gmail.com";
const SUPER_NOME  = "Weyne Souza";
const IS_RESET    = process.argv.includes("--reset");

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const ts = (dias) => Timestamp.fromDate(new Date(Date.now() - dias * 86_400_000));

let _docNum = 500001;
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
  "Telma Cruz","Sérgio Figueiredo","Marta Barros","Aldair Nascimento",
  "Neide Oliveira","Ronaldo Peixoto","Cleide Nunes","Altair Bezerra",
  "Vânia Melo","Djalma Cardoso","Risoneide Martins","Iraci Gomes",
  "Cicero Filho","Jacinta Leite","Osmar Braga","Luciene Campos",
  "Inácio Vieira","Fatima Moraes","Dilson Assis","Geralda Siqueira",
  "Aurino Lima","Terezinha Araújo","Edvaldo Queiroz","Josileide Neto",
  "Rivaldo Costa","Nevinha Ferraz","Lúcio Rocha","Suzenita Pires",
  "Amadeu Teles","Pedrina Santos","Ataíde Filho","Glorinha Leal",
  "Jurandir Paz","Cremilda Brito","Nonato Sá","Liduina Pereira",
  "Wanderson Mendes","Norberta Gomes","Haroldo Alencar","Celiete Moura",
  "Clovis Barros","Teresinha Lima","Egídio Porto","Ivanda Cruz",
  "Horácio Faria","Nadir Nogueira","Belarmino Melo","Cacilda Sousa",
  "Alfredo Dias","Zelita Cunha","Domingos Costa","Generosa Alves",
  "Epitácio Rocha","Natalina Braz","Devanildo Azevedo","Zeneide Sampaio",
  "Arilton Freire","Marinalva Andrade","Lindomar Tavares","Zelinda Monteiro",
];
let _nIdx = 0;
const proximoNomeEleitor = () => NOMES_ELEITORES[_nIdx++ % NOMES_ELEITORES.length];

function grauApoio(perfil) {
  const r = Math.random();
  if (perfil === "excelente") return r < 0.35 ? "forte" : r < 0.65 ? "medio" : r < 0.87 ? "indeciso" : "fraco";
  if (perfil === "bom")       return r < 0.22 ? "forte" : r < 0.55 ? "medio" : r < 0.80 ? "indeciso" : "fraco";
  if (perfil === "mediano")   return r < 0.12 ? "forte" : r < 0.45 ? "medio" : r < 0.73 ? "indeciso" : "fraco";
  if (perfil === "fraco")     return r < 0.08 ? "forte" : r < 0.33 ? "medio" : r < 0.65 ? "indeciso" : "fraco";
  return "indeciso";
}

function diasAtras(perfil) {
  const r = Math.random();
  if (perfil === "excelente") {
    if (r < 0.50) return Math.floor(Math.random() * 15);
    if (r < 0.82) return 15 + Math.floor(Math.random() * 30);
    return 45 + Math.floor(Math.random() * 46);
  }
  if (perfil === "bom") {
    if (r < 0.40) return Math.floor(Math.random() * 15);
    if (r < 0.75) return 15 + Math.floor(Math.random() * 30);
    return 45 + Math.floor(Math.random() * 46);
  }
  if (perfil === "mediano") {
    if (r < 0.25) return Math.floor(Math.random() * 15);
    if (r < 0.65) return 15 + Math.floor(Math.random() * 30);
    return 45 + Math.floor(Math.random() * 46);
  }
  // fraco: base antiga, estagnada
  if (r < 0.10) return Math.floor(Math.random() * 15);
  if (r < 0.40) return 15 + Math.floor(Math.random() * 30);
  return 45 + Math.floor(Math.random() * 46);
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
  if (!ids.length) return;
  await MANIFEST.update({ [campo]: FieldValue.arrayUnion(...ids) });
}

async function gravarEleitores(lote, allEleitorIds) {
  for (let i = 0; i < lote.length; i += 500) {
    const b = db.batch();
    lote.slice(i, i + 500).forEach(({ ref, dados }) => b.set(ref, dados));
    await b.commit();
  }
  allEleitorIds.push(...lote.map(({ ref }) => ref.id));
}

// ─────────────────────────────────────────────────────────────────
// ESTRUTURA DO CENÁRIO
// meta: null = sem meta individual (usa metaPadraoEquipe do coord ou fica sem_meta)
// ─────────────────────────────────────────────────────────────────
const ESTRUTURA = [
  {
    // ── A1 — EXCELENTE ─────────────────────────────────────────────
    email: "assessor.a1@teste.com", nome: "Marcos Andrade",
    perfil: "excelente", perfilLabel: "Excelente",
    cidades: ["Recife", "Olinda", "Jaboatão dos Guararapes"], estado: "PE",
    coordenadores: [
      {
        email: "coordenador.a1.1@teste.com", nome: "Daniela Ferraz",
        cidade: "Recife", bairro: "Boa Viagem", estado: "PE", metaPadraoEquipe: 18,
        colaboradores: [
          { email: "colaborador.a1.1.1@teste.com", nome: "Tatiane Braga",  qtd: 30, meta: 20 },
          { email: "colaborador.a1.1.2@teste.com", nome: "Jonas Macedo",   qtd: 28, meta: 22 },
          { email: "colaborador.a1.1.3@teste.com", nome: "Silvia Rego",    qtd: 26, meta: 20 },
          { email: "colaborador.a1.1.4@teste.com", nome: "Marcus Aguiar",  qtd: 24, meta: 18 },
          { email: "colaborador.a1.1.5@teste.com", nome: "Laís Campos",    qtd: 22, meta: 18 },
          { email: "colaborador.a1.1.6@teste.com", nome: "Cleiton Rocha",  qtd: 20, meta: null },
        ],
      },
      {
        email: "coordenador.a1.2@teste.com", nome: "Sandro Leal",
        cidade: "Recife", bairro: "Imbiribeira", estado: "PE", metaPadraoEquipe: 16,
        colaboradores: [
          { email: "colaborador.a1.2.1@teste.com", nome: "Roberta Freitas", qtd: 24, meta: 18 },
          { email: "colaborador.a1.2.2@teste.com", nome: "Yuri Sampaio",    qtd: 22, meta: 20 },
          { email: "colaborador.a1.2.3@teste.com", nome: "Ingrid Peres",    qtd: 20, meta: 18 },
          { email: "colaborador.a1.2.4@teste.com", nome: "Davi Cunha",      qtd: 18, meta: 16 },
          { email: "colaborador.a1.2.5@teste.com", nome: "Nara Batista",    qtd: 18, meta: 16 },
        ],
      },
      {
        email: "coordenador.a1.3@teste.com", nome: "Natália Vasconcelos",
        cidade: "Olinda", bairro: "Centro", estado: "PE", metaPadraoEquipe: 14,
        colaboradores: [
          { email: "colaborador.a1.3.1@teste.com", nome: "Marcos Filho",   qtd: 22, meta: 18 },
          { email: "colaborador.a1.3.2@teste.com", nome: "Tamires Belo",   qtd: 20, meta: 16 },
          { email: "colaborador.a1.3.3@teste.com", nome: "Estevam Luz",    qtd: 18, meta: 16 },
          { email: "colaborador.a1.3.4@teste.com", nome: "Cátia Sousa",    qtd: 16, meta: 14 },
          { email: "colaborador.a1.3.5@teste.com", nome: "Vinícius Porto", qtd: 14, meta: null },
        ],
      },
    ],
  },
  {
    // ── A2 — BOM ───────────────────────────────────────────────────
    email: "assessor.a2@teste.com", nome: "Juliana Melo",
    perfil: "bom", perfilLabel: "Bom",
    cidades: ["Caruaru", "Bezerros", "Gravatá"], estado: "PE",
    coordenadores: [
      {
        email: "coordenador.a2.1@teste.com", nome: "Thiago Cavalcante",
        cidade: "Caruaru", bairro: "Centro", estado: "PE", metaPadraoEquipe: 14,
        colaboradores: [
          { email: "colaborador.a2.1.1@teste.com", nome: "Adriana Nóbrega",    qtd: 20, meta: 16 },
          { email: "colaborador.a2.1.2@teste.com", nome: "Leandro Cruz",        qtd: 18, meta: 16 },
          { email: "colaborador.a2.1.3@teste.com", nome: "Vanessa Pinto",       qtd: 16, meta: 14 },
          { email: "colaborador.a2.1.4@teste.com", nome: "Ricardo Albuquerque", qtd: 14, meta: 14 },
          { email: "colaborador.a2.1.5@teste.com", nome: "Débora Lima",         qtd: 12, meta: 12 },
        ],
      },
      {
        email: "coordenador.a2.2@teste.com", nome: "Renata Moreira",
        cidade: "Caruaru", bairro: "Indianópolis", estado: "PE", metaPadraoEquipe: 12,
        colaboradores: [
          { email: "colaborador.a2.2.1@teste.com", nome: "Fernando Bessa",    qtd: 16, meta: 14 },
          { email: "colaborador.a2.2.2@teste.com", nome: "Mônica Figueiredo", qtd: 14, meta: 14 },
          { email: "colaborador.a2.2.3@teste.com", nome: "Igor Salles",        qtd: 14, meta: 12 },
          { email: "colaborador.a2.2.4@teste.com", nome: "Cristiane Paes",     qtd: 12, meta: null },
        ],
      },
      {
        email: "coordenador.a2.3@teste.com", nome: "Gilvandro Paz",
        cidade: "Bezerros", bairro: "Centro", estado: "PE", metaPadraoEquipe: 10,
        colaboradores: [
          { email: "colaborador.a2.3.1@teste.com", nome: "Edna Queiroz",   qtd: 14, meta: 12 },
          { email: "colaborador.a2.3.2@teste.com", nome: "Jader Neri",     qtd: 12, meta: 12 },
          { email: "colaborador.a2.3.3@teste.com", nome: "Lúcia Abreu",    qtd: 12, meta: 10 },
          { email: "colaborador.a2.3.4@teste.com", nome: "Humberto Lira",  qtd: 10, meta: null },
        ],
      },
    ],
  },
  {
    // ── A3 — MEDIANO ───────────────────────────────────────────────
    email: "assessor.a3@teste.com", nome: "Pedro Coelho",
    perfil: "mediano", perfilLabel: "Mediano",
    cidades: ["Petrolina", "Salgueiro", "Arcoverde"], estado: "PE",
    coordenadores: [
      {
        email: "coordenador.a3.1@teste.com", nome: "Érica Monteiro",
        cidade: "Petrolina", bairro: "Centro", estado: "PE", metaPadraoEquipe: 12,
        colaboradores: [
          { email: "colaborador.a3.1.1@teste.com", nome: "Giovani Tavares", qtd: 16, meta: 16 },
          { email: "colaborador.a3.1.2@teste.com", nome: "Simone Barros",   qtd: 12, meta: 16 },
          { email: "colaborador.a3.1.3@teste.com", nome: "Aldo Rezende",    qtd: 12, meta: 14 },
          { email: "colaborador.a3.1.4@teste.com", nome: "Patrícia Maia",   qtd: 10, meta: null },
        ],
      },
      {
        email: "coordenador.a3.2@teste.com", nome: "Walisson Brito",
        cidade: "Petrolina", bairro: "Cohab", estado: "PE", metaPadraoEquipe: 10,
        colaboradores: [
          { email: "colaborador.a3.2.1@teste.com", nome: "Gerson Alves", qtd: 14, meta: 14 },
          { email: "colaborador.a3.2.2@teste.com", nome: "Sueli Dantas",  qtd: 10, meta: 12 },
          { email: "colaborador.a3.2.3@teste.com", nome: "Cleber Matos",  qtd: 10, meta: null },
        ],
      },
      {
        email: "coordenador.a3.3@teste.com", nome: "Priscila Sá",
        cidade: "Salgueiro", bairro: "Centro", estado: "PE", metaPadraoEquipe: 10,
        colaboradores: [
          { email: "colaborador.a3.3.1@teste.com", nome: "Neto Pereira",   qtd: 14, meta: 10 },
          { email: "colaborador.a3.3.2@teste.com", nome: "Beatriz Mendes", qtd: 10, meta: 10 },
          { email: "colaborador.a3.3.3@teste.com", nome: "Aécio Gomes",    qtd: 10, meta: null },
        ],
      },
    ],
  },
  {
    // ── A4 — FRACO ─────────────────────────────────────────────────
    email: "assessor.a4@teste.com", nome: "Carla Neves",
    perfil: "fraco", perfilLabel: "Fraco",
    cidades: ["Garanhuns", "Palmares", "Pesqueira"], estado: "PE",
    coordenadores: [
      {
        email: "coordenador.a4.1@teste.com", nome: "Hélio Guimarães",
        cidade: "Garanhuns", bairro: "Centro", estado: "PE", metaPadraoEquipe: 0,
        colaboradores: [
          { email: "colaborador.a4.1.1@teste.com", nome: "Carlinhos Soares", qtd: 12, meta: 30 },
          { email: "colaborador.a4.1.2@teste.com", nome: "Vera Pinheiro",    qtd: 10, meta: 25 },
          { email: "colaborador.a4.1.3@teste.com", nome: "Nildo Faria",      qtd: 8,  meta: 20 },
          { email: "colaborador.a4.1.4@teste.com", nome: "Graça Teixeira",   qtd: 6,  meta: null },
        ],
      },
      {
        email: "coordenador.a4.2@teste.com", nome: "Solange Teles",
        cidade: "Palmares", bairro: "Centro", estado: "PE", metaPadraoEquipe: 0,
        colaboradores: [
          { email: "colaborador.a4.2.1@teste.com", nome: "Eudes Borges",  qtd: 10, meta: 25 },
          { email: "colaborador.a4.2.2@teste.com", nome: "Nubia Lemos",   qtd: 8,  meta: 20 },
          // Walter Coelho: meta definida, 0 eleitores → "sem progresso"
          { email: "colaborador.a4.2.3@teste.com", nome: "Walter Coelho", qtd: 0,  meta: 15 },
        ],
      },
      {
        // COORDENADOR ABANDONADO — 0 colaboradores, 0 eleitores
        email: "coordenador.a4.3@teste.com", nome: "Mauro Lustosa",
        cidade: "Pesqueira", bairro: "Centro", estado: "PE", metaPadraoEquipe: 0,
        isAbandoned: true,
        colaboradores: [],
      },
    ],
  },
  {
    // ── A5 — INATIVO ───────────────────────────────────────────────
    email: "assessor.a5@teste.com", nome: "Carlos Silva",
    perfil: "inativo", perfilLabel: "Inativo",
    cidades: ["Nazaré da Mata", "Goiana", "Timbaúba"], estado: "PE",
    coordenadores: [
      {
        email: "coordenador.a5.1@teste.com", nome: "Fábio Tavares",
        cidade: "Nazaré da Mata", bairro: "Centro", estado: "PE", metaPadraoEquipe: 0,
        isAbandoned: true, colaboradores: [],
      },
      {
        email: "coordenador.a5.2@teste.com", nome: "Irene Mota",
        cidade: "Goiana", bairro: "Centro", estado: "PE", metaPadraoEquipe: 0,
        isAbandoned: true, colaboradores: [],
      },
    ],
  },
];

// Eleitores sem liderança — municípios sem coordenador
const ORFAOS = [
  { cidade: "Surubim", bairro: "Centro", qtd: 4 },
  { cidade: "Caetés",  bairro: "Centro", qtd: 4 },
];

// ─────────────────────────────────────────────────────────────────
// LIMPEZA (--reset)
// ─────────────────────────────────────────────────────────────────
async function limparAnterior() {
  log("🗑️  Limpando cenário anterior...", C.yellow);
  const snap = await MANIFEST.get();
  if (!snap.exists) { log("  Nada a limpar.\n", C.dim); return; }
  const { authUids = [], usuarioIds = [], eleitorIds = [], gabineteIds = [], metaIds = [] } = snap.data();

  const superUid = await auth.getUserByEmail(SUPER_EMAIL).then(u => u.uid).catch(() => null);
  const uidsRemover = authUids.filter(u => u !== superUid);
  for (let i = 0; i < uidsRemover.length; i += 1000) {
    await auth.deleteUsers(uidsRemover.slice(i, i + 1000));
  }

  const batchDel = async (col, ids) => {
    for (let i = 0; i < ids.length; i += 500) {
      const b = db.batch();
      ids.slice(i, i + 500).forEach(id => b.delete(db.collection(col).doc(id)));
      await b.commit();
    }
  };
  await batchDel("usuarios", usuarioIds);
  await batchDel("eleitores", eleitorIds);
  await batchDel("metas", metaIds);
  for (const id of gabineteIds) await db.collection("campanhas").doc(id).delete();
  await MANIFEST.delete();
  log("  ✅ Cenário anterior limpo.\n", C.green);
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
async function main() {
  log("\n" + "═".repeat(70), C.cyan);
  log("  🌱  SEED EXEC v1.0 — CENÁRIO EXECUTIVO DE ESTRESSE — ELEITORES 2026", C.bold + C.cyan);
  log("═".repeat(70) + "\n", C.cyan);

  const snap = await MANIFEST.get();
  if (snap.exists && !IS_RESET) {
    log("⚠️  Cenário já existe. Use --reset para recriar:", C.yellow);
    log("   node scripts/seed-cenario-exec.mjs --reset\n", C.dim);
    process.exit(0);
  }
  if (IS_RESET) await limparAnterior();

  const superUid = (await auth.getUserByEmail(SUPER_EMAIL)).uid;

  await MANIFEST.set({
    versao: "exec-1.0",
    criadoEm: FieldValue.serverTimestamp(),
    gabineteIds: [], authUids: [], usuarioIds: [], eleitorIds: [], metaIds: [],
  });

  // ── GABINETE ─────────────────────────────────────────────────────
  log("📌 GABINETE", C.blue + C.bold);
  const todosMunicipios = [
    ...new Set(ESTRUTURA.flatMap(a => a.cidades)),
    "Surubim", "Caetés",
  ];
  const gabRef = await db.collection("campanhas").add({
    nome: "Ricardo Fonseca — Pernambuco 2026",
    slug: "ricardo-fonseca-pernambuco-2026",
    politicoNome: "Ricardo Fonseca",
    politicoEmail: "deputado@teste.com",
    politicoPartido: "PROGRESSISTAS",
    politicoNumero: "1126",
    cargo: "deputado_estadual",
    nivelPolitico: "estadual",
    cicloEleitoral: "estadual_federal_2026",
    corPrincipal: "#1d4ed8",
    estado: "PE",
    municipios: todosMunicipios,
    metaEleitoral: 50000,
    ativo: true,
    criadoPor: superUid,
    criadoEm: ts(60),
    _fake: true,
  });
  const gabId = gabRef.id;
  await gabRef.update({ gabineteId: gabId, campanhaId: gabId });
  await MANIFEST.update({ gabineteIds: FieldValue.arrayUnion(gabId) });
  log(`  ✅ Gabinete: ${gabId}\n`, C.green);

  const BASE = { gabineteId: gabId, campanhaId: gabId, criadoPor: superUid };

  // ── DEPUTADO ──────────────────────────────────────────────────────
  log("👤 DEPUTADO ESTADUAL", C.blue + C.bold);
  const depUid = await criarUsuario("deputado@teste.com", {
    ...BASE,
    nome: "Ricardo Fonseca",
    role: "politico",
    cidadePrincipal: "Recife",
    cidades: todosMunicipios,
    cidade: "Recife",
    estado: "PE",
    criadoEm: ts(60),
    ultimaAtividade: ts(0),
  });
  await appendManifesto("authUids", [depUid]);
  await appendManifesto("usuarioIds", [depUid]);

  // ── ASSESSORES → COORDENADORES → COLABORADORES → ELEITORES ───────
  log("\n🗺️  ESTRUTURA TERRITORIAL\n", C.blue + C.bold);

  let totalEleitores = 0;
  const allAuthUids   = [];
  const allUsuarioIds = [];
  const allEleitorIds = [];
  const allMetaIds    = [];

  // Contadores para relatório
  const statsPorAssessor = [];

  for (const A of ESTRUTURA) {
    log(`\n  ▶ ASSESSOR ${A.perfilLabel.toUpperCase()} — ${A.cidades.join(" · ")}`, C.cyan + C.bold);

    const assessorUid = await criarUsuario(A.email, {
      ...BASE,
      nome: A.nome,
      role: "assessor",
      cidadePrincipal: A.cidades[0],
      cidades: A.cidades,
      cidade: A.cidades[0],
      estado: A.estado,
      criadoEm: ts(55),
      ultimaAtividade: A.perfil === "inativo" ? ts(90) : ts(2),
    });
    if (!assessorUid) continue;
    allAuthUids.push(assessorUid);
    allUsuarioIds.push(assessorUid);

    let qtdEleitoresAssessor = 0;

    for (const K of A.coordenadores) {
      const abandoned = !!K.isAbandoned;
      log(`    ▷ ${K.nome} · ${K.cidade}${abandoned ? " [ABANDONADO]" : ""}`, C.dim);

      const coordData = {
        ...BASE,
        nome: K.nome,
        role: "coordenador",
        assessorId: assessorUid,
        bairro: K.bairro,
        cidadePrincipal: K.cidade,
        cidade: K.cidade,
        estado: K.estado,
        criadoEm: ts(50),
        ultimaAtividade: abandoned ? ts(90) : ts(5),
      };
      if (K.metaPadraoEquipe > 0) coordData.metaPadraoEquipe = K.metaPadraoEquipe;

      const coordUid = await criarUsuario(K.email, coordData);
      if (!coordUid) continue;
      allAuthUids.push(coordUid);
      allUsuarioIds.push(coordUid);

      for (const L of K.colaboradores) {
        const colabUid = await criarUsuario(L.email, {
          ...BASE,
          nome: L.nome,
          role: "colaborador",
          status: "ativo",
          coordenadorId: coordUid,
          assessorId: assessorUid,
          bairro: K.bairro,
          cidadePrincipal: K.cidade,
          cidade: K.cidade,
          estado: K.estado,
          criadoEm: ts(45),
          ultimaAtividade: L.qtd > 0 ? ts(Math.floor(Math.random() * 5)) : ts(90),
        });
        if (!colabUid) continue;
        allAuthUids.push(colabUid);
        allUsuarioIds.push(colabUid);

        // Meta individual
        if (L.meta !== null) {
          const hoje  = new Date();
          const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
          const fim    = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
          const metaRef = await db.collection("metas").add({
            gabineteId:      gabId,
            campanhaId:      gabId,
            colaboradorId:   colabUid,
            colaboradorNome: L.nome,
            coordenadorId:   coordUid,
            meta:            L.meta,
            periodo:         "mensal",
            inicio:          Timestamp.fromDate(inicio),
            fim:             Timestamp.fromDate(fim),
            _fake: true,
          });
          allMetaIds.push(metaRef.id);
        }

        // Eleitores
        if (L.qtd > 0) {
          const lote = Array.from({ length: L.qtd }, () => {
            const eRef = db.collection("eleitores").doc();
            return {
              ref: eRef,
              dados: {
                campanhaId:      gabId,
                gabineteId:      gabId,
                assessorId:      assessorUid,
                coordenadorId:   coordUid,
                coordenadorNome: K.nome,
                colaboradorId:   colabUid,
                colaboradorNome: L.nome,
                nomeCompleto:    proximoNomeEleitor(),
                tipoDocumento:   "titulo",
                documento:       proximoDoc(),
                estado:          K.estado,
                cidade:          K.cidade,
                bairro:          K.bairro,
                grauApoio:       grauApoio(A.perfil),
                observacoes:     "",
                criadoEm:        ts(diasAtras(A.perfil)),
                _fake: true,
              },
            };
          });
          await gravarEleitores(lote, allEleitorIds);
          totalEleitores += L.qtd;
          qtdEleitoresAssessor += L.qtd;
        }
      }
    }

    statsPorAssessor.push({ nome: A.nome, perfil: A.perfilLabel, cidades: A.cidades, qtd: qtdEleitoresAssessor });
  }

  // ── ELEITORES ÓRFÃOS ─────────────────────────────────────────────
  log("\n⚠️  ELEITORES SEM LIDERANÇA (municípios sem coordenador)", C.yellow + C.bold);
  for (const O of ORFAOS) {
    const lote = Array.from({ length: O.qtd }, () => {
      const eRef = db.collection("eleitores").doc();
      return {
        ref: eRef,
        dados: {
          campanhaId: gabId, gabineteId: gabId,
          assessorId: "", coordenadorId: "", coordenadorNome: "",
          colaboradorId: "", colaboradorNome: "",
          nomeCompleto: proximoNomeEleitor(),
          tipoDocumento: "titulo", documento: proximoDoc(),
          estado: "PE", cidade: O.cidade, bairro: O.bairro,
          grauApoio: grauApoio("mediano"),
          observacoes: "Eleitor sem liderança atribuída",
          criadoEm: ts(Math.floor(Math.random() * 45) + 10),
          _fake: true,
        },
      };
    });
    await gravarEleitores(lote, allEleitorIds);
    totalEleitores += O.qtd;
    log(`  ✅ ${O.cidade}: ${O.qtd} eleitores órfãos`, C.yellow);
  }

  // Salvar manifesto completo
  await appendManifesto("authUids",   allAuthUids);
  await appendManifesto("usuarioIds", allUsuarioIds);
  await appendManifesto("eleitorIds", allEleitorIds);
  await appendManifesto("metaIds",    allMetaIds);

  const totalAuth     = 1 + allAuthUids.length;
  const totalUsuarios = 1 + allUsuarioIds.length;
  const totalMetas    = allMetaIds.length;

  // ─────────────────────────────────────────────────────────────────
  // RELATÓRIO FINAL
  // ─────────────────────────────────────────────────────────────────
  log("\n\n" + "═".repeat(70), C.cyan + C.bold);
  log("  ✅  CENÁRIO EXECUTIVO CRIADO COM SUCESSO", C.green + C.bold);
  log("═".repeat(70), C.cyan + C.bold);

  log(`
  QUANTITATIVOS
  ├─ Contas Auth:      ${totalAuth}
  ├─ Usuários FS:      ${totalUsuarios}
  ├─ Eleitores:        ${totalEleitores}
  ├─ Metas:            ${totalMetas}
  ├─ Coordenadores:    14  (12 ativos · 1 abandonado · 2 inativos/A5)
  ├─ Colaboradores:    46
  └─ Gabinetes:        1
`, C.reset);

  sep();
  log("  DISTRIBUIÇÃO POR ASSESSOR", C.bold);
  sep();
  for (const s of statsPorAssessor) {
    const pad = s.nome.padEnd(20);
    log(`  ${pad}  [${s.perfil.padEnd(9)}]  ${s.qtd.toString().padStart(3)} eleitores  📍 ${s.cidades.join(" · ")}`);
  }
  log(`  ${"ÓRFÃOS".padEnd(20)}  [${"—".padEnd(9)}]    8 eleitores  📍 Surubim · Caetés`);

  // ── CREDENCIAIS COMPLETAS ─────────────────────────────────────────
  log("\n" + "═".repeat(70), C.cyan + C.bold);
  log("  🔐  CREDENCIAIS COMPLETAS DE HOMOLOGAÇÃO", C.bold + C.cyan);
  log("═".repeat(70), C.cyan + C.bold);

  log(`
┌─────────────────────────────────────────────────────────────────────┐
│  SUPER ADMIN (conta existente, não criada pelo seed)                │
├─────────────────────────────────────────────────────────────────────┤
│  Nome:   ${SUPER_NOME.padEnd(60)}│
│  Email:  ${SUPER_EMAIL.padEnd(60)}│
│  Senha:  (senha pessoal — não alterada pelo seed)                   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  DEPUTADO ESTADUAL                                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Nome:   Ricardo Fonseca                                            │
│  Email:  deputado@teste.com                                         │
│  Senha:  111111                                                     │
└─────────────────────────────────────────────────────────────────────┘
`);

  log("  ASSESSORES", C.bold);
  sep(C.dim);
  const assessoresInfo = [
    { email: "assessor.a1@teste.com", nome: "Marcos Andrade",  perfil: "Excelente", cidades: "Recife · Olinda · Jaboatão dos Guararapes" },
    { email: "assessor.a2@teste.com", nome: "Juliana Melo",    perfil: "Bom",       cidades: "Caruaru · Bezerros · Gravatá"              },
    { email: "assessor.a3@teste.com", nome: "Pedro Coelho",    perfil: "Mediano",   cidades: "Petrolina · Salgueiro · Arcoverde"         },
    { email: "assessor.a4@teste.com", nome: "Carla Neves",     perfil: "Fraco",     cidades: "Garanhuns · Palmares · Pesqueira"          },
    { email: "assessor.a5@teste.com", nome: "Carlos Silva",    perfil: "Inativo",   cidades: "Nazaré da Mata · Goiana · Timbaúba"        },
  ];
  for (const a of assessoresInfo) {
    log(`  ${a.nome.padEnd(22)} [${a.perfil.padEnd(9)}]  ${a.email}`);
    log(`  ${"".padEnd(22)}  📍 ${a.cidades}`, C.dim);
  }

  log("\n  COORDENADORES", C.bold);
  sep(C.dim);
  const coordsInfo = [
    { email: "coordenador.a1.1@teste.com", nome: "Daniela Ferraz",       assessor: "Marcos Andrade",  cidade: "Recife / Boa Viagem"   },
    { email: "coordenador.a1.2@teste.com", nome: "Sandro Leal",          assessor: "Marcos Andrade",  cidade: "Recife / Imbiribeira"  },
    { email: "coordenador.a1.3@teste.com", nome: "Natália Vasconcelos",  assessor: "Marcos Andrade",  cidade: "Olinda / Centro"       },
    { email: "coordenador.a2.1@teste.com", nome: "Thiago Cavalcante",    assessor: "Juliana Melo",    cidade: "Caruaru / Centro"      },
    { email: "coordenador.a2.2@teste.com", nome: "Renata Moreira",       assessor: "Juliana Melo",    cidade: "Caruaru / Indianópolis"},
    { email: "coordenador.a2.3@teste.com", nome: "Gilvandro Paz",        assessor: "Juliana Melo",    cidade: "Bezerros / Centro"     },
    { email: "coordenador.a3.1@teste.com", nome: "Érica Monteiro",       assessor: "Pedro Coelho",    cidade: "Petrolina / Centro"    },
    { email: "coordenador.a3.2@teste.com", nome: "Walisson Brito",       assessor: "Pedro Coelho",    cidade: "Petrolina / Cohab"     },
    { email: "coordenador.a3.3@teste.com", nome: "Priscila Sá",          assessor: "Pedro Coelho",    cidade: "Salgueiro / Centro"    },
    { email: "coordenador.a4.1@teste.com", nome: "Hélio Guimarães",      assessor: "Carla Neves",     cidade: "Garanhuns / Centro"    },
    { email: "coordenador.a4.2@teste.com", nome: "Solange Teles",        assessor: "Carla Neves",     cidade: "Palmares / Centro"     },
    { email: "coordenador.a4.3@teste.com", nome: "Mauro Lustosa",        assessor: "Carla Neves",     cidade: "Pesqueira [ABANDONADO]"},
    { email: "coordenador.a5.1@teste.com", nome: "Fábio Tavares",        assessor: "Carlos Silva",    cidade: "Nazaré da Mata [ABAND.]"},
    { email: "coordenador.a5.2@teste.com", nome: "Irene Mota",           assessor: "Carlos Silva",    cidade: "Goiana [ABANDONADO]"   },
  ];
  for (const c of coordsInfo) {
    log(`  ${c.nome.padEnd(22)}  ${c.email}`);
    log(`  ${"".padEnd(22)}  └ ${c.assessor} · ${c.cidade}`, C.dim);
  }

  log("\n  COLABORADORES", C.bold);
  sep(C.dim);
  // Print all collaborators grouped by assessor
  for (const A of ESTRUTURA) {
    if (A.coordenadores.every(k => k.colaboradores.length === 0)) continue;
    log(`\n  [${A.perfilLabel}] ${A.nome}`, C.cyan);
    for (const K of A.coordenadores) {
      if (K.colaboradores.length === 0) continue;
      log(`    ${K.nome}`, C.dim);
      for (const L of K.colaboradores) {
        const metaStr = L.meta !== null ? `meta=${L.meta}` : "sem meta";
        const progStr = L.meta !== null ? `${L.qtd} cad. → ${Math.round((L.qtd / L.meta) * 100)}%` : `${L.qtd} cad.`;
        log(`      ${L.nome.padEnd(24)} ${L.email.padEnd(36)} ${progStr} (${metaStr})`);
      }
    }
  }

  // ── RESUMO EXECUTIVO ──────────────────────────────────────────────
  log("\n\n" + "═".repeat(70), C.magenta + C.bold);
  log("  ⚡  RESUMO EXECUTIVO — TESTES RÁPIDOS", C.magenta + C.bold);
  log("═".repeat(70), C.magenta + C.bold);
  log(`
  SUPER ADMIN
  ├─ Nome:   ${SUPER_NOME}
  ├─ Email:  ${SUPER_EMAIL}
  └─ Senha:  (senha pessoal)

  DEPUTADO
  ├─ Nome:   Ricardo Fonseca
  ├─ Email:  deputado@teste.com
  └─ Senha:  111111

  ASSESSOR EXCELENTE
  ├─ Nome:   Marcos Andrade
  ├─ Email:  assessor.a1@teste.com
  └─ Senha:  111111

  ASSESSOR INATIVO
  ├─ Nome:   Carlos Silva
  ├─ Email:  assessor.a5@teste.com
  └─ Senha:  111111

  COORDENADOR ABANDONADO
  ├─ Nome:   Mauro Lustosa  (Pesqueira · 0 colaboradores · 0 eleitores)
  ├─ Email:  coordenador.a4.3@teste.com
  └─ Senha:  111111

  COLABORADOR DESTAQUE (acima da meta — 150%)
  ├─ Nome:   Tatiane Braga  (30 eleitores · meta 20)
  ├─ Email:  colaborador.a1.1.1@teste.com
  └─ Senha:  111111

  COLABORADOR SEM PROGRESSO (meta definida · 0 eleitores)
  ├─ Nome:   Walter Coelho  (0 eleitores · meta 15)
  ├─ Email:  colaborador.a4.2.3@teste.com
  └─ Senha:  111111
`, C.reset);

  log("═".repeat(70), C.cyan);
  log("  Senha padrão de todos os usuários de teste: 111111", C.bold);
  log("═".repeat(70) + "\n", C.cyan);
}

main().catch((e) => {
  log(`\n❌ Erro fatal: ${e.message}`, C.red);
  console.error(e);
  process.exit(1);
});

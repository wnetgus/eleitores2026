#!/usr/bin/env node
/**
 * seed-cenario-fake.mjs — v2.0 ESCALA TERRITORIAL
 *
 * Simulação política regional robusta para validação cognitiva da plataforma.
 * 16 assessores · ~80 coordenadores · ~300 mobilizadores · ~4000 eleitores
 * Nordeste (PE, BA, CE, PB, AL, RN) — distribuição territorial realista
 *
 * USO:
 *   node scripts/seed-cenario-fake.mjs           (cria)
 *   node scripts/seed-cenario-fake.mjs --reset   (apaga e recria)
 *
 * LIMPEZA:
 *   node scripts/limpar-cenario-fake.mjs --confirm
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
// FIREBASE
// ─────────────────────────────────────────────────────────────────
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
  log("   Necessário: FIREBASE_ADMIN_PRIVATE_KEY, FIREBASE_ADMIN_CLIENT_EMAIL, NEXT_PUBLIC_FIREBASE_PROJECT_ID", C.yellow);
  process.exit(1);
}
if (getApps().length === 0) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

const auth = getAuth();
const db = getFirestore();
const MANIFEST = db.collection("_seed_manifest").doc("cenario_01");

// ─────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────
const SENHA = "111111";
const SUPER_EMAIL = "wnetgus@gmail.com";
const IS_RESET = process.argv.includes("--reset");

// Pool de nomes — 80 nomes fictícios
const NOMES = [
  "João Silva","Maria Santos","Pedro Oliveira","Ana Costa","Carlos Ferreira",
  "Fernanda Lima","Lucas Rodrigues","Juliana Pereira","Roberto Alves","Patricia Gomes",
  "Marcos Souza","Camila Ribeiro","Anderson Carvalho","Tânia Martins","Rafael Nascimento",
  "Sandra Barbosa","Thiago Lopes","Cristina Moura","Gustavo Dias","Beatriz Castro",
  "Felipe Campos","Vanessa Ramos","Eduardo Correia","Simone Pinto","Henrique Barros",
  "Letícia Cunha","Rodrigo Teixeira","Mariana Cruz","Diego Monteiro","Priscila Nunes",
  "Vinicius Cavalcanti","Rosana Freitas","Leonardo Tavares","Claudia Pires","Gustavo Mendes",
  "Elaine Nogueira","Sergio Azevedo","Viviane Cardoso","Leandro Barros","Miriam Vieira",
  "André Fonseca","Cláudia Arruda","Renato Sousa","Denise Figueiredo","Maurício Aguiar",
  "Sônia Macedo","Fábio Cavalcante","Raquel Medeiros","Wagner Sampaio","Giovanna Rocha",
  "Cesar Andrade","Monica Paiva","Nilton Melo","Adriana Vaz","Luciano Prado",
  "Tereza Torres","Manoel Reis","Catarina Porto","Cid Batista","Helena Queiroz",
  "Ademar Luz","Ruth Corrêa","Raimundo Faria","Silvana Braga","Vilma Lacerda",
  "Edson Carvalho","Nadir Souza","Alcides Ferreira","Zilda Costa","Benedita Silva",
  "Antônio Barros","Conceição Lima","Francisco Pereira","Iracema Santos","Josefa Alves",
  "Cícero Nunes","Dalva Ribeiro","Expedito Araujo","Gracinha Melo","Heraldo Campos",
];
let _ni = 0;
const proximoNome = () => NOMES[_ni++ % NOMES.length];
let _di = 200001;
const proximoDoc  = () => String(_di++).padStart(11, "0");
let _ei = 1;
const proximoEmail = (role) => `${role}.${_ei++}@cenario.fake`;
const ts = (n) => Timestamp.fromDate(new Date(Date.now() - n * 86_400_000));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const novoId = () => db.collection("_tmp").doc().id;

// ─────────────────────────────────────────────────────────────────
// PERFIS TERRITORIAIS
// ─────────────────────────────────────────────────────────────────
// graus: [forte%, medio%, fraco%, indeciso%]
const PERFIS = {
  dominante: { graus: [0.55,0.30,0.08,0.07], diasEleitor: ()=>Math.random()<0.75?rnd(1,28):rnd(30,80), diasMob: ()=>rnd(1,4),  diasCoord: ()=>rnd(1,3)  },
  crescendo: { graus: [0.42,0.38,0.10,0.10], diasEleitor: ()=>Math.random()<0.80?rnd(1,22):rnd(23,70), diasMob: ()=>rnd(1,6),  diasCoord: ()=>rnd(1,4)  },
  emergente: { graus: [0.45,0.35,0.10,0.10], diasEleitor: ()=>rnd(1,18),                               diasMob: ()=>rnd(1,5),  diasCoord: ()=>rnd(1,4)  },
  parado:    { graus: [0.32,0.38,0.18,0.12], diasEleitor: ()=>rnd(32,65),                              diasMob: ()=>rnd(12,28),diasCoord: ()=>rnd(10,22) },
  estagnado: { graus: [0.28,0.40,0.20,0.12], diasEleitor: ()=>rnd(38,100),                             diasMob: ()=>rnd(38,70),diasCoord: ()=>rnd(35,60) },
  critico:   { graus: [0.08,0.18,0.44,0.30], diasEleitor: ()=>rnd(50,120),                             diasMob: ()=>rnd(45,90),diasCoord: ()=>rnd(40,80) },
};

function gerarGrau(perfilNome) {
  const [f, m, fr] = PERFIS[perfilNome].graus;
  const r = Math.random();
  if (r < f)       return "forte";
  if (r < f + m)   return "medio";
  if (r < f + m + fr) return "fraco";
  return "indeciso";
}

// ─────────────────────────────────────────────────────────────────
// DEFINIÇÃO TERRITORIAL (16 assessores regionais)
// ─────────────────────────────────────────────────────────────────
// Cada território: assessor com auth, coords/mobs como Firestore-only
// coords: número por cidade | mobsPorCoord | ePorMob: eleitores por mobilizador
// ─────────────────────────────────────────────────────────────────
const TERRITORIOS = [
  // ── PE — RECIFE METROPOLITANO (DOMINANTE) ──────────────────────
  {
    id: "pe.recife", perfil: "dominante",
    assessorEmail: "assessor.pe.recife@mail.com",
    assessorNome: "Marcos Tenório", cidadePrincipal: "Recife", estado: "PE",
    cidades: [
      { nome:"Recife",   estado:"PE", bairros:["Boa Vista","Casa Amarela","Várzea","Torre","Madalena","Boa Viagem","Afogados","Dois Irmãos"], coords:4, mobsPorCoord:5, ePorMob:22 },
      { nome:"Olinda",   estado:"PE", bairros:["Carmo","Amparo","Rio Doce","Jardim Atlântico"],                                               coords:2, mobsPorCoord:4, ePorMob:12 },
      { nome:"Paulista", estado:"PE", bairros:["Centro","Nova Esperança","Maranguape"],                                                       coords:2, mobsPorCoord:3, ePorMob:10 },
    ],
  },
  // ── PE — INTERIOR AGRESTE (CRESCENDO) ─────────────────────────
  {
    id: "pe.interior", perfil: "crescendo",
    assessorEmail: "assessor.pe.interior@mail.com",
    assessorNome: "Carla Barros", cidadePrincipal: "Caruaru", estado: "PE",
    cidades: [
      { nome:"Caruaru",   estado:"PE", bairros:["Centro","Maurício de Nassau","Indianópolis","Rocha Cavalcante"], coords:3, mobsPorCoord:4, ePorMob:13 },
      { nome:"Garanhuns", estado:"PE", bairros:["Centro","Heliópolis","Magano","São José"],                        coords:2, mobsPorCoord:3, ePorMob:9  },
      { nome:"Caetés",    estado:"PE", bairros:["Centro","Vila Nova"],                                             coords:1, mobsPorCoord:2, ePorMob:6  },
    ],
  },
  // ── PE — SERTÃO OESTE (ESTAGNADO) ────────────────────────────
  {
    id: "pe.oeste", perfil: "estagnado",
    assessorEmail: "assessor.pe.oeste@mail.com",
    assessorNome: "Fábio Alcântara", cidadePrincipal: "Petrolina", estado: "PE",
    cidades: [
      { nome:"Petrolina", estado:"PE", bairros:["Centro","Cohab","Jardim Quadrado","José e Maria"], coords:2, mobsPorCoord:3, ePorMob:9 },
      { nome:"Araripina", estado:"PE", bairros:["Centro","Bela Vista"],                             coords:1, mobsPorCoord:2, ePorMob:5 },
      { nome:"Salgueiro", estado:"PE", bairros:["Centro","Santa Cruz"],                             coords:1, mobsPorCoord:2, ePorMob:4 },
    ],
  },
  // ── PE — ZONA DA MATA (EMERGENTE) ─────────────────────────────
  {
    id: "pe.mata", perfil: "emergente",
    assessorEmail: "assessor.pe.mata@mail.com",
    assessorNome: "Cintia Amorim", cidadePrincipal: "Caruaru", estado: "PE",
    cidades: [
      { nome:"Caruaru",  estado:"PE", bairros:["Rocha Cavalcante","Boa Vista","Petrópolis"],  coords:2, mobsPorCoord:3, ePorMob:10 },
      { nome:"Bezerros", estado:"PE", bairros:["Centro","Santa Catarina"],                    coords:1, mobsPorCoord:2, ePorMob:6  },
      { nome:"Gravatá",  estado:"PE", bairros:["Centro","Chã Grande"],                        coords:1, mobsPorCoord:2, ePorMob:5  },
    ],
  },
  // ── BA — FEIRA DE SANTANA (CRESCENDO) ─────────────────────────
  {
    id: "ba.feira", perfil: "crescendo",
    assessorEmail: "assessor.ba.feira@mail.com",
    assessorNome: "Patrícia Nunes", cidadePrincipal: "Feira de Santana", estado: "BA",
    cidades: [
      { nome:"Feira de Santana",      estado:"BA", bairros:["Centro","Kalilândia","Papagaio","Brasília","Caseb","Muchila"], coords:4, mobsPorCoord:5, ePorMob:16 },
      { nome:"Santo Antônio de Jesus",estado:"BA", bairros:["Centro","Nossa Senhora","Loteamento"],                        coords:2, mobsPorCoord:3, ePorMob:9  },
    ],
  },
  // ── BA — VITÓRIA DA CONQUISTA (PARADO) ────────────────────────
  {
    id: "ba.conquista", perfil: "parado",
    assessorEmail: "assessor.ba.conquista@mail.com",
    assessorNome: "Jorge Lima", cidadePrincipal: "Vitória da Conquista", estado: "BA",
    cidades: [
      { nome:"Vitória da Conquista", estado:"BA", bairros:["Centro","Ibirapuera","Lagoa","Brasil","Recreio"],     coords:3, mobsPorCoord:4, ePorMob:10 },
      { nome:"Jequié",               estado:"BA", bairros:["Centro","Jequiezinho","Mandacaru","Joaquim Romão"],    coords:2, mobsPorCoord:3, ePorMob:7  },
    ],
  },
  // ── BA — NORTE/PAULO AFONSO (CRÍTICO) ────────────────────────
  {
    id: "ba.norte", perfil: "critico",
    assessorEmail: "assessor.ba.norte@mail.com",
    assessorNome: "Sandra Melo", cidadePrincipal: "Paulo Afonso", estado: "BA",
    cidades: [
      { nome:"Paulo Afonso", estado:"BA", bairros:["Centro","Caatinga","Cohab"],       coords:2, mobsPorCoord:2, ePorMob:5 },
      { nome:"Juazeiro",     estado:"BA", bairros:["Centro","Massangano","Juremal"],   coords:1, mobsPorCoord:2, ePorMob:4 },
    ],
  },
  // ── BA — SUL (PARADO) ─────────────────────────────────────────
  {
    id: "ba.sul", perfil: "parado",
    assessorEmail: "assessor.ba.sul@mail.com",
    assessorNome: "Ricardo Vaz", cidadePrincipal: "Ilhéus", estado: "BA",
    cidades: [
      { nome:"Ilhéus",  estado:"BA", bairros:["Centro","Olivença","São Caetano","Pontalzinho"],  coords:2, mobsPorCoord:3, ePorMob:9 },
      { nome:"Itabuna", estado:"BA", bairros:["Centro","Zildolândia","Banco da Vitória"],        coords:2, mobsPorCoord:3, ePorMob:7 },
    ],
  },
  // ── CE — CARIRI/INTERIOR (DOMINANTE) ──────────────────────────
  {
    id: "ce.interior", perfil: "dominante",
    assessorEmail: "assessor.ce.interior@mail.com",
    assessorNome: "Luiz Freitas", cidadePrincipal: "Juazeiro do Norte", estado: "CE",
    cidades: [
      { nome:"Juazeiro do Norte", estado:"CE", bairros:["Centro","Lagoa Seca","Triângulo","Salesiano","Limoeiro","São Miguel"], coords:4, mobsPorCoord:5, ePorMob:18 },
      { nome:"Crato",             estado:"CE", bairros:["Centro","Seminário","Pinto Madeira","Mirandão"],                        coords:2, mobsPorCoord:3, ePorMob:10 },
      { nome:"Sobral",            estado:"CE", bairros:["Centro","Derby","Terrenos Novos","Padre Ibiapina"],                     coords:2, mobsPorCoord:3, ePorMob:9  },
    ],
  },
  // ── CE — FORTALEZA CAPITAL (EMERGENTE) ────────────────────────
  {
    id: "ce.capital", perfil: "emergente",
    assessorEmail: "assessor.ce.capital@mail.com",
    assessorNome: "Andréia Costa", cidadePrincipal: "Fortaleza", estado: "CE",
    cidades: [
      { nome:"Fortaleza", estado:"CE", bairros:["Aldeota","Maraponga","Parangaba","Messejana","Bom Jardim","Conjunto Ceará","Ellery"], coords:5, mobsPorCoord:5, ePorMob:14 },
      { nome:"Caucaia",   estado:"CE", bairros:["Centro","Jurema","Parque Tabapuá","Mirambé"],                                         coords:2, mobsPorCoord:3, ePorMob:8  },
    ],
  },
  // ── PB — JOÃO PESSOA CAPITAL (EMERGENTE) ──────────────────────
  {
    id: "pb.capital", perfil: "emergente",
    assessorEmail: "assessor.pb.capital@mail.com",
    assessorNome: "Fernanda Rocha", cidadePrincipal: "João Pessoa", estado: "PB",
    cidades: [
      { nome:"João Pessoa", estado:"PB", bairros:["Centro","Mangabeira","Bancários","Tambauzinho","Expedicionários","Valentina"], coords:3, mobsPorCoord:4, ePorMob:11 },
      { nome:"Cabedelo",    estado:"PB", bairros:["Centro","Ponta de Mato","Camboinha"],                                           coords:1, mobsPorCoord:3, ePorMob:7  },
    ],
  },
  // ── PB — CAMPINA GRANDE INTERIOR (PARADO) ─────────────────────
  {
    id: "pb.interior", perfil: "parado",
    assessorEmail: "assessor.pb.interior@mail.com",
    assessorNome: "Hélio Santos", cidadePrincipal: "Campina Grande", estado: "PB",
    cidades: [
      { nome:"Campina Grande", estado:"PB", bairros:["Centro","Bodocongó","Pedregal","Catole","Miriam","Dinamérica"], coords:3, mobsPorCoord:4, ePorMob:10 },
      { nome:"Patos",          estado:"PB", bairros:["Centro","Jatobá","Alto da Tubiba"],                             coords:1, mobsPorCoord:2, ePorMob:6  },
    ],
  },
  // ── AL — MACEIÓ CAPITAL (CRÍTICO) ─────────────────────────────
  {
    id: "al.capital", perfil: "critico",
    assessorEmail: "assessor.al.capital@mail.com",
    assessorNome: "Débora Lira", cidadePrincipal: "Maceió", estado: "AL",
    cidades: [
      { nome:"Maceió", estado:"AL", bairros:["Centro","Pajuçara","Farol","Serraria","Benedito Bentes"], coords:2, mobsPorCoord:3, ePorMob:7 },
    ],
  },
  // ── AL — INTERIOR (ESTAGNADO) ─────────────────────────────────
  {
    id: "al.interior", perfil: "estagnado",
    assessorEmail: "assessor.al.interior@mail.com",
    assessorNome: "Tiago Fonseca", cidadePrincipal: "Arapiraca", estado: "AL",
    cidades: [
      { nome:"Arapiraca",         estado:"AL", bairros:["Centro","Cacimbas","Jardim Esperança","Primavera"], coords:2, mobsPorCoord:3, ePorMob:7 },
      { nome:"União dos Palmares",estado:"AL", bairros:["Centro","São Pedro"],                               coords:1, mobsPorCoord:2, ePorMob:4 },
    ],
  },
  // ── RN — MULTIREGIONAL A (CRESCENDO / SOBRECARREGADO) ─────────
  {
    id: "nordeste.a", perfil: "crescendo",
    assessorEmail: "assessor.nordeste.a@mail.com",
    assessorNome: "Viviane Queiroz", cidadePrincipal: "Mossoró", estado: "RN",
    cidades: [
      { nome:"Mossoró",    estado:"RN", bairros:["Centro","Santo Antônio","Aeroporto","Nova Betânia"], coords:2, mobsPorCoord:3, ePorMob:9 },
      { nome:"Santa Cruz", estado:"RN", bairros:["Centro","Alto da Boa Vista"],                        coords:1, mobsPorCoord:2, ePorMob:6 },
      { nome:"Caicó",      estado:"RN", bairros:["Centro","São João","Penedo"],                        coords:1, mobsPorCoord:2, ePorMob:5 },
    ],
  },
  // ── RN — MULTIREGIONAL B (ESTAGNADO / SUBPERFORMANDO) ─────────
  {
    id: "nordeste.b", perfil: "estagnado",
    assessorEmail: "assessor.nordeste.b@mail.com",
    assessorNome: "Renato Prado", cidadePrincipal: "Natal", estado: "RN",
    cidades: [
      { nome:"Natal",      estado:"RN", bairros:["Centro","Alecrim","Lagoa Nova","Capim Macio","Cidade Alta"], coords:2, mobsPorCoord:3, ePorMob:8 },
      { nome:"Parnamirim", estado:"RN", bairros:["Centro","Emaús","Nova Parnamirim"],                          coords:1, mobsPorCoord:2, ePorMob:5 },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
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
  await db.collection("usuarios").doc(uid).set({ uid, email, ativo: true, _fake: true, ...dados }, { merge: false });
  return uid;
}

// Grava documentos Firestore em lote (sem Auth) — para coords/mobs em escala
async function batchWriteUsuarios(registros) {
  const ids = [];
  for (let i = 0; i < registros.length; i += 400) {
    const batch = db.batch();
    registros.slice(i, i + 400).forEach(({ id, dados }) => {
      batch.set(db.collection("usuarios").doc(id), { ativo: true, _fake: true, ...dados });
      ids.push(id);
    });
    await batch.commit();
  }
  return ids;
}

async function batchWriteEleitores(registros) {
  const ids = [];
  for (let i = 0; i < registros.length; i += 400) {
    const batch = db.batch();
    registros.slice(i, i + 400).forEach(dados => {
      const ref = db.collection("eleitores").doc();
      batch.set(ref, { _fake: true, ...dados });
      ids.push(ref.id);
    });
    await batch.commit();
  }
  return ids;
}

// Append seguro ao manifesto (chunks de 400 para respeitar limites)
async function appendManifesto(campo, ids) {
  for (let i = 0; i < ids.length; i += 400) {
    await MANIFEST.update({ [campo]: FieldValue.arrayUnion(...ids.slice(i, i + 400)) });
  }
}

// ─────────────────────────────────────────────────────────────────
// LIMPEZA PRÉ-RESET
// ─────────────────────────────────────────────────────────────────
async function limparAnterior() {
  log("\n🗑️  Removendo cenário anterior...", C.yellow);
  const snap = await MANIFEST.get();
  if (!snap.exists) { log("  Manifesto não encontrado.", C.dim); return; }
  const data = snap.data();
  const colMap = { eleitorIds: "eleitores", usuarioIds: "usuarios", gabineteIds: "campanhas" };
  for (const [campo, col] of Object.entries(colMap)) {
    const ids = data[campo] || [];
    if (!ids.length) continue;
    for (let i = 0; i < ids.length; i += 500) {
      const batch = db.batch();
      ids.slice(i, i + 500).forEach(id => batch.delete(db.collection(col).doc(id)));
      await batch.commit();
    }
    log(`  🗑️  ${col}: ${ids.length} documentos removidos`, C.dim);
  }
  const authUids = data.authUids || [];
  if (authUids.length) {
    await auth.deleteUsers(authUids);
    log(`  🗑️  Auth: ${authUids.length} usuários removidos`, C.dim);
  }
  await MANIFEST.delete();
  log("  ✅ Cenário anterior limpo.\n", C.green);
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
async function main() {
  log("\n" + "═".repeat(70), C.cyan);
  log("  🌱  SEED v2.0 — ESCALA TERRITORIAL — ELEITORES 2026", C.bold + C.cyan);
  log("═".repeat(70) + "\n", C.cyan);

  const manifestSnap = await MANIFEST.get();
  if (manifestSnap.exists && !IS_RESET) {
    log("⚠️  Cenário já existe. Use --reset para recriar:", C.yellow);
    log("   npm run seed:fake:reset\n", C.dim);
    process.exit(0);
  }
  if (IS_RESET) await limparAnterior();

  // Manifesto inicial
  await MANIFEST.set({
    criadoEm: FieldValue.serverTimestamp(),
    versao: "2.0",
    gabineteIds: [], authUids: [], usuarioIds: [], eleitorIds: [],
  });

  const superUid = (await auth.getUserByEmail(SUPER_EMAIL)).uid;

  // ─────────────────────────────────────────────────────────────
  // GABINETE
  // ─────────────────────────────────────────────────────────────
  log("📌 GABINETE — Ricardo Cavalcanti (Dep. Federal — AVANTE)", C.blue + C.bold);
  const gabRef = await db.collection("campanhas").add({
    nome: "Ricardo Cavalcanti — Nordeste 2026",
    slug: "ricardo-cavalcanti-nordeste-2026",
    politicoNome: "Ricardo Cavalcanti",
    politicoEmail: "dep.federal@mail.com",
    politicoPartido: "AVANTE",
    politicoNumero: "7026",
    cargo: "deputado_federal",
    nivelPolitico: "federal",
    cicloEleitoral: "estadual_federal_2026",
    corPrincipal: "#d97706",
    estado: "PE",
    municipios: ["Recife","Caruaru","Petrolina","Fortaleza","Juazeiro do Norte","Feira de Santana","João Pessoa","Maceió","Natal"],
    metaEleitoral: 50000,
    ativo: true,
    criadoPor: superUid,
    criadoEm: ts(60),
    _fake: true,
  });
  const gabId = gabRef.id;
  await gabRef.update({ gabineteId: gabId, campanhaId: gabId });
  await appendManifesto("gabineteIds", [gabId]);
  log(`  ✅ Gabinete: ${gabId}\n`, C.green);

  const BASE = { gabineteId: gabId, campanhaId: gabId, criadoPor: superUid };

  // ─────────────────────────────────────────────────────────────
  // POLÍTICO
  // ─────────────────────────────────────────────────────────────
  log("👤 POLÍTICO", C.blue + C.bold);
  const depUid = await criarUsuario("dep.federal@mail.com", {
    ...BASE, nome: "Ricardo Cavalcanti", role: "politico",
    criadoEm: ts(60), ultimaAtividade: ts(0),
  });
  await appendManifesto("authUids", [depUid]);
  await appendManifesto("usuarioIds", [depUid]);

  // ─────────────────────────────────────────────────────────────
  // ASSESSORES + ESTRUTURA TERRITORIAL
  // ─────────────────────────────────────────────────────────────
  log("\n🗺️  ASSESSORES REGIONAIS + ESTRUTURA TERRITORIAL\n", C.blue + C.bold);

  let totalCoords = 0;
  let totalMobs = 0;
  let totalEleitores = 0;
  const resumoTerritorial = [];

  for (const territorio of TERRITORIOS) {
    const perfil = PERFIS[territorio.perfil];
    log(`  ▶ ${territorio.id} [${territorio.perfil}]`, C.cyan);

    // ASSESSOR — Auth + Firestore
    const assessorUid = await criarUsuario(territorio.assessorEmail, {
      ...BASE,
      nome: territorio.assessorNome,
      role: "assessor",
      cidadePrincipal: territorio.cidadePrincipal,
      cidade: territorio.cidadePrincipal,
      estado: territorio.estado,
      criadoEm: ts(rnd(50, 70)),
      ultimaAtividade: ts(perfil.diasCoord()),
    });
    if (!assessorUid) continue;
    await appendManifesto("authUids",  [assessorUid]);
    await appendManifesto("usuarioIds",[assessorUid]);

    // Gerar coords, mobs e eleitores em memória para este território
    const coordRegistros  = [];
    const mobRegistros    = [];
    const eleitorRegistros = [];

    for (const cidade of territorio.cidades) {
      for (let ci = 0; ci < cidade.coords; ci++) {
        const coordId   = novoId();
        const coordNome = proximoNome();

        coordRegistros.push({
          id: coordId,
          dados: {
            ...BASE,
            uid: coordId,
            nome: coordNome,
            email: proximoEmail("coord"),
            role: "coordenador",
            assessorId: assessorUid,
            cidadePrincipal: cidade.nome,
            cidade: cidade.nome,
            estado: cidade.estado,
            criadoEm: ts(rnd(40, 60)),
            ultimaAtividade: ts(perfil.diasCoord()),
          },
        });

        for (let mi = 0; mi < cidade.mobsPorCoord; mi++) {
          const mobId   = novoId();
          const mobNome = proximoNome();

          mobRegistros.push({
            id: mobId,
            dados: {
              ...BASE,
              uid: mobId,
              nome: mobNome,
              email: proximoEmail("mob"),
              role: "colaborador",
              status: "ativo",
              coordenadorId: coordId,
              assessorId: assessorUid,
              cidade: cidade.nome,
              estado: cidade.estado,
              criadoEm: ts(rnd(25, 45)),
              ultimaAtividade: ts(perfil.diasMob()),
            },
          });

          for (let ei = 0; ei < cidade.ePorMob; ei++) {
            eleitorRegistros.push({
              campanhaId: gabId,
              colaboradorId: mobId,
              colaboradorNome: mobNome,
              coordenadorId: coordId,
              coordenadorNome: coordNome,
              nomeCompleto: proximoNome(),
              tipoDocumento: "titulo",
              documento: proximoDoc(),
              estado: cidade.estado,
              cidade: cidade.nome,
              bairro: cidade.bairros[ei % cidade.bairros.length],
              grauApoio: gerarGrau(territorio.perfil),
              observacoes: "",
              criadoEm: ts(perfil.diasEleitor()),
            });
          }
        }
      }
    }

    // Batch write coords
    const coordIds = await batchWriteUsuarios(coordRegistros);
    await appendManifesto("usuarioIds", coordIds);

    // Batch write mobs
    const mobIds = await batchWriteUsuarios(mobRegistros);
    await appendManifesto("usuarioIds", mobIds);

    // Batch write eleitores
    const eIds = await batchWriteEleitores(eleitorRegistros);
    await appendManifesto("eleitorIds", eIds);

    totalCoords   += coordIds.length;
    totalMobs     += mobIds.length;
    totalEleitores += eIds.length;

    resumoTerritorial.push({
      id: territorio.id,
      perfil: territorio.perfil,
      assessor: territorio.assessorNome,
      coords: coordIds.length,
      mobs: mobIds.length,
      eleitores: eIds.length,
    });

    log(`     ${coordIds.length} coords · ${mobIds.length} mobs · ${eIds.length} eleitores`, C.dim);
  }

  // ─────────────────────────────────────────────────────────────
  // RESUMO FINAL
  // ─────────────────────────────────────────────────────────────
  const pad = (s, n) => String(s).padEnd(n);
  const padL = (s, n) => String(s).padStart(n);

  log("\n" + "═".repeat(70), C.cyan);
  log("  📋  LOGINS DO CENÁRIO — senha: 111111 (todos)", C.bold + C.cyan);
  log("═".repeat(70), C.cyan);
  log(`\n  ${pad("EMAIL", 38)} ROLE / TERRITÓRIO`, C.dim);
  log("  " + "─".repeat(65), C.dim);
  log(`  ${pad("dep.federal@mail.com", 38)} político  · Ricardo Cavalcanti (visão executiva total)`);
  log("  " + "─".repeat(65), C.dim);

  const perfilIcon = { dominante:"✅", crescendo:"📈", emergente:"🌱", parado:"🟡", estagnado:"🟠", critico:"🔴" };
  for (const t of TERRITORIOS) {
    log(`  ${pad(t.assessorEmail, 38)} assessor  · ${t.assessorNome} — ${t.cidadePrincipal}/${t.estado} ${perfilIcon[t.perfil]}`);
  }

  log("\n" + "═".repeat(70), C.cyan);
  log("  📊  RESUMO TERRITORIAL", C.bold + C.cyan);
  log("═".repeat(70), C.cyan);
  log(`\n  ${pad("TERRITÓRIO", 18)} ${pad("PERFIL", 10)} ${padL("COORDS", 7)} ${padL("MOBS", 6)} ${padL("ELEITORES", 10)}`, C.dim);
  log("  " + "─".repeat(55), C.dim);
  for (const r of resumoTerritorial) {
    log(`  ${pad(r.id, 18)} ${pad(r.perfil, 10)} ${padL(r.coords, 7)} ${padL(r.mobs, 6)} ${padL(r.eleitores, 10)}`);
  }
  log("  " + "─".repeat(55), C.dim);
  log(`  ${"TOTAL".padEnd(18)} ${"".padEnd(10)} ${padL(totalCoords, 7)} ${padL(totalMobs, 6)} ${padL(totalEleitores, 10)}`, C.bold);

  log("\n  🎯 PADRÕES TERRITORIAIS PARA VALIDAÇÃO:", C.bold);
  log("  ✅ Dominante   → PE/Recife, CE/Cariri        alta base, eleitores recentes, força >50%");
  log("  📈 Crescendo   → PE/Interior, BA/Feira        crescimento acelerado, atividade recente");
  log("  🌱 Emergente   → PE/Mata, CE/Fortaleza, PB    base nova, últimos 18 dias, qualidade média");
  log("  🟡 Parado      → BA/Conquista, PB/Interior    atividade entre 32-65 dias, estabilizou");
  log("  🟠 Estagnado   → PE/Oeste, AL/Interior, RN/B  sem novos registros há 38-100 dias");
  log("  🔴 Crítico     → BA/Norte, AL/Capital         baixo volume, rejeição alta, abandono");

  log("\n  🧹 PARA LIMPAR:", C.bold);
  log("  node scripts/limpar-cenario-fake.mjs --confirm");
  log("═".repeat(70) + "\n", C.cyan);

  log(`  Total Auth: 1 político + ${TERRITORIOS.length} assessores = ${1 + TERRITORIOS.length} contas`, C.green);
  log(`  Total Firestore: ${2 + totalCoords + totalMobs} usuários + ${totalEleitores} eleitores + 1 gabinete\n`, C.green);
}

main().catch((e) => {
  log(`\n❌ Erro fatal: ${e.message}`, C.red);
  console.error(e);
  process.exit(1);
});

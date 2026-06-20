#!/usr/bin/env node
/**
 * seed-cenario-v4.mjs — FASE 9B: CENÁRIO EXECUTIVO DE ESTRESSE
 *
 * Usa campanha existente : 5Y0Xi6Z1p9KvJiEqQODM
 * Usa deputado existente : SpIqJLGEgwSr1PHYcQ4KGchSjGn1
 * NUNCA modifica         : wnetgus@gmail.com
 *
 * Cria:
 *   1  assessor_executivo (Lucas Viana)
 *   5  assessores regionais (perfis assimétricos)
 *  20  coordenadores
 * 100  colaboradores
 * 420  eleitores (10 municípios PE)
 *  20  missões  (5 concluídas · 6 execução · 5 atrasadas · 4 pendentes)
 *
 * USO:
 *   npm run seed:v4          (cria)
 *   npm run seed:v4:reset    (apaga e recria)
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

// ── Firebase ──────────────────────────────────────────────────────────────────
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!privateKey || !clientEmail || !projectId) {
  console.error("❌ Variáveis de ambiente não encontradas."); process.exit(1);
}
if (getApps().length === 0) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

const auth = getAuth();
const db   = getFirestore();
const MANIFEST = db.collection("_seed_manifest").doc("cenario_v4");

// ── Constantes ────────────────────────────────────────────────────────────────
const SENHA         = "111111";
const SUPER_EMAIL   = "wnetgus@gmail.com";
const CAMPANHA_ID   = "5Y0Xi6Z1p9KvJiEqQODM";
const DEPUTADO_UID  = "SpIqJLGEgwSr1PHYcQ4KGchSjGn1";
const DEPUTADO_NOME = "Ricardo Alves";
const IS_RESET      = process.argv.includes("--reset");

const C = {
  reset:"\x1b[0m", bold:"\x1b[1m", dim:"\x1b[2m",
  red:"\x1b[31m", green:"\x1b[32m", yellow:"\x1b[33m",
  blue:"\x1b[34m", cyan:"\x1b[36m", magenta:"\x1b[35m",
};
const log = (m, c = C.reset) => console.log(c + m + C.reset);
const sep = (c = C.cyan) => log("─".repeat(68), c);

// ── Helpers ───────────────────────────────────────────────────────────────────
const ts = (dias) => Timestamp.fromDate(new Date(Date.now() - dias * 86_400_000));

let _docNum = 600001;
const proximoDoc = () => String(_docNum++).padStart(11, "0");

const NOMES = [
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
  "Cícero Filho","Jacinta Leite","Osmar Braga","Luciene Campos",
  "Inácio Vieira","Fátima Moraes","Dilson Assis","Geralda Siqueira",
  "Aurino Lima","Terezinha Araújo","Edvaldo Queiroz","Josileide Neto",
  "Rivaldo Costa","Nevinha Ferraz","Lúcio Rocha","Suzenita Pires",
  "Amadeu Teles","Pedrina Santos","Ataíde Filho","Glorinha Leal",
  "Jurandir Paz","Cremilda Brito","Nonato Sá","Liduina Pereira",
  "Wanderson Mendes","Norberta Gomes","Haroldo Alencar","Celiete Moura",
  "Clóvis Barros","Teresinha Lima","Egídio Porto","Ivanda Cruz",
  "Horácio Faria","Nadir Nogueira","Belarmino Melo","Cacilda Sousa",
  "Alfredo Dias","Zelita Cunha","Domingos Costa","Generosa Alves",
  "Epitácio Rocha","Natalina Braz","Devanildo Azevedo","Zeneide Sampaio",
  "Arilton Freire","Marinalva Andrade","Lindomar Tavares","Zelinda Monteiro",
];
let _nIdx = 0;
const nomeEleitor = () => NOMES[_nIdx++ % NOMES.length];

// grauApoio por perfil territorial
function grauApoio(perfil) {
  const r = Math.random();
  if (perfil === "forte")      return r < 0.50 ? "forte" : r < 0.75 ? "medio" : r < 0.90 ? "indeciso" : "fraco";
  if (perfil === "bom")        return r < 0.30 ? "forte" : r < 0.65 ? "medio" : r < 0.85 ? "indeciso" : "fraco";
  if (perfil === "crescendo")  return r < 0.18 ? "forte" : r < 0.55 ? "medio" : r < 0.80 ? "indeciso" : "fraco";
  if (perfil === "fraco")      return r < 0.10 ? "forte" : r < 0.35 ? "medio" : r < 0.68 ? "indeciso" : "fraco";
  if (perfil === "queda")      return r < 0.12 ? "forte" : r < 0.40 ? "medio" : r < 0.70 ? "indeciso" : "fraco";
  /* descoberto */               return r < 0.08 ? "forte" : r < 0.32 ? "medio" : r < 0.65 ? "indeciso" : "fraco";
}

// criadoEm distribution: simula tendências de crescimento/queda
function diasAtras(perfil) {
  const r = Math.random();
  if (perfil === "forte")
    return r < 0.50 ? Math.floor(r * 30) : r < 0.80 ? 15 + Math.floor(Math.random() * 15) : 30 + Math.floor(Math.random() * 60);
  if (perfil === "bom")
    return r < 0.30 ? Math.floor(Math.random() * 15) : r < 0.70 ? 15 + Math.floor(Math.random() * 30) : 45 + Math.floor(Math.random() * 45);
  if (perfil === "crescendo")
    return r < 0.20 ? Math.floor(Math.random() * 20) : r < 0.60 ? 20 + Math.floor(Math.random() * 30) : 50 + Math.floor(Math.random() * 40);
  if (perfil === "fraco")
    return r < 0.08 ? Math.floor(Math.random() * 15) : r < 0.40 ? 15 + Math.floor(Math.random() * 45) : 60 + Math.floor(Math.random() * 30);
  if (perfil === "queda")
    return 30 + Math.floor(Math.random() * 60); // todos >30d: queda detectável
  /* descoberto */
    return 45 + Math.floor(Math.random() * 45);
}

async function criarUsuario(email, dados) {
  let uid;
  // Tenta buscar primeiro (Admin SDK lança auth/email-already-exists, não auth/email-already-in-use)
  try {
    const u = await auth.getUserByEmail(email);
    uid = u.uid;
    log(`  🔄 [${dados.role}] ${email} (reutilizando UID ${uid})`, C.yellow);
  } catch {
    // Usuário não existe — cria
    try {
      const u = await auth.createUser({ email, password: SENHA });
      uid = u.uid;
      log(`  ✅ [${dados.role}] ${email}`, C.green);
    } catch (e) {
      log(`  ❌ ${email}: ${e.message}`, C.red); return null;
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

async function gravarLote(lote) {
  const ids = [];
  for (let i = 0; i < lote.length; i += 500) {
    const b = db.batch();
    lote.slice(i, i + 500).forEach(({ ref, dados }) => { b.set(ref, dados); ids.push(ref.id); });
    await b.commit();
  }
  return ids;
}

// ── ESTRUTURA DO CENÁRIO ──────────────────────────────────────────────────────
//
// Totais verificados:
//   Coordenadores : 4+3  + 3+2+2+1  + 0 + 3 + 2  = 20
//   Colaboradores : 20+12 + 12+7+6+5 + 2 + 15 + 21 = 100
//   Eleitores     : 90+45 + 70+25+35+15 + 50 + 30 + 40 + 20(Serra) = 420
//
const ESTRUTURA = [
  // ── A1 ─ EXCELENTE / Recife + Olinda ────────────────────────────────────────
  {
    email: "assessor.a1.exec@mail.com", nome: "Rafael Drummond",
    cidade: "Recife", cidades: ["Recife", "Olinda"], estado: "PE",
    perfil: "forte", ultimaAtividade: 1,
    coordenadores: [
      {
        email: "coord.r.boaviagem.exec@mail.com", nome: "Daniela Ferraz",
        cidade: "Recife", bairro: "Boa Viagem", metaPadraoEquipe: 20,
        colaboradores: [
          { email: "mob.r.bv.1@mail.com", nome: "Tatiane Braga",  qtd: 5 },
          { email: "mob.r.bv.2@mail.com", nome: "Jonas Macedo",   qtd: 5 },
          { email: "mob.r.bv.3@mail.com", nome: "Silvia Rego",    qtd: 5 },
          { email: "mob.r.bv.4@mail.com", nome: "Marcus Aguiar",  qtd: 4 },
          { email: "mob.r.bv.5@mail.com", nome: "Laís Campos",    qtd: 4 },
        ], // 23 eleitores
      },
      {
        email: "coord.r.imbiribeira.exec@mail.com", nome: "Sandro Leal",
        cidade: "Recife", bairro: "Imbiribeira", metaPadraoEquipe: 18,
        colaboradores: [
          { email: "mob.r.im.1@mail.com", nome: "Roberta Freitas", qtd: 5 },
          { email: "mob.r.im.2@mail.com", nome: "Yuri Sampaio",    qtd: 5 },
          { email: "mob.r.im.3@mail.com", nome: "Ingrid Peres",    qtd: 4 },
          { email: "mob.r.im.4@mail.com", nome: "Davi Cunha",      qtd: 4 },
          { email: "mob.r.im.5@mail.com", nome: "Nara Batista",    qtd: 4 },
        ], // 22 eleitores
      },
      {
        email: "coord.r.torre.exec@mail.com", nome: "Natália Vasconcelos",
        cidade: "Recife", bairro: "Torre", metaPadraoEquipe: 16,
        colaboradores: [
          { email: "mob.r.to.1@mail.com", nome: "Marcos Filho",   qtd: 5 },
          { email: "mob.r.to.2@mail.com", nome: "Tamires Belo",   qtd: 5 },
          { email: "mob.r.to.3@mail.com", nome: "Estevam Luz",    qtd: 4 },
          { email: "mob.r.to.4@mail.com", nome: "Cátia Sousa",    qtd: 4 },
          { email: "mob.r.to.5@mail.com", nome: "Vinícius Porto", qtd: 4 },
        ], // 22 eleitores
      },
      {
        email: "coord.r.encruzilhada.exec@mail.com", nome: "Fábio Tavares",
        cidade: "Recife", bairro: "Encruzilhada", metaPadraoEquipe: 16,
        colaboradores: [
          { email: "mob.r.en.1@mail.com", nome: "Adriana Nóbrega",    qtd: 6 },
          { email: "mob.r.en.2@mail.com", nome: "Leandro Cruz",        qtd: 6 },
          { email: "mob.r.en.3@mail.com", nome: "Vanessa Pinto",       qtd: 5 },
          { email: "mob.r.en.4@mail.com", nome: "Ricardo Albuquerque", qtd: 4 },
          { email: "mob.r.en.5@mail.com", nome: "Débora Lima",         qtd: 2 },
        ], // 23 eleitores
      },
      // Recife: 23+22+22+23 = 90 ✓
      {
        email: "coord.o.casacaiada.exec@mail.com", nome: "Thiago Cavalcante",
        cidade: "Olinda", bairro: "Casa Caiada", metaPadraoEquipe: 14,
        colaboradores: [
          { email: "mob.o.cc.1@mail.com", nome: "Fernando Bessa",   qtd: 4 },
          { email: "mob.o.cc.2@mail.com", nome: "Mônica Figueiredo", qtd: 4 },
          { email: "mob.o.cc.3@mail.com", nome: "Igor Salles",       qtd: 4 },
          { email: "mob.o.cc.4@mail.com", nome: "Cristiane Paes",    qtd: 3 },
        ], // 15 eleitores
      },
      {
        email: "coord.o.bairronovo.exec@mail.com", nome: "Renata Moreira",
        cidade: "Olinda", bairro: "Bairro Novo", metaPadraoEquipe: 12,
        colaboradores: [
          { email: "mob.o.bn.1@mail.com", nome: "Edna Queiroz",  qtd: 4 },
          { email: "mob.o.bn.2@mail.com", nome: "Jader Neri",    qtd: 4 },
          { email: "mob.o.bn.3@mail.com", nome: "Lúcia Abreu",   qtd: 4 },
          { email: "mob.o.bn.4@mail.com", nome: "Humberto Lira", qtd: 3 },
        ], // 15 eleitores
      },
      {
        email: "coord.o.varadouro.exec@mail.com", nome: "Gilvandro Paz",
        cidade: "Olinda", bairro: "Varadouro", metaPadraoEquipe: 12,
        colaboradores: [
          { email: "mob.o.va.1@mail.com", nome: "Érica Monteiro", qtd: 4 },
          { email: "mob.o.va.2@mail.com", nome: "Walisson Brito", qtd: 4 },
          { email: "mob.o.va.3@mail.com", nome: "Priscila Sá",    qtd: 4 },
          { email: "mob.o.va.4@mail.com", nome: "Neto Pereira",   qtd: 3 },
        ], // 15 eleitores
      },
      // Olinda: 15+15+15 = 45 ✓
    ],
  },

  // ── A2 ─ BOM / Caruaru + Surubim + Santa Cruz + Arcoverde ───────────────────
  {
    email: "assessor.a2.exec@mail.com", nome: "Juliana Melo",
    cidade: "Caruaru", cidades: ["Caruaru", "Surubim", "Santa Cruz do Capibaribe", "Arcoverde"], estado: "PE",
    perfil: "bom", ultimaAtividade: 2,
    coordenadores: [
      {
        email: "coord.c.centro.exec@mail.com", nome: "Hélio Guimarães",
        cidade: "Caruaru", bairro: "Centro", metaPadraoEquipe: 14,
        colaboradores: [
          { email: "mob.c.ce.1@mail.com", nome: "Carlinhos Soares", qtd: 6 },
          { email: "mob.c.ce.2@mail.com", nome: "Vera Pinheiro",    qtd: 6 },
          { email: "mob.c.ce.3@mail.com", nome: "Nildo Faria",      qtd: 6 },
          { email: "mob.c.ce.4@mail.com", nome: "Graça Teixeira",   qtd: 5 },
        ], // 23 eleitores
      },
      {
        email: "coord.c.indianopolis.exec@mail.com", nome: "Solange Teles",
        cidade: "Caruaru", bairro: "Indianópolis", metaPadraoEquipe: 12,
        colaboradores: [
          { email: "mob.c.in.1@mail.com", nome: "Eudes Borges",  qtd: 6 },
          { email: "mob.c.in.2@mail.com", nome: "Nubia Lemos",   qtd: 6 },
          { email: "mob.c.in.3@mail.com", nome: "Mauro Lustosa", qtd: 6 },
          { email: "mob.c.in.4@mail.com", nome: "Fábio Paz",     qtd: 5 },
        ], // 23 eleitores
      },
      {
        email: "coord.c.vassoural.exec@mail.com", nome: "Irene Mota",
        cidade: "Caruaru", bairro: "Vassoural", metaPadraoEquipe: 12,
        colaboradores: [
          { email: "mob.c.va.1@mail.com", nome: "Giovani Tavares", qtd: 6 },
          { email: "mob.c.va.2@mail.com", nome: "Simone Barros",   qtd: 6 },
          { email: "mob.c.va.3@mail.com", nome: "Aldo Rezende",    qtd: 6 },
          { email: "mob.c.va.4@mail.com", nome: "Patrícia Maia",   qtd: 6 },
        ], // 24 eleitores
      },
      // Caruaru: 23+23+24 = 70 ✓
      {
        email: "coord.su.centro.exec@mail.com", nome: "Waldison Brito",
        cidade: "Surubim", bairro: "Centro", metaPadraoEquipe: 10,
        colaboradores: [
          { email: "mob.su.ce.1@mail.com", nome: "Gerson Alves",   qtd: 4 },
          { email: "mob.su.ce.2@mail.com", nome: "Sueli Dantas",   qtd: 4 },
          { email: "mob.su.ce.3@mail.com", nome: "Cleber Matos",   qtd: 4 },
          { email: "mob.su.ce.4@mail.com", nome: "Beatriz Mendes", qtd: 4 },
        ], // 16 eleitores
      },
      {
        email: "coord.su.oiteiros.exec@mail.com", nome: "Priscila Nogueira",
        cidade: "Surubim", bairro: "Oiteiros", metaPadraoEquipe: 10,
        colaboradores: [
          { email: "mob.su.oi.1@mail.com", nome: "Aécio Gomes",   qtd: 3 },
          { email: "mob.su.oi.2@mail.com", nome: "Cristina Lima", qtd: 3 },
          { email: "mob.su.oi.3@mail.com", nome: "Walter Coelho", qtd: 3 },
        ], // 9 eleitores
      },
      // Surubim: 16+9 = 25 ✓
      {
        email: "coord.sc.centro.exec@mail.com", nome: "Felipe Torres",
        cidade: "Santa Cruz do Capibaribe", bairro: "Centro", metaPadraoEquipe: 10,
        colaboradores: [
          { email: "mob.sc.ce.1@mail.com", nome: "Anderson Dias", qtd: 6 },
          { email: "mob.sc.ce.2@mail.com", nome: "Sandra Barros", qtd: 6 },
          { email: "mob.sc.ce.3@mail.com", nome: "Eduardo Melo",  qtd: 6 },
        ], // 18 eleitores
      },
      {
        email: "coord.sc.alto.exec@mail.com", nome: "Vanessa Rocha",
        cidade: "Santa Cruz do Capibaribe", bairro: "Alto da Serra", metaPadraoEquipe: 10,
        colaboradores: [
          { email: "mob.sc.al.1@mail.com", nome: "Henrique Lima",   qtd: 6 },
          { email: "mob.sc.al.2@mail.com", nome: "Simone Araújo",   qtd: 6 },
          { email: "mob.sc.al.3@mail.com", nome: "Rodrigo Fonseca", qtd: 5 },
        ], // 17 eleitores
      },
      // Santa Cruz: 18+17 = 35 ✓
      {
        email: "coord.ar.centro.exec@mail.com", nome: "Diego Campos",
        cidade: "Arcoverde", bairro: "Centro", metaPadraoEquipe: 10,
        colaboradores: [
          { email: "mob.ar.ce.1@mail.com", nome: "Letícia Souza",  qtd: 3 },
          { email: "mob.ar.ce.2@mail.com", nome: "Rafael Cruz",    qtd: 3 },
          { email: "mob.ar.ce.3@mail.com", nome: "Camila Pinto",   qtd: 3 },
          { email: "mob.ar.ce.4@mail.com", nome: "Lucas Ramos",    qtd: 3 },
          { email: "mob.ar.ce.5@mail.com", nome: "Beatriz Moura",  qtd: 3 },
        ], // 15 eleitores
      },
      // Arcoverde: 15 ✓
    ],
  },

  // ── A3 ─ P2 / Petrolina (estrutura incompleta — 0 coordenadores) ─────────────
  {
    email: "assessor.a3.exec@mail.com", nome: "Diego Costa",
    cidade: "Petrolina", cidades: ["Petrolina"], estado: "PE",
    perfil: "crescendo", ultimaAtividade: 5,
    coordenadores: [], // P2: sem estrutura de coordenação
    colaboradoresLivres: [
      { email: "mob.pe.li.1@mail.com", nome: "Marcos Lima",   qtd: 25 },
      { email: "mob.pe.li.2@mail.com", nome: "Juliana Costa", qtd: 25 },
    ], // Petrolina: 50 ✓
  },

  // ── A4 ─ FRACO / Salgueiro (IST ~21, queda -18%) ────────────────────────────
  {
    email: "assessor.a4.exec@mail.com", nome: "Roberto Alves",
    cidade: "Salgueiro", cidades: ["Salgueiro"], estado: "PE",
    perfil: "fraco", ultimaAtividade: 3,
    coordenadores: [
      {
        email: "coord.sa.centro.exec@mail.com", nome: "Hélio Lima",
        cidade: "Salgueiro", bairro: "Centro", metaPadraoEquipe: 8,
        colaboradores: [
          { email: "mob.sa.ce.1@mail.com", nome: "Carla Silva",  qtd: 2 },
          { email: "mob.sa.ce.2@mail.com", nome: "Josué Moura",  qtd: 2 },
          { email: "mob.sa.ce.3@mail.com", nome: "Tereza Braga", qtd: 2 },
          { email: "mob.sa.ce.4@mail.com", nome: "Osvaldo Cruz", qtd: 2 },
          { email: "mob.sa.ce.5@mail.com", nome: "Neide Ramos",  qtd: 2 },
        ], // 10 eleitores
      },
      {
        email: "coord.sa.varzinha.exec@mail.com", nome: "Solange Neto",
        cidade: "Salgueiro", bairro: "Várzinha", metaPadraoEquipe: 8,
        colaboradores: [
          { email: "mob.sa.va.1@mail.com", nome: "Clécio Alves",   qtd: 2 },
          { email: "mob.sa.va.2@mail.com", nome: "Ivana Braz",     qtd: 2 },
          { email: "mob.sa.va.3@mail.com", nome: "Rômulo Pinto",   qtd: 2 },
          { email: "mob.sa.va.4@mail.com", nome: "Dalva Santos",   qtd: 2 },
          { email: "mob.sa.va.5@mail.com", nome: "Euclides Rocha", qtd: 2 },
        ], // 10 eleitores
      },
      {
        email: "coord.sa.leste.exec@mail.com", nome: "Iraci Ferreira",
        cidade: "Salgueiro", bairro: "Leste", metaPadraoEquipe: 8,
        colaboradores: [
          { email: "mob.sa.le.1@mail.com", nome: "Waldir Lima",    qtd: 2 },
          { email: "mob.sa.le.2@mail.com", nome: "Glória Melo",    qtd: 2 },
          { email: "mob.sa.le.3@mail.com", nome: "Manoel Cruz",    qtd: 2 },
          { email: "mob.sa.le.4@mail.com", nome: "Alda Guimarães", qtd: 2 },
          { email: "mob.sa.le.5@mail.com", nome: "Dirceu Torres",  qtd: 2 },
        ], // 10 eleitores
      },
      // Salgueiro: 10+10+10 = 30 ✓
    ],
  },

  // ── A5 ─ QUEDA / Garanhuns (IST ~44, último acesso 45d atrás) ───────────────
  {
    email: "assessor.a5.exec@mail.com", nome: "Sandra Lima",
    cidade: "Garanhuns", cidades: ["Garanhuns"], estado: "PE",
    perfil: "queda", ultimaAtividade: 45,
    coordenadores: [
      {
        email: "coord.ga.centro.exec@mail.com", nome: "Tânia Vieira",
        cidade: "Garanhuns", bairro: "Centro", metaPadraoEquipe: 6,
        colaboradores: [
          { email: "mob.ga.ce.1@mail.com",  nome: "Pedro Alves",   qtd: 2 },
          { email: "mob.ga.ce.2@mail.com",  nome: "Maria Ramos",   qtd: 2 },
          { email: "mob.ga.ce.3@mail.com",  nome: "João Batista",  qtd: 2 },
          { email: "mob.ga.ce.4@mail.com",  nome: "Ana Lima",      qtd: 2 },
          { email: "mob.ga.ce.5@mail.com",  nome: "Carlos Mendes", qtd: 2 },
          { email: "mob.ga.ce.6@mail.com",  nome: "Luzia Freitas", qtd: 2 },
          { email: "mob.ga.ce.7@mail.com",  nome: "Mário Costa",   qtd: 2 },
          { email: "mob.ga.ce.8@mail.com",  nome: "Rosa Ferreira", qtd: 2 },
          { email: "mob.ga.ce.9@mail.com",  nome: "Paulo Sousa",   qtd: 2 },
          { email: "mob.ga.ce.10@mail.com", nome: "Tereza Borges", qtd: 2 },
          { email: "mob.ga.ce.11@mail.com", nome: "Antônio Neves", qtd: 2 },
        ], // 22 eleitores
      },
      {
        email: "coord.ga.santoantonio.exec@mail.com", nome: "Kleber Rodrigues",
        cidade: "Garanhuns", bairro: "Santo Antônio", metaPadraoEquipe: 6,
        colaboradores: [
          { email: "mob.ga.sa.1@mail.com",  nome: "Joana Pires",    qtd: 2 },
          { email: "mob.ga.sa.2@mail.com",  nome: "Cícero Moura",   qtd: 2 },
          { email: "mob.ga.sa.3@mail.com",  nome: "Benedita Lima",  qtd: 2 },
          { email: "mob.ga.sa.4@mail.com",  nome: "Expedito Cruz",  qtd: 2 },
          { email: "mob.ga.sa.5@mail.com",  nome: "Iracema Dias",   qtd: 2 },
          { email: "mob.ga.sa.6@mail.com",  nome: "Geraldo Pinto",  qtd: 2 },
          { email: "mob.ga.sa.7@mail.com",  nome: "Zilda Barros",   qtd: 2 },
          { email: "mob.ga.sa.8@mail.com",  nome: "Nilton Fonseca", qtd: 2 },
          { email: "mob.ga.sa.9@mail.com",  nome: "Sueli Correia",  qtd: 1 },
          { email: "mob.ga.sa.10@mail.com", nome: "Valdir Neves",   qtd: 1 },
        ], // 18 eleitores
      },
      // Garanhuns: 22+18 = 40 ✓
    ],
  },
];

// ── Limpeza (--reset) ─────────────────────────────────────────────────────────
async function limparAnterior() {
  log("🗑️  Limpando cenário anterior (v4)...", C.yellow);
  const snap = await MANIFEST.get();
  if (!snap.exists) { log("  Nada a limpar.\n", C.dim); return; }
  const {
    authUids = [], usuarioIds = [], eleitorIds = [], missaoIds = [],
  } = snap.data();

  const superUid = await auth.getUserByEmail(SUPER_EMAIL).then(u => u.uid).catch(() => null);
  const uidsRemover = authUids.filter(u => u !== superUid && u !== DEPUTADO_UID);

  for (let i = 0; i < uidsRemover.length; i += 1000)
    await auth.deleteUsers(uidsRemover.slice(i, i + 1000));

  const batchDel = async (col, ids) => {
    for (let i = 0; i < ids.length; i += 500) {
      const b = db.batch();
      ids.slice(i, i + 500).forEach(id => b.delete(db.collection(col).doc(id)));
      await b.commit();
    }
  };
  await batchDel("usuarios", usuarioIds);
  await batchDel("eleitores", eleitorIds);
  await batchDel("missoes", missaoIds);
  await MANIFEST.delete();
  log("  ✅ Cenário anterior (v4) limpo.\n", C.green);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  log("\n" + "═".repeat(68), C.cyan);
  log("  🌱  SEED v4 — FASE 9B CENÁRIO EXECUTIVO DE ESTRESSE", C.bold + C.cyan);
  log("═".repeat(68) + "\n", C.cyan);

  const snap = await MANIFEST.get();
  if (snap.exists && !IS_RESET) {
    log("⚠️  Cenário v4 já existe. Use --reset para recriar:", C.yellow);
    log("   npm run seed:v4:reset\n", C.dim);
    process.exit(0);
  }
  if (IS_RESET) await limparAnterior();

  await MANIFEST.set({
    versao: "v4-9b", criadoEm: FieldValue.serverTimestamp(),
    authUids: [], usuarioIds: [], eleitorIds: [], missaoIds: [],
  });

  const BASE = { campanhaId: CAMPANHA_ID, gabineteId: CAMPANHA_ID, criadoPor: DEPUTADO_UID };

  const allAuthUids   = [];
  const allUsuarioIds = [];
  const allEleitorIds = [];

  // ── ASSESSOR EXECUTIVO ────────────────────────────────────────────────────
  log("👑 ASSESSOR EXECUTIVO", C.blue + C.bold);
  const execUid = await criarUsuario("assessor.executivo@mail.com", {
    ...BASE,
    nome: "Lucas Viana",
    role: "assessor_executivo",
    cidade: "Recife",
    cidades: ["Recife","Olinda","Caruaru","Surubim","Santa Cruz do Capibaribe","Arcoverde","Petrolina","Salgueiro","Garanhuns","Serra Talhada"],
    estado: "PE",
    criadoEm: ts(60),
    ultimaAtividade: ts(0),
  });
  if (!execUid) { log("❌ Falhou criar assessor executivo", C.red); process.exit(1); }
  allAuthUids.push(execUid);
  allUsuarioIds.push(execUid);
  log(`  UID: ${execUid}\n`, C.dim);

  // ── ASSESSORES → COORDENADORES → COLABORADORES → ELEITORES ───────────────
  log("🗺️  ESTRUTURA TERRITORIAL\n", C.blue + C.bold);

  const assessorUidMap = {};

  for (const A of ESTRUTURA) {
    log(`\n  ▶ [${A.perfil.toUpperCase()}] ${A.nome} — ${A.cidades.join(" · ")}`, C.cyan + C.bold);

    const assessorUid = await criarUsuario(A.email, {
      ...BASE,
      nome: A.nome,
      role: "assessor",
      assessorExecutivoId: execUid,
      cidade: A.cidade,
      cidades: A.cidades,
      estado: A.estado,
      criadoEm: ts(55),
      ultimaAtividade: ts(A.ultimaAtividade),
    });
    if (!assessorUid) continue;
    assessorUidMap[A.email] = assessorUid;
    allAuthUids.push(assessorUid);
    allUsuarioIds.push(assessorUid);

    // Coordenadores com colaboradores
    for (const K of (A.coordenadores || [])) {
      log(`    ▷ ${K.nome} · ${K.cidade}/${K.bairro}`, C.dim);

      const coordUid = await criarUsuario(K.email, {
        ...BASE,
        nome: K.nome,
        role: "coordenador",
        assessorId: assessorUid,
        assessorExecutivoId: execUid,
        cidade: K.cidade,
        bairro: K.bairro,
        estado: A.estado,
        criadoEm: ts(50),
        ultimaAtividade: ts(5),
        ...(K.metaPadraoEquipe ? { metaPadraoEquipe: K.metaPadraoEquipe } : {}),
      });
      if (!coordUid) continue;
      allAuthUids.push(coordUid);
      allUsuarioIds.push(coordUid);

      for (const L of K.colaboradores) {
        const colabUid = await criarUsuario(L.email, {
          ...BASE,
          nome: L.nome,
          role: "colaborador",
          status: "ativo",
          assessorId: assessorUid,
          assessorExecutivoId: execUid,
          coordenadorId: coordUid,
          coordenadorNome: K.nome,
          cidade: K.cidade,
          bairro: K.bairro,
          estado: A.estado,
          criadoEm: ts(45),
          ultimaAtividade: L.qtd > 0 ? ts(Math.floor(Math.random() * 7) + 1) : ts(30),
        });
        if (!colabUid) continue;
        allAuthUids.push(colabUid);
        allUsuarioIds.push(colabUid);

        if (L.qtd > 0) {
          const lote = Array.from({ length: L.qtd }, () => {
            const ref = db.collection("eleitores").doc();
            return { ref, dados: {
              campanhaId:      CAMPANHA_ID,
              gabineteId:      CAMPANHA_ID,
              assessorId:      assessorUid,
              assessorNome:    A.nome,
              coordenadorId:   coordUid,
              coordenadorNome: K.nome,
              colaboradorId:   colabUid,
              colaboradorNome: L.nome,
              nomeCompleto:    nomeEleitor(),
              tipoDocumento:   "titulo",
              documento:       proximoDoc(),
              estado:          A.estado,
              cidade:          K.cidade,
              bairro:          K.bairro,
              grauApoio:       grauApoio(A.perfil),
              observacoes:     "",
              criadoEm:        ts(diasAtras(A.perfil)),
              _fake:           true,
            }};
          });
          const ids = await gravarLote(lote);
          allEleitorIds.push(...ids);
        }
      }
    }

    // Colaboradores livres (Petrolina — sem coordenador)
    if (A.colaboradoresLivres) {
      log(`    ⚠️  ${A.nome}: sem coordenadores — 2 colaboradores diretos`, C.yellow);
      for (const L of A.colaboradoresLivres) {
        const colabUid = await criarUsuario(L.email, {
          ...BASE,
          nome: L.nome,
          role: "colaborador",
          status: "ativo",
          assessorId: assessorUid,
          assessorExecutivoId: execUid,
          coordenadorId:   "",
          coordenadorNome: "",
          cidade: A.cidade,
          bairro: "Centro",
          estado: A.estado,
          criadoEm: ts(45),
          ultimaAtividade: ts(3),
        });
        if (!colabUid) continue;
        allAuthUids.push(colabUid);
        allUsuarioIds.push(colabUid);

        if (L.qtd > 0) {
          const lote = Array.from({ length: L.qtd }, () => {
            const ref = db.collection("eleitores").doc();
            return { ref, dados: {
              campanhaId:      CAMPANHA_ID,
              gabineteId:      CAMPANHA_ID,
              assessorId:      assessorUid,
              assessorNome:    A.nome,
              coordenadorId:   "",
              coordenadorNome: "",
              colaboradorId:   colabUid,
              colaboradorNome: L.nome,
              nomeCompleto:    nomeEleitor(),
              tipoDocumento:   "titulo",
              documento:       proximoDoc(),
              estado:          A.estado,
              cidade:          A.cidade,
              bairro:          "Centro",
              grauApoio:       grauApoio(A.perfil),
              observacoes:     "Cadastrado diretamente pelo assessor (sem coordenador)",
              criadoEm:        ts(diasAtras(A.perfil)),
              _fake:           true,
            }};
          });
          const ids = await gravarLote(lote);
          allEleitorIds.push(...ids);
        }
      }
    }
  }

  // ── ELEITORES ÓRFÃOS — SERRA TALHADA (Território Descoberto P1) ───────────
  log("\n⚠️  SERRA TALHADA — Território Descoberto (P1, 20 eleitores)", C.yellow + C.bold);
  {
    const lote = Array.from({ length: 20 }, () => {
      const ref = db.collection("eleitores").doc();
      return { ref, dados: {
        campanhaId:      CAMPANHA_ID,
        gabineteId:      CAMPANHA_ID,
        assessorId:      "",
        assessorNome:    "",
        coordenadorId:   "",
        coordenadorNome: "",
        colaboradorId:   "",
        colaboradorNome: "",
        nomeCompleto:    nomeEleitor(),
        tipoDocumento:   "titulo",
        documento:       proximoDoc(),
        estado:          "PE",
        cidade:          "Serra Talhada",
        bairro:          "Centro",
        grauApoio:       grauApoio("descoberto"),
        observacoes:     "Eleitor sem liderança — território descoberto",
        criadoEm:        ts(diasAtras("descoberto")),
        _fake:           true,
      }};
    });
    const ids = await gravarLote(lote);
    allEleitorIds.push(...ids);
    log(`  ✅ ${ids.length} eleitores órfãos gravados`, C.yellow);
  }

  // ── MISSÕES ───────────────────────────────────────────────────────────────
  log("\n📋 MISSÕES (20)", C.blue + C.bold);

  const A1 = assessorUidMap["assessor.a1.exec@mail.com"];
  const A2 = assessorUidMap["assessor.a2.exec@mail.com"];
  const A3 = assessorUidMap["assessor.a3.exec@mail.com"];
  const A4 = assessorUidMap["assessor.a4.exec@mail.com"];
  const A5 = assessorUidMap["assessor.a5.exec@mail.com"];

  const TITULOS = {
    criar_assessoria:    "Criar nova assessoria regional",
    criar_coordenacao:   "Estabelecer coordenação local",
    fortalecer_base:     "Fortalecer base eleitoral",
    expandir_territorio: "Expandir território de atuação",
    reestruturar_regiao: "Reestruturar região estratégica",
  };

  const MISSOES_DEF = [
    // 5 concluídas
    { tipo:"criar_coordenacao",   cidade:"Recife",                   prio:"P2", status:"concluida", resp:{id:A1,  nome:"Rafael Drummond"}, criado:35, concluidoEm:20, resultado:"Duas novas coordenações estabelecidas em Boa Viagem e Imbiribeira." },
    { tipo:"expandir_territorio", cidade:"Olinda",                   prio:"P2", status:"concluida", resp:{id:A1,  nome:"Rafael Drummond"}, criado:28, concluidoEm:12, resultado:"Novos mobilizadores recrutados em Casa Caiada e Varadouro." },
    { tipo:"fortalecer_base",     cidade:"Caruaru",                  prio:"P2", status:"concluida", resp:{id:A2,  nome:"Juliana Melo"},    criado:25, concluidoEm:8,  resultado:"Meta de eleitores atingida em Caruaru Centro." },
    { tipo:"criar_assessoria",    cidade:"Surubim",                  prio:"P3", status:"concluida", resp:{id:A2,  nome:"Juliana Melo"},    criado:22, concluidoEm:5,  resultado:"Equipe estruturada em Surubim com 7 colaboradores." },
    { tipo:"expandir_territorio", cidade:"Santa Cruz do Capibaribe", prio:"P3", status:"concluida", resp:{id:A2,  nome:"Juliana Melo"},    criado:20, concluidoEm:4,  resultado:"35 eleitores cadastrados em Santa Cruz." },
    // 6 em execução (recentes)
    { tipo:"fortalecer_base",     cidade:"Olinda",        prio:"P2", status:"em_execucao", resp:{id:A1,     nome:"Rafael Drummond"}, criado:12, deleg:{id:DEPUTADO_UID, nome:DEPUTADO_NOME, em:12} },
    { tipo:"criar_coordenacao",   cidade:"Petrolina",     prio:"P2", status:"em_execucao", resp:{id:A3,     nome:"Diego Costa"},     criado:10, deleg:{id:execUid,     nome:"Lucas Viana",  em:10} },
    { tipo:"expandir_territorio", cidade:"Serra Talhada", prio:"P1", status:"em_execucao", resp:{id:execUid,nome:"Lucas Viana"},     criado:5,  deleg:{id:DEPUTADO_UID, nome:DEPUTADO_NOME, em:5}  },
    { tipo:"reestruturar_regiao", cidade:"Caruaru",       prio:"P2", status:"em_execucao", resp:{id:A2,     nome:"Juliana Melo"},    criado:15, deleg:{id:DEPUTADO_UID, nome:DEPUTADO_NOME, em:15} },
    { tipo:"fortalecer_base",     cidade:"Arcoverde",     prio:"P3", status:"em_execucao", resp:{id:A2,     nome:"Juliana Melo"},    criado:7,  deleg:{id:execUid,     nome:"Lucas Viana",  em:7}  },
    { tipo:"criar_coordenacao",   cidade:"Garanhuns",     prio:"P2", status:"em_execucao", resp:{id:A5,     nome:"Sandra Lima"},     criado:9,  deleg:{id:DEPUTADO_UID, nome:DEPUTADO_NOME, em:9}  },
    // 5 atrasadas (em_execucao, criadoEm > 30d — detectadas como "atrasadas" no dashboard)
    { tipo:"reestruturar_regiao", cidade:"Salgueiro",  prio:"P1", status:"em_execucao", resp:{id:A4, nome:"Roberto Alves"}, criado:45, deleg:{id:DEPUTADO_UID, nome:DEPUTADO_NOME, em:45} },
    { tipo:"fortalecer_base",     cidade:"Salgueiro",  prio:"P1", status:"em_execucao", resp:{id:A4, nome:"Roberto Alves"}, criado:40, deleg:{id:DEPUTADO_UID, nome:DEPUTADO_NOME, em:40} },
    { tipo:"reestruturar_regiao", cidade:"Garanhuns",  prio:"P1", status:"em_execucao", resp:{id:A5, nome:"Sandra Lima"},   criado:38, deleg:{id:DEPUTADO_UID, nome:DEPUTADO_NOME, em:38} },
    { tipo:"criar_coordenacao",   cidade:"Salgueiro",  prio:"P2", status:"em_execucao", resp:{id:A4, nome:"Roberto Alves"}, criado:35, deleg:{id:execUid,     nome:"Lucas Viana",  em:35} },
    { tipo:"fortalecer_base",     cidade:"Garanhuns",  prio:"P1", status:"em_execucao", resp:{id:A5, nome:"Sandra Lima"},   criado:32, deleg:{id:DEPUTADO_UID, nome:DEPUTADO_NOME, em:32} },
    // 4 pendentes
    { tipo:"criar_assessoria",    cidade:"Serra Talhada", prio:"P1", status:"pendente", criado:3  },
    { tipo:"fortalecer_base",     cidade:"Petrolina",     prio:"P2", status:"pendente", criado:5  },
    { tipo:"expandir_territorio", cidade:"Petrolina",     prio:"P2", status:"pendente", criado:4  },
    { tipo:"reestruturar_regiao", cidade:"Arcoverde",     prio:"P3", status:"pendente", criado:2  },
  ];

  if (MISSOES_DEF.length !== 20) {
    log(`❌ Esperado 20 missões, gerou ${MISSOES_DEF.length}`, C.red); process.exit(1);
  }

  const missaoLote = MISSOES_DEF.map((m) => {
    const ref = db.collection("missoes").doc();
    const dados = {
      campanhaId:    CAMPANHA_ID,
      origem:        "deputado",
      tipo:          m.tipo,
      titulo:        TITULOS[m.tipo],
      cidade:        m.cidade,
      prioridade:    m.prio,
      status:        m.status,
      criadoEm:      ts(m.criado),
      criadoPorId:   DEPUTADO_UID,
      criadoPorNome: DEPUTADO_NOME,
      _fake:         true,
    };
    if (m.resp) {
      dados.responsavelId   = m.resp.id;
      dados.responsavelNome = m.resp.nome;
    }
    if (m.deleg) {
      dados.delegadoPor     = m.deleg.id;
      dados.delegadoPorNome = m.deleg.nome;
      dados.delegadoEm      = ts(m.deleg.em);
    }
    if (m.concluidoEm !== undefined) {
      dados.concluidoPor     = m.resp.id;
      dados.concluidoPorNome = m.resp.nome;
      dados.concluidoEm      = ts(m.concluidoEm);
      dados.resultado        = m.resultado;
    }
    return { ref, dados };
  });
  const missaoIds = await gravarLote(missaoLote);
  log(`  ✅ ${missaoIds.length} missões criadas`, C.green);

  // ── Persistir manifesto ───────────────────────────────────────────────────
  await appendManifesto("authUids",   allAuthUids);
  await appendManifesto("usuarioIds", allUsuarioIds);
  await appendManifesto("eleitorIds", allEleitorIds);
  await appendManifesto("missaoIds",  missaoIds);

  // ── RELATÓRIO FINAL ───────────────────────────────────────────────────────
  const totalCoords  = ESTRUTURA.reduce((s, a) => s + (a.coordenadores?.length ?? 0), 0);
  const totalCollabs = ESTRUTURA.reduce((s, a) =>
    s + (a.coordenadores?.reduce((ss, k) => ss + k.colaboradores.length, 0) ?? 0)
    + (a.colaboradoresLivres?.length ?? 0), 0);
  const totalEleitores = allEleitorIds.length;

  log("\n\n" + "═".repeat(68), C.cyan + C.bold);
  log("  ✅  CENÁRIO v4 CRIADO COM SUCESSO", C.green + C.bold);
  log("═".repeat(68), C.cyan + C.bold);
  log(`
  QUANTITATIVOS
  ├─ Contas Auth criadas:    ${allAuthUids.length}  (1 exec + 5 assessores + ${totalCoords} coords + ${totalCollabs - 2} collabs + 2 livre)
  ├─ Usuários Firestore:     ${allUsuarioIds.length}
  ├─ Eleitores:              ${totalEleitores}  (meta: 420)
  ├─ Missões:                ${missaoIds.length}  (5 concluídas · 6 execução · 5 atrasadas · 4 pendentes)
  ├─ Coordenadores:          ${totalCoords}
  ├─ Colaboradores:          ${totalCollabs}
  └─ Campanha reutilizada:   ${CAMPANHA_ID}
  `, C.reset);

  sep();
  log("  DISTRIBUIÇÃO POR ASSESSOR REGIONAL", C.bold);
  sep();
  const dist = [
    { nome:"Rafael Drummond", perfil:"EXCELENTE", cidades:"Recife · Olinda",                        eleitores: 90+45 },
    { nome:"Juliana Melo",    perfil:"BOM",        cidades:"Caruaru · Surubim · Santa Cruz · Arcov.", eleitores: 70+25+35+15 },
    { nome:"Diego Costa",     perfil:"P2 NOVO",    cidades:"Petrolina",                              eleitores: 50 },
    { nome:"Roberto Alves",   perfil:"FRACO",      cidades:"Salgueiro",                              eleitores: 30 },
    { nome:"Sandra Lima",     perfil:"QUEDA",      cidades:"Garanhuns",                              eleitores: 40 },
    { nome:"(sem liderança)", perfil:"DESCOBERTO", cidades:"Serra Talhada",                           eleitores: 20 },
  ];
  for (const d of dist) {
    log(`  ${d.nome.padEnd(18)} [${d.perfil.padEnd(10)}]  ${d.eleitores.toString().padStart(3)} eleitores  📍 ${d.cidades}`);
  }

  log("\n" + "═".repeat(68), C.cyan + C.bold);
  log("  🔐  CREDENCIAIS DE HOMOLOGAÇÃO", C.bold + C.cyan);
  log("═".repeat(68), C.cyan + C.bold);
  log(`
  SUPER ADMIN (preservado, não criado pelo seed)
  ├─ Email: wnetgus@gmail.com
  └─ Senha: (pessoal)

  DEPUTADO (preservado, não criado pelo seed)
  ├─ Email: deputado@teste.com
  └─ Senha: 111111

  ASSESSOR EXECUTIVO (Chefe de Gabinete)
  ├─ Email: assessor.executivo@mail.com
  └─ Senha: 111111

  ASSESSORES REGIONAIS
  ├─ assessor.a1.exec@mail.com  [EXCELENTE]  Rafael Drummond  · Recife/Olinda
  ├─ assessor.a2.exec@mail.com  [BOM]        Juliana Melo     · Caruaru/+3
  ├─ assessor.a3.exec@mail.com  [P2 NOVO]    Diego Costa      · Petrolina (0 coords)
  ├─ assessor.a4.exec@mail.com  [FRACO]      Roberto Alves    · Salgueiro
  └─ assessor.a5.exec@mail.com  [QUEDA]      Sandra Lima      · Garanhuns (ativo 45d atrás)

  COORDENADORES CHAVE
  ├─ coord.r.boaviagem.exec@mail.com     Daniela Ferraz   · Recife/Boa Viagem
  ├─ coord.ga.centro.exec@mail.com       Tânia Vieira     · Garanhuns/Centro
  └─ coord.sa.centro.exec@mail.com       Hélio Lima       · Salgueiro/Centro

  COLABORADORES DIRETOS (Petrolina — sem coordenador)
  ├─ mob.pe.li.1@mail.com   Marcos Lima   · 25 eleitores
  └─ mob.pe.li.2@mail.com   Juliana Costa · 25 eleitores

  Senha padrão de todos os usuários de teste: 111111
  `, C.reset);

  log("═".repeat(68), C.cyan);
  log("  ALERTAS ESPERADOS NO DASHBOARD DO ASSESSOR EXECUTIVO:", C.bold);
  log("  ├─ 5 missões ATRASADAS (Salgueiro P1×3, Garanhuns P1×2)", C.yellow);
  log("  ├─ Petrolina P2 — Estrutura Incompleta (0 coordenadores)", C.yellow);
  log("  ├─ Serra Talhada P1 — Território Descoberto (0 hierarquia)", C.red);
  log("  └─ Garanhuns em QUEDA (último acesso assessor há 45d)", C.yellow);
  log("═".repeat(68) + "\n", C.cyan);
}

main().catch((e) => {
  console.error("\n❌ Erro fatal:", e.message);
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * seed-cenario-fake.mjs
 * Cria o micro-cenário político fake para validação da plataforma.
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

// ============================================================
// ENV — lê .env.local (mesmo padrão dos outros scripts)
// ============================================================
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envContent = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* vars já podem estar no ambiente */ }

// ============================================================
// CORES
// ============================================================
const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", cyan: "\x1b[36m", white: "\x1b[37m",
};
const log = (msg, c = C.reset) => console.log(c + msg + C.reset);

// ============================================================
// FIREBASE ADMIN
// ============================================================
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!privateKey || !clientEmail || !projectId) {
  log("❌ Variáveis de ambiente não encontradas.", C.red);
  log("   Necessário em .env.local: FIREBASE_ADMIN_PRIVATE_KEY, FIREBASE_ADMIN_CLIENT_EMAIL, NEXT_PUBLIC_FIREBASE_PROJECT_ID", C.yellow);
  process.exit(1);
}
if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const auth = getAuth();
const db = getFirestore();
const MANIFEST = db.collection("_seed_manifest").doc("cenario_01");

// ============================================================
// CONSTANTES DO CENÁRIO
// ============================================================
const SENHA = "111111";
const SUPER_EMAIL = "wnetgus@gmail.com";
const IS_RESET = process.argv.includes("--reset");

// Nomes reais fictícios para eleitores (pool de 65)
const NOMES = [
  "João Silva", "Maria Santos", "Pedro Oliveira", "Ana Costa", "Carlos Ferreira",
  "Fernanda Lima", "Lucas Rodrigues", "Juliana Pereira", "Roberto Alves", "Patricia Gomes",
  "Marcos Souza", "Camila Ribeiro", "Anderson Carvalho", "Tânia Martins", "Rafael Nascimento",
  "Sandra Barbosa", "Thiago Lopes", "Cristina Moura", "Gustavo Dias", "Beatriz Castro",
  "Felipe Campos", "Vanessa Ramos", "Eduardo Correia", "Simone Pinto", "Henrique Barros",
  "Letícia Cunha", "Rodrigo Teixeira", "Mariana Cruz", "Diego Monteiro", "Priscila Nunes",
  "Vinicius Cavalcanti", "Rosana Freitas", "Leonardo Tavares", "Claudia Pires", "Gustavo Mendes",
  "Elaine Nogueira", "Sergio Azevedo", "Viviane Cardoso", "Leandro Barros", "Miriam Vieira",
  "André Fonseca", "Cláudia Arruda", "Renato Sousa", "Denise Figueiredo", "Maurício Aguiar",
  "Sônia Macedo", "Fábio Cavalcante", "Raquel Medeiros", "Wagner Sampaio", "Giovanna Rocha",
  "Cesar Andrade", "Monica Paiva", "Nilton Melo", "Adriana Vaz", "Luciano Prado",
  "Tereza Torres", "Manoel Reis", "Catarina Porto", "Cid Batista", "Helena Queiroz",
  "Ademar Luz", "Ruth Corrêa", "Raimundo Faria", "Silvana Braga", "Vilma Lacerda",
];
let _nomeIdx = 0;
const proximoNome = () => NOMES[_nomeIdx++ % NOMES.length];

let _docIdx = 100001;
const proximoDoc = () => String(_docIdx++).padStart(11, "0");

// ts(n) = Timestamp de n dias atrás
const ts = (n) => Timestamp.fromDate(new Date(Date.now() - n * 86_400_000));

// ============================================================
// HELPERS
// ============================================================
async function criarUsuario(email, dados) {
  let uid;
  try {
    const user = await auth.createUser({ email, password: SENHA });
    uid = user.uid;
    log(`  ✅ [${dados.role}] ${email}`, C.green);
  } catch (e) {
    if (e.code === "auth/email-already-in-use") {
      const user = await auth.getUserByEmail(email);
      uid = user.uid;
      log(`  🔄 [${dados.role}] ${email} (já existia — reutilizando)`, C.yellow);
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

async function criarEleitores(specs) {
  // specs: [{ colaboradorId, colaboradorNome, coordenadorId, coordenadorNome, cidade, bairros, graus, diasAtras }]
  const ids = [];
  for (const spec of specs) {
    const batch = db.batch();
    const batchIds = [];
    for (let i = 0; i < spec.graus.length; i++) {
      const ref = db.collection("eleitores").doc();
      batch.set(ref, {
        campanhaId: spec.campanhaId,
        colaboradorId: spec.colaboradorId,
        colaboradorNome: spec.colaboradorNome,
        coordenadorId: spec.coordenadorId,
        coordenadorNome: spec.coordenadorNome,
        nomeCompleto: proximoNome(),
        tipoDocumento: "titulo",
        documento: proximoDoc(),
        estado: "SP",
        cidade: spec.cidade,
        bairro: spec.bairros[i % spec.bairros.length],
        grauApoio: spec.graus[i],
        observacoes: "",
        criadoEm: ts(spec.diasAtras[i]),
        _fake: true,
      });
      batchIds.push(ref.id);
    }
    await batch.commit();
    ids.push(...batchIds);
    log(`  ✅ ${spec.colaboradorNome}: ${batchIds.length} eleitores (${spec.cidade})`, C.green);
  }
  return ids;
}

async function appendManifesto(campo, ids) {
  await MANIFEST.update({ [campo]: FieldValue.arrayUnion(...ids) });
}

// ============================================================
// LIMPEZA PRÉ-RESET
// ============================================================
async function limparAnterior() {
  log("\n🗑️  Removendo cenário anterior...", C.yellow);
  const snap = await MANIFEST.get();
  if (!snap.exists) { log("  Manifesto não encontrado. Nada a limpar.", C.dim); return; }

  const data = snap.data();
  const colMap = { eleitorIds: "eleitores", usuarioIds: "usuarios", gabineteIds: "campanhas" };

  for (const [campo, col] of Object.entries(colMap)) {
    const ids = data[campo] || [];
    if (!ids.length) continue;
    for (let i = 0; i < ids.length; i += 500) {
      const batch = db.batch();
      ids.slice(i, i + 500).forEach((id) => batch.delete(db.collection(col).doc(id)));
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

// ============================================================
// MAIN
// ============================================================
async function main() {
  log("\n" + "═".repeat(64), C.cyan);
  log("  🌱  SEED — CENÁRIO POLÍTICO FAKE — ELEITORES 2026", C.bold + C.cyan);
  log("═".repeat(64) + "\n", C.cyan);

  // Verificar double-run
  const manifestSnap = await MANIFEST.get();
  if (manifestSnap.exists && !IS_RESET) {
    log("⚠️  Cenário já existe! Use --reset para recriar:", C.yellow);
    log("   node scripts/seed-cenario-fake.mjs --reset\n", C.dim);
    process.exit(0);
  }
  if (IS_RESET) await limparAnterior();

  // Iniciar manifesto (escrito antes de qualquer dado — safe rollback)
  await MANIFEST.set({
    criadoEm: FieldValue.serverTimestamp(),
    versao: "1.0",
    gabineteIds: [],
    authUids: [],
    usuarioIds: [],
    eleitorIds: [],
  });

  const superUid = (await auth.getUserByEmail(SUPER_EMAIL)).uid;

  // ============================================================
  // GABINETE
  // ============================================================
  log("📌 GABINETE — Carlos Drummond (Dep. Federal - UNIÃO)", C.blue + C.bold);
  const gabRef = await db.collection("campanhas").add({
    nome: "Carlos Drummond — Força SP 2026",
    slug: "carlos-drummond-forca-sp-2026",
    politicoNome: "Carlos Drummond",
    politicoEmail: "dep.federal@mail.com",
    politicoPartido: "UNIÃO",
    politicoNumero: "1026",
    cargo: "deputado_federal",
    nivelPolitico: "federal",
    cicloEleitoral: "estadual_federal_2026",
    corPrincipal: "#7c3aed",
    estado: "SP",
    municipios: ["Campinas", "Americana", "Sorocaba"],
    metaEleitoral: 500,
    ativo: true,
    criadoPor: superUid,
    criadoEm: ts(45),
    _fake: true,
  });
  const gabId = gabRef.id;
  await appendManifesto("gabineteIds", [gabId]);
  log(`  ✅ Gabinete criado: ${gabId}\n`, C.green);

  // ============================================================
  // USUÁRIOS
  // ============================================================
  log("👤 USUÁRIOS", C.blue + C.bold);
  const B = { gabineteId: gabId, campanhaId: gabId, criadoPor: superUid };

  // Político
  const depUid = await criarUsuario("dep.federal@mail.com", {
    ...B, nome: "Carlos Drummond", role: "politico",
    criadoEm: ts(45), ultimaAtividade: ts(1),
  });

  // Assessores
  const anaUid = await criarUsuario("assessora.ana@mail.com", {
    ...B, nome: "Ana Lima", role: "assessor",
    criadoEm: ts(40), ultimaAtividade: ts(1),
  });
  const brunoUid = await criarUsuario("assessor.bruno@mail.com", {
    ...B, nome: "Bruno Melo", role: "assessor",
    criadoEm: ts(40), ultimaAtividade: ts(14),
  });

  // Coordenadores — assessorId vincula explicitamente ao assessor responsável
  const ccId = await criarUsuario("coord.campinas@mail.com", {
    ...B, nome: "Rafael Moreira", role: "coordenador",
    assessorId: anaUid, criadoEm: ts(35), ultimaAtividade: ts(1),
  });
  const caId = await criarUsuario("coord.americana@mail.com", {
    ...B, nome: "Julia Fernandes", role: "coordenador",
    assessorId: anaUid, criadoEm: ts(35), ultimaAtividade: ts(3),
  });
  const csId = await criarUsuario("coord.sorocaba@mail.com", {
    ...B, nome: "Diego Pires", role: "coordenador",
    assessorId: brunoUid, criadoEm: ts(35), ultimaAtividade: ts(7),
  });
  const ciId = await criarUsuario("coord.interior@mail.com", {
    ...B, nome: "Marcos Tadeu", role: "coordenador",
    assessorId: brunoUid, criadoEm: ts(35), ultimaAtividade: ts(9),
  });

  // Colaboradores
  const c01 = await criarUsuario("colab.01@mail.com", {
    ...B, nome: "Vitor Carvalho", role: "colaborador", status: "ativo",
    coordenadorId: ccId, criadoEm: ts(30), ultimaAtividade: ts(1),
  });
  const c02 = await criarUsuario("colab.02@mail.com", {
    ...B, nome: "Luana Souza", role: "colaborador", status: "ativo",
    coordenadorId: ccId, criadoEm: ts(30), ultimaAtividade: ts(2),
  });
  const c03 = await criarUsuario("colab.03@mail.com", {
    ...B, nome: "Eduardo Braga", role: "colaborador", status: "ativo",
    coordenadorId: caId, criadoEm: ts(30), ultimaAtividade: ts(3),
  });
  const c04 = await criarUsuario("colab.04@mail.com", {
    // criadoEm há 4 dias → status "iniciando" (grace period 7d)
    ...B, nome: "Rebeca Torres", role: "colaborador", status: "ativo",
    coordenadorId: caId, criadoEm: ts(4),
    // sem ultimaAtividade propositalmente
  });
  const c05 = await criarUsuario("colab.05@mail.com", {
    ...B, nome: "Henrique Leal", role: "colaborador", status: "ativo",
    coordenadorId: csId, criadoEm: ts(30), ultimaAtividade: ts(7),
  });
  const c06 = await criarUsuario("colab.06@mail.com", {
    ...B, nome: "Tania Cardoso", role: "colaborador", status: "ativo",
    coordenadorId: csId, criadoEm: ts(30), ultimaAtividade: ts(12),
  });
  const c07 = await criarUsuario("colab.07@mail.com", {
    ...B, nome: "Silvio Queiroz", role: "colaborador", status: "ativo",
    coordenadorId: ciId, criadoEm: ts(30), ultimaAtividade: ts(8),
  });
  const c08 = await criarUsuario("colab.08@mail.com", {
    // criadoEm há 20 dias, nunca ativou → "sem_atividade"
    ...B, nome: "Norma Faria", role: "colaborador", status: "ativo",
    coordenadorId: ciId, criadoEm: ts(20),
    // sem ultimaAtividade propositalmente
  });

  const allUids = [depUid, anaUid, brunoUid, ccId, caId, csId, ciId, c01, c02, c03, c04, c05, c06, c07, c08].filter(Boolean);
  await appendManifesto("authUids", allUids);
  await appendManifesto("usuarioIds", allUids);
  log("", C.reset);

  // ============================================================
  // ELEITORES
  // ============================================================
  log("🗳️  ELEITORES", C.blue + C.bold);

  // Bairros por cidade
  const BC = ["Centro", "Cambuí", "Taquaral", "Jardins", "Guanabara", "Santa Lúcia"];
  const BA = ["Centro", "Parque Novo Mundo", "São Domingos", "Vila Medon"];
  const BS = ["Centro", "Jardim Europa", "Wanel Ville", "Campolim", "Vitória Régia"];
  const BI = ["Centro", "Vila Nova", "Bela Vista"];

  /*
   * Distribuição planejada de criadoEm para ativar IC corretamente:
   *
   * Equipe Campinas/Americana (Ana) → IC acelerando (+89%)
   *   colab.01: 10 na última semana (dias 1-6) + 5 semana anterior (dias 8-12)
   *   colab.02:  7 na última semana (dias 1-6) + 4 semana anterior (dias 8-12)
   *   colab.03:  6 na última semana (dias 1-5)
   *   colab.04:  5 na última semana (dias 1-4)
   *
   * Equipe Sorocaba/Interior (Bruno) → zerou após parar (dias 8-13)
   *   colab.05: 12 na semana anterior (dias 8-13)
   *   colab.06:  8 na semana anterior (dias 8-13)
   *   colab.07:  6 na semana anterior (dias 8-13)
   *   colab.08:  0 (nunca cadastrou)
   *
   * IC gabinete total:
   *   atual (0-7d):    10+7+6+5 = 28
   *   anterior (7-14d): 5+4+12+8+6 = 35
   *   variação: -20% → retraindo → alerta dispara para assessores
   */
  const eleitorIds = await criarEleitores([
    {
      campanhaId: gabId, colaboradorId: c01, colaboradorNome: "Vitor Carvalho",
      coordenadorId: ccId, coordenadorNome: "Rafael Moreira",
      cidade: "Campinas", bairros: BC,
      graus:     ["forte","forte","forte","forte","forte","medio","medio","medio","medio","medio","fraco","fraco","fraco","indeciso","indeciso"],
      diasAtras: [1,      1,      2,      2,      3,      3,      4,      4,      5,      6,      8,      9,      10,     11,        12     ],
    },
    {
      campanhaId: gabId, colaboradorId: c02, colaboradorNome: "Luana Souza",
      coordenadorId: ccId, coordenadorNome: "Rafael Moreira",
      cidade: "Campinas", bairros: BC,
      graus:     ["forte","forte","forte","medio","medio","medio","medio","medio","fraco","fraco","indeciso"],
      diasAtras: [1,      2,      3,      3,      4,      5,      6,      6,      8,      10,     12      ],
    },
    {
      campanhaId: gabId, colaboradorId: c03, colaboradorNome: "Eduardo Braga",
      coordenadorId: caId, coordenadorNome: "Julia Fernandes",
      cidade: "Americana", bairros: BA,
      graus:     ["forte","forte","forte","medio","medio","indeciso"],
      diasAtras: [1,      2,      2,      3,      4,      5       ],
    },
    {
      campanhaId: gabId, colaboradorId: c04, colaboradorNome: "Rebeca Torres",
      coordenadorId: caId, coordenadorNome: "Julia Fernandes",
      cidade: "Americana", bairros: BA,
      graus:     ["forte","forte","medio","medio","fraco"],
      diasAtras: [1,      2,      2,      3,      4     ],
    },
    {
      campanhaId: gabId, colaboradorId: c05, colaboradorNome: "Henrique Leal",
      coordenadorId: csId, coordenadorNome: "Diego Pires",
      cidade: "Sorocaba", bairros: BS,
      graus:     ["forte","forte","medio","medio","medio","fraco","fraco","fraco","fraco","indeciso","indeciso","indeciso"],
      diasAtras: [8,      9,      9,      10,     10,     11,     11,     12,     12,     13,        13,        13       ],
    },
    {
      campanhaId: gabId, colaboradorId: c06, colaboradorNome: "Tania Cardoso",
      coordenadorId: csId, coordenadorNome: "Diego Pires",
      cidade: "Sorocaba", bairros: BS,
      graus:     ["forte","medio","medio","fraco","fraco","fraco","indeciso","indeciso"],
      diasAtras: [8,      9,      10,     10,     11,     12,     12,        13       ],
    },
    {
      campanhaId: gabId, colaboradorId: c07, colaboradorNome: "Silvio Queiroz",
      coordenadorId: ciId, coordenadorNome: "Marcos Tadeu",
      cidade: "São Paulo", bairros: BI,
      graus:     ["forte","medio","medio","fraco","fraco","indeciso"],
      diasAtras: [8,      9,      10,     11,     12,     13       ],
    },
    // colab.08 (Norma Faria): 0 eleitores — sem atividade proposital
  ]);

  log(`\n  ⚠️  Norma Faria (colab.08): 0 eleitores — sem atividade`, C.yellow);
  await appendManifesto("eleitorIds", eleitorIds);

  // ============================================================
  // TABELA DE LOGINS
  // ============================================================
  const total = eleitorIds.length;
  log("\n" + "═".repeat(64), C.cyan);
  log("  📋  LOGINS DO CENÁRIO FAKE — senha: 111111 (todos)", C.bold + C.cyan);
  log("═".repeat(64), C.cyan);

  const pad = (s, n) => String(s).padEnd(n);
  log(`\n  ${pad("EMAIL", 32)} ROLE / SITUAÇÃO`, C.dim);
  log("  " + "─".repeat(60), C.dim);

  const linhas = [
    ["dep.federal@mail.com",      "político    Carlos Drummond (visão executiva)"],
    ["assessora.ana@mail.com",    "assessor    Ana Lima — ativa ✅ (alertas de equipe visíveis)"],
    ["assessor.bruno@mail.com",   "assessor    Bruno Melo — inativo 14d ⚠️  (mesmos alertas)"],
    ["coord.campinas@mail.com",   "coordenador Rafael Moreira — ativo ✅ sem alertas"],
    ["coord.americana@mail.com",  "coordenador Julia Fernandes — ativa ✅ sem alertas"],
    ["coord.sorocaba@mail.com",   "coordenador Diego Pires — parado 7d 🟡 ALERTA"],
    ["coord.interior@mail.com",   "coordenador Marcos Tadeu — parado 9d 🟡 ALERTA"],
    ["colab.01@mail.com",         "colaborador Vitor Carvalho | Campinas | Ativo ✅"],
    ["colab.02@mail.com",         "colaborador Luana Souza   | Campinas | Ativo ✅"],
    ["colab.03@mail.com",         "colaborador Eduardo Braga | Americana | Ativo ✅"],
    ["colab.04@mail.com",         "colaborador Rebeca Torres | Americana | Iniciando 🔵 (4d)"],
    ["colab.05@mail.com",         "colaborador Henrique Leal | Sorocaba  | Parado 7d 🟠"],
    ["colab.06@mail.com",         "colaborador Tania Cardoso | Sorocaba  | Inativo 12d 🔴"],
    ["colab.07@mail.com",         "colaborador Silvio Queiroz | Interior | Parado 8d 🟠"],
    ["colab.08@mail.com",         "colaborador Norma Faria   | Interior  | Sem atividade ⚫"],
  ];

  for (const [email, desc] of linhas) {
    log(`  ${pad(email, 32)} ${desc}`);
  }

  log("\n  📊 RESUMO DO CENÁRIO", C.bold);
  log(`  • 1 gabinete: Carlos Drummond — Força SP 2026 (UNIÃO)`);
  log(`  • 15 usuários (1 político + 2 assessores + 4 coordenadores + 8 colaboradores)`);
  log(`  • ${total} eleitores — Campinas, Americana, Sorocaba, São Paulo`);
  log(`  • IC gabinete: -20% semana a semana → retraindo 🟡`);
  log(`  • IC coord.campinas: +89% → acelerando ✅`);
  log(`  • IC coord.sorocaba: -100% → queda 🔴`);

  log("\n  🎯 ALERTAS ESPERADOS POR ROLE", C.bold);
  log("  assessora.ana / assessor.bruno:");
  log("    🔴 Tania Cardoso inativa (12d)");
  log("    🟡 Henrique Leal parado (7d), Silvio Queiroz parado (8d)");
  log("    🟡 Crescimento em queda: -20% vs semana");
  log("  coord.sorocaba:");
  log("    🔴 Toda a equipe sem atividade recente");
  log("    🟡 Cadastros em queda: -100%");
  log("  coord.interior:");
  log("    🟡 Silvio Queiroz sem atividade recente");
  log("    🟡 Cadastros em queda: -100%");
  log("  coord.campinas / coord.americana:");
  log("    ✅ Nenhum alerta");

  log("\n  🧹 PARA LIMPAR:", C.bold);
  log("  node scripts/limpar-cenario-fake.mjs --confirm");
  log("═".repeat(64) + "\n", C.cyan);
}

main().catch((e) => {
  log(`\n❌ Erro: ${e.message}`, C.red);
  console.error(e);
  process.exit(1);
});

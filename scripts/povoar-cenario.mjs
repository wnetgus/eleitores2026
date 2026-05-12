#!/usr/bin/env node

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) continue;
  const key = trimmed.slice(0, eqIndex).trim();
  let value = trimmed.slice(eqIndex + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  if (!process.env[key]) process.env[key] = value;
}

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey }) });
}

const auth = getAuth();
const db = getFirestore();

async function getUid(email) {
  try { return (await auth.getUserByEmail(email)).uid; } catch { return null; }
}

async function getGabId(nomeSlug) {
  const snap = await db.collection("campanhas").where("slug", "==", nomeSlug).get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);
  return Timestamp.fromDate(d);
}

const gabinetes = {
  carlos: { slug: "carlos-mendes", nome: "Carlos Mendes" },
  marcos: { slug: "marcos-silva", nome: "Marcos Silva" },
  joao: { slug: "joao-santos", nome: "João Santos" },
  lucas: { slug: "lucas-oliveira", nome: "Lucas Oliveira" },
};

const eleitoresPorGabinete = {
  carlos: [
    { nome: "Maria Aparecida Silva", tel: "81991111111", doc: "12345678901", cidade: "Recife", bairro: "Boa Viagem", grau: "forte", idade: "entre_25_34" },
    { nome: "José Carlos Oliveira", tel: "81992222222", doc: "23456789012", cidade: "Recife", bairro: "Espinheiro", grau: "forte", idade: "entre_45_59" },
    { nome: "Ana Beatriz Costa", tel: "81993333333", doc: "34567890123", cidade: "Olinda", bairro: "Casa Caiada", grau: "medio", idade: "entre_18_24" },
    { nome: "Pedro Henrique Alves", tel: "81994444444", doc: "45678901234", cidade: "Recife", bairro: "Casa Forte", grau: "forte", idade: "entre_35_44" },
    { nome: "Luciana Mendes Rocha", tel: "81995555555", doc: "56789012345", cidade: "Olinda", bairro: "Rio Doce", grau: "medio", idade: "entre_25_34" },
    { nome: "Ricardo Santos Lima", tel: "81996666666", doc: "67890123456", cidade: "Recife", bairro: "Boa Vista", grau: "fraco", idade: "maior_60" },
    { nome: "Fernanda Torres Neves", tel: "81997777777", doc: "78901234567", cidade: "Recife", bairro: "Graças", grau: "forte", idade: "entre_35_44" },
    { nome: "Carlos Eduardo Martins", tel: "81998888888", doc: "89012345678", cidade: "Jaboatão", bairro: "Piedade", grau: "indeciso", idade: "entre_45_59" },
    { nome: "Patrícia Azevedo Castro", tel: "81999999999", doc: "90123456789", cidade: "Recife", bairro: "Torre", grau: "medio", idade: "entre_25_34" },
    { nome: "Roberto Almeida Costa", tel: "81811111111", doc: "01234567890", cidade: "Recife", bairro: "Ilha do Leite", grau: "forte", idade: "maior_60" },
    { nome: "Juliana Menezes Porto", tel: "81812222222", doc: "11234567890", cidade: "Olinda", bairro: "Bairro Novo", grau: "medio", idade: "entre_18_24" },
    { nome: "Thiago Nunes Barbosa", tel: "81813333333", doc: "21234567890", cidade: "Recife", bairro: "Várzea", grau: "fraco", idade: "entre_35_44" },
  ],
  marcos: [
    { nome: "Amanda Rodrigues Souza", tel: "82991111111", doc: "31234567890", cidade: "Caruaru", bairro: "Indianópolis", grau: "forte", idade: "entre_25_34" },
    { nome: "Felipe Araújo Neto", tel: "82992222222", doc: "41234567890", cidade: "Caruaru", bairro: "Maurício de Nassau", grau: "forte", idade: "entre_45_59" },
    { nome: "Camila Torres Lins", tel: "82993333333", doc: "51234567890", cidade: "Garanhuns", bairro: "Boa Vista", grau: "medio", idade: "entre_35_44" },
    { nome: "Diego Costa Ferreira", tel: "82994444444", doc: "61234567890", cidade: "Caruaru", bairro: "Universitário", grau: "medio", idade: "entre_18_24" },
    { nome: "Larissa Melo Santos", tel: "82995555555", doc: "71234567890", cidade: "Caruaru", bairro: "São Francisco", grau: "forte", idade: "entre_25_34" },
    { nome: "Gustavo Henrique Lopes", tel: "82996666666", doc: "81234567890", cidade: "Garanhuns", bairro: "Heliópolis", grau: "indeciso", idade: "maior_60" },
    { nome: "Beatriz Andrade Lima", tel: "82997777777", doc: "91234567890", cidade: "Caruaru", bairro: "Rendeiras", grau: "forte", idade: "entre_35_44" },
    { nome: "Eduardo Morais Silva", tel: "82998888888", doc: "01334567890", cidade: "Caruaru", bairro: "Pinheirópolis", grau: "fraco", idade: "entre_45_59" },
    { nome: "Vanessa Oliveira Costa", tel: "82999999999", doc: "11334567890", cidade: "Garanhuns", bairro: "Centro", grau: "medio", idade: "entre_25_34" },
    { nome: "Marcelo Augusto Santos", tel: "82811111111", doc: "21334567890", cidade: "Caruaru", bairro: "Nossa Senhora das Dores", grau: "forte", idade: "entre_35_44" },
  ],
  joao: [
    { nome: "Sandra Cristina Melo", tel: "81971111111", doc: "31334567890", cidade: "Recife", bairro: "Cordeiro", grau: "forte", idade: "entre_35_44" },
    { nome: "Rafael Oliveira Souza", tel: "81972222222", doc: "41334567890", cidade: "Recife", bairro: "Pina", grau: "medio", idade: "entre_25_34" },
    { nome: "Débora Farias Costa", tel: "81973333333", doc: "51334567890", cidade: "Recife", bairro: "Madalena", grau: "forte", idade: "entre_18_24" },
    { nome: "Alexandre Pereira Lima", tel: "81974444444", doc: "61334567890", cidade: "Recife", bairro: "Boa Viagem", grau: "fraco", idade: "maior_60" },
    { nome: "Tatiana Barbosa Neves", tel: "81975555555", doc: "71334567890", cidade: "Recife", bairro: "Espinheiro", grau: "forte", idade: "entre_45_59" },
    { nome: "Leonardo Castro Alves", tel: "81976666666", doc: "81334567890", cidade: "Recife", bairro: "Casa Amarela", grau: "indeciso", idade: "entre_25_34" },
    { nome: "Priscila Gomes Torres", tel: "81977777777", doc: "91334567890", cidade: "Recife", bairro: "Graças", grau: "medio", idade: "entre_35_44" },
    { nome: "Fábio Ricardo Batista", tel: "81978888888", doc: "01434567890", cidade: "Recife", bairro: "Boa Vista", grau: "forte", idade: "entre_25_34" },
    { nome: "Renata Carvalho Ribeiro", tel: "81979999999", doc: "11434567890", cidade: "Recife", bairro: "Ilha do Leite", grau: "medio", idade: "entre_45_59" },
    { nome: "Marcos Vinícius Santos", tel: "81871111111", doc: "21434567890", cidade: "Recife", bairro: "Várzea", grau: "forte", idade: "entre_35_44" },
    { nome: "Aline Regina Duarte", tel: "81872222222", doc: "31434567890", cidade: "Recife", bairro: "Torre", grau: "medio", idade: "entre_18_24" },
    { nome: "Sérgio Murilo Campos", tel: "81873333333", doc: "41434567890", cidade: "Recife", bairro: "Parnamirim", grau: "forte", idade: "entre_25_34" },
    { nome: "Cristiane Aparecida Lira", tel: "81874444444", doc: "51434567890", cidade: "Recife", bairro: "Cordeiro", grau: "indeciso", idade: "maior_60" },
    { nome: "João Victor Monteiro", tel: "81875555555", doc: "61434567890", cidade: "Recife", bairro: "Boa Viagem", grau: "forte", idade: "entre_18_24" },
    { nome: "Raquel Santana Oliveira", tel: "81876666666", doc: "71434567890", cidade: "Recife", bairro: "Madalena", grau: "medio", idade: "entre_35_44" },
  ],
  lucas: [
    { nome: "Thiago Alexandre Costa", tel: "81961111111", doc: "81434567890", cidade: "Olinda", bairro: "Casa Caiada", grau: "forte", idade: "entre_25_34" },
    { nome: "Vanessa Lúcia Pereira", tel: "81962222222", doc: "91434567890", cidade: "Olinda", bairro: "Bairro Novo", grau: "medio", idade: "entre_35_44" },
    { nome: "Hugo Leonardo Souza", tel: "81963333333", doc: "01534567890", cidade: "Paulista", bairro: "Janga", grau: "forte", idade: "entre_45_59" },
    { nome: "Isabel Cristina Melo", tel: "81964444444", doc: "11534567890", cidade: "Olinda", bairro: "Rio Doce", grau: "forte", idade: "entre_25_34" },
    { nome: "Davi Lucca Nascimento", tel: "81965555555", doc: "21534567890", cidade: "Paulista", bairro: "Nobre", grau: "indeciso", idade: "entre_18_24" },
    { nome: "Clara Maria Bezerra", tel: "81966666666", doc: "31534567890", cidade: "Olinda", bairro: "Peixinhos", grau: "medio", idade: "maior_60" },
    { nome: "Bruno Rafael Carvalho", tel: "81967777777", doc: "41534567890", cidade: "Olinda", bairro: "Casa Caiada", grau: "forte", idade: "entre_35_44" },
    { nome: "Elaine Cristina Martins", tel: "81968888888", doc: "51534567890", cidade: "Paulista", bairro: "Janga", grau: "fraco", idade: "entre_45_59" },
    { nome: "Gabriel Henrique Lima", tel: "81969999999", doc: "61534567890", cidade: "Olinda", bairro: "Bairro Novo", grau: "forte", idade: "entre_25_34" },
    { nome: "Alessandra Rocha Campos", tel: "81861111111", doc: "71534567890", cidade: "Olinda", bairro: "Águas Compridas", grau: "medio", idade: "entre_35_44" },
    { nome: "Márcio Roberto Silva", tel: "81862222222", doc: "81534567890", cidade: "Olinda", bairro: "Rio Doce", grau: "forte", idade: "entre_25_34" },
    { nome: "Lorena Oliveira Santos", tel: "81863333333", doc: "91534567890", cidade: "Paulista", bairro: "Arthur Lundgren I", grau: "medio", idade: "entre_18_24" },
  ],
};

const candidatosPorGabinete = {
  carlos: [
    { nome: "Carlos Mendes", partido: "PT", numero: "1313", cargo: "deputado_federal" },
    { nome: "Dra. Sandra Torres", partido: "PT", numero: "1314", cargo: "deputado_federal" },
  ],
  marcos: [
    { nome: "Marcos Silva", partido: "PSDB", numero: "4512", cargo: "deputado_estadual" },
    { nome: "Prof. Ricardo Alves", partido: "PSDB", numero: "4523", cargo: "deputado_estadual" },
  ],
  joao: [
    { nome: "João Santos", partido: "MDB", numero: "15000", cargo: "prefeito" },
    { nome: "Dr. Paulo Roberto", partido: "MDB", numero: "15123", cargo: "vereador" },
    { nome: "Enfermeira Cláudia", partido: "MDB", numero: "15456", cargo: "vereador" },
  ],
  lucas: [
    { nome: "Lucas Oliveira", partido: "PL", numero: "22123", cargo: "vereador" },
    { nome: "Tenente Correia", partido: "PL", numero: "22456", cargo: "vereador" },
  ],
};

// Metas: cada colaborador tem meta de 30-50 cadastros no mês
const metasPorGabinete = {};

async function main() {
  console.log("=== POVOANDO CENÁRIO DE TESTE ===\n");

  // 1. VINCULAR COLABORADORES AOS COORDENADORES E RENOMEAR
  console.log("--- VINCULANDO COLABORADORES ---");
  const vinculos = [
    { gab: "carlos", coordEmail: "carlos.coordenador@email.com", colabEmail: "carlos.colaborador@email.com", novoNome: "Pedro Alves" },
    { gab: "marcos", coordEmail: "marcos.coordenador@email.com", colabEmail: "marcos.colaborador@email.com", novoNome: "Lucas Ferreira" },
    { gab: "joao", coordEmail: "joao.coordenador@email.com", colabEmail: "joao.colab1@email.com", novoNome: "Rafael Costa" },
    { gab: "joao", coordEmail: "joao.coordenador@email.com", colabEmail: "joao.colab2@email.com", novoNome: "Gabriela Santos" },
    { gab: "lucas", coordEmail: "lucas.coordenador@email.com", colabEmail: "lucas.colab1@email.com", novoNome: "Thiago Lima" },
    { gab: "lucas", coordEmail: "lucas.coordenador@email.com", colabEmail: "lucas.colab2@email.com", novoNome: "Juliana Melo" },
  ];

  for (const v of vinculos) {
    const coordUid = await getUid(v.coordEmail);
    const colabUid = await getUid(v.colabEmail);
    if (coordUid && colabUid) {
      await db.collection("usuarios").doc(colabUid).update({ nome: v.novoNome, coordenadorId: coordUid });
      const coordDoc = await db.collection("usuarios").doc(coordUid).get();
      const equipe = coordDoc.data()?.equipe || [];
      if (!equipe.includes(colabUid)) equipe.push(colabUid);
      await db.collection("usuarios").doc(coordUid).update({ equipe });
      console.log(`  ${v.novoNome} vinculado ao coordenador de ${v.gab}`);
    }
  }

  // 2. CRIAR CANDIDATOS
  console.log("\n--- CRIANDO CANDIDATOS ---");
  for (const [gabKey, candidatos] of Object.entries(candidatosPorGabinete)) {
    const gabId = await getGabId(gabinetes[gabKey].slug);
    if (!gabId) { console.log(`  Gabinete ${gabKey} não encontrado`); continue; }
    for (const c of candidatos) {
      await db.collection("candidatos").add({
        ...c, gabineteId: gabId, campanhaId: gabId, ativo: true, criadoEm: FieldValue.serverTimestamp(),
      });
    }
    console.log(`  ${candidatos.length} candidatos para ${gabinetes[gabKey].nome}`);
  }

  // 3. COLETAR UIDS DOS COLABORADORES PARA DISTRIBUIR ELEITORES
  console.log("\n--- CADASTRANDO ELEITORES ---");
  for (const [gabKey, eleitores] of Object.entries(eleitoresPorGabinete)) {
    const gabId = await getGabId(gabinetes[gabKey].slug);
    if (!gabId) { console.log(`  Gabinete ${gabKey} não encontrado`); continue; }

    // Pegar o(s) colaborador(es) do gabinete
    const vinculosGab = vinculos.filter(v => v.gab === gabKey);
    const colabUids = [];
    for (const v of vinculosGab) {
      const uid = await getUid(v.colabEmail);
      if (uid) colabUids.push(uid);
    }

    let count = 0;
    for (let i = 0; i < eleitores.length; i++) {
      const e = eleitores[i];
      const colabUid = colabUids[i % colabUids.length] || "";
      const colabNome = vinculosGab[i % vinculosGab.length]?.novoNome || "Desconhecido";
      const dias = Math.floor(Math.random() * 20);
      const voto = Math.random() > 0.3 ? "sim" : Math.random() > 0.5 ? "nao" : "indeciso";

      await db.collection("eleitores").add({
        campanhaId: gabId,
        nomeCompleto: e.nome,
        telefone: e.tel,
        tipoDocumento: "cpf",
        documento: e.doc,
        estado: "PE",
        cidade: e.cidade,
        bairro: e.bairro,
        grauApoio: e.grau,
        voto,
        logradouro: `Rua ${e.bairro}`,
        numero: String(100 + i * 10),
        colaboradorId: colabUid,
        colaboradorNome: colabNome,
        criadoEm: diasAtras(dias),
        atualizadoEm: diasAtras(dias),
      });
      count++;
    }
    console.log(`  ${count} eleitores para ${gabinetes[gabKey].nome}`);
  }

  // 4. CRIAR METAS
  console.log("\n--- CRIANDO METAS ---");
  const metaConfigs = [
    { gab: "carlos", colabEmail: "carlos.colaborador@email.com", meta: 50 },
    { gab: "marcos", colabEmail: "marcos.colaborador@email.com", meta: 40 },
    { gab: "joao", colabEmail: "joao.colab1@email.com", meta: 45 },
    { gab: "joao", colabEmail: "joao.colab2@email.com", meta: 35 },
    { gab: "lucas", colabEmail: "lucas.colab1@email.com", meta: 40 },
    { gab: "lucas", colabEmail: "lucas.colab2@email.com", meta: 30 },
  ];

  for (const m of metaConfigs) {
    const colabUid = await getUid(m.colabEmail);
    if (!colabUid) continue;
    const colabDoc = await db.collection("usuarios").doc(colabUid).get();
    const colabData = colabDoc.data();
    const gabId = await getGabId(gabinetes[m.gab].slug);
    if (!gabId) continue;

    await db.collection("metas").add({
      colaboradorId: colabUid,
      colaboradorNome: colabData?.nome || "Desconhecido",
      gabineteId: gabId,
      meta: m.meta,
      periodo: "maio_2026",
      inicio: Timestamp.fromDate(new Date(2026, 4, 1)),
      fim: Timestamp.fromDate(new Date(2026, 4, 31)),
      criadoEm: FieldValue.serverTimestamp(),
    });
    console.log(`  Meta de ${m.meta} para ${colabData?.nome || m.colabEmail}`);
  }

  console.log("\n=== CENÁRIO POVOADO COM SUCESSO! ===");
}

main().catch(console.error);

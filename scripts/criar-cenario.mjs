#!/usr/bin/env node

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const auth = getAuth();
const db = getFirestore();

async function criarUsuario(email, senha, dados) {
  try {
    const user = await auth.createUser({ email, password: senha });
    await db.collection("usuarios").doc(user.uid).set({
      ...dados,
      criadoEm: FieldValue.serverTimestamp(),
      ativo: true,
    });
    console.log(`  ✅ ${dados.role}: ${email}`);
    return user.uid;
  } catch (e) {
    if (e.code === "auth/email-already-in-use") {
      const user = await auth.getUserByEmail(email);
      await db.collection("usuarios").doc(user.uid).set({
        ...dados,
        criadoEm: FieldValue.serverTimestamp(),
        ativo: true,
      }, { merge: true });
      console.log(`  🔄 ${dados.role}: ${email} (já existia, atualizado)`);
      return user.uid;
    }
    console.error(`  ❌ ${dados.role}: ${email} - ${e.message}`);
    return null;
  }
}

async function criarGabinete(dados) {
  const ref = await db.collection("campanhas").add({
    ...dados,
    ativo: true,
    criadoEm: FieldValue.serverTimestamp(),
  });
  console.log(`  ✅ Gabinete: ${dados.nome}`);
  return ref.id;
}

async function main() {
  const SENHA = "111111";
  const SUPER_UID = (await auth.getUserByEmail("wnetgus@gmail.com")).uid;

  // ============================================
  // GABINETE 1 — Carlos Mendes (Dep. Federal - PT)
  // ============================================
  console.log("\n📌 GABINETE 1 — Carlos Mendes (Dep. Federal - PT)");
  const g1Id = await criarGabinete({
    nome: "Carlos Mendes",
    slug: "carlos-mendes",
    politicoNome: "Carlos Mendes",
    politicoEmail: "carlos@deputado.com",
    politicoPartido: "PT",
    cargo: "deputado_federal",
    nivelPolitico: "federal",
    cicloEleitoral: "estadual_federal_2026",
    corPrincipal: "#cc2936",
    criadoPor: SUPER_UID,
  });
  await criarUsuario("carlos@deputado.com", SENHA, { email: "carlos@deputado.com", nome: "Carlos Mendes", role: "politico", gabineteId: g1Id, campanhaId: g1Id, criadoPor: SUPER_UID });
  await criarUsuario("ana.assessora@email.com", SENHA, { email: "ana.assessora@email.com", nome: "Ana Assessora", role: "assessor", gabineteId: g1Id, campanhaId: g1Id, criadoPor: SUPER_UID });
  await criarUsuario("carlos.coordenador@email.com", SENHA, { email: "carlos.coordenador@email.com", nome: "Carlos Coordenador", role: "coordenador", gabineteId: g1Id, campanhaId: g1Id, coordenadorId: "", criadoPor: SUPER_UID });
  await criarUsuario("carlos.colaborador@email.com", SENHA, { email: "carlos.colaborador@email.com", nome: "Carlos Colaborador", role: "colaborador", gabineteId: g1Id, campanhaId: g1Id, coordenadorId: "", criadoPor: SUPER_UID });

  // ============================================
  // GABINETE 2 — Marcos Silva (Dep. Estadual - PSDB)
  // ============================================
  console.log("\n📌 GABINETE 2 — Marcos Silva (Dep. Estadual - PSDB)");
  const g2Id = await criarGabinete({
    nome: "Marcos Silva",
    slug: "marcos-silva",
    politicoNome: "Marcos Silva",
    politicoEmail: "marcos@deputado.com",
    politicoPartido: "PSDB",
    cargo: "deputado_estadual",
    nivelPolitico: "estadual",
    cicloEleitoral: "estadual_federal_2026",
    parentGabineteId: g1Id,
    corPrincipal: "#2563eb",
    criadoPor: SUPER_UID,
  });
  await criarUsuario("marcos@deputado.com", SENHA, { email: "marcos@deputado.com", nome: "Marcos Silva", role: "politico", gabineteId: g2Id, campanhaId: g2Id, criadoPor: SUPER_UID });
  await criarUsuario("rafael.assessor@email.com", SENHA, { email: "rafael.assessor@email.com", nome: "Rafael Assessor", role: "assessor", gabineteId: g2Id, campanhaId: g2Id, criadoPor: SUPER_UID });
  await criarUsuario("marcos.coordenador@email.com", SENHA, { email: "marcos.coordenador@email.com", nome: "Marcos Coordenador", role: "coordenador", gabineteId: g2Id, campanhaId: g2Id, coordenadorId: "", criadoPor: SUPER_UID });
  await criarUsuario("marcos.colaborador@email.com", SENHA, { email: "marcos.colaborador@email.com", nome: "Marcos Colaborador", role: "colaborador", gabineteId: g2Id, campanhaId: g2Id, coordenadorId: "", criadoPor: SUPER_UID });

  // ============================================
  // GABINETE 3 — João Santos (Prefeito - MDB)
  // ============================================
  console.log("\n📌 GABINETE 3 — João Santos (Prefeito - MDB)");
  const g3Id = await criarGabinete({
    nome: "João Santos",
    slug: "joao-santos",
    politicoNome: "João Santos",
    politicoEmail: "joao@prefeito.com",
    politicoPartido: "MDB",
    cargo: "prefeito",
    nivelPolitico: "municipal",
    cicloEleitoral: "municipal_2028",
    parentGabineteId: g2Id,
    corPrincipal: "#059669",
    criadoPor: SUPER_UID,
  });
  await criarUsuario("joao@prefeito.com", SENHA, { email: "joao@prefeito.com", nome: "João Santos", role: "prefeito", gabineteId: g3Id, campanhaId: g3Id, criadoPor: SUPER_UID });
  await criarUsuario("mariana.assessora@email.com", SENHA, { email: "mariana.assessora@email.com", nome: "Mariana Assessora", role: "assessor", gabineteId: g3Id, campanhaId: g3Id, criadoPor: SUPER_UID });
  await criarUsuario("joao.coordenador@email.com", SENHA, { email: "joao.coordenador@email.com", nome: "João Coordenador", role: "coordenador", gabineteId: g3Id, campanhaId: g3Id, coordenadorId: "", criadoPor: SUPER_UID });
  await criarUsuario("joao.colab1@email.com", SENHA, { email: "joao.colab1@email.com", nome: "João Colaborador 1", role: "colaborador", gabineteId: g3Id, campanhaId: g3Id, coordenadorId: "", criadoPor: SUPER_UID });
  await criarUsuario("joao.colab2@email.com", SENHA, { email: "joao.colab2@email.com", nome: "João Colaborador 2", role: "colaborador", gabineteId: g3Id, campanhaId: g3Id, coordenadorId: "", criadoPor: SUPER_UID });

  // ============================================
  // GABINETE 4 — Lucas Oliveira (Vereador - PL)
  // ============================================
  console.log("\n📌 GABINETE 4 — Lucas Oliveira (Vereador - PL)");
  const g4Id = await criarGabinete({
    nome: "Lucas Oliveira",
    slug: "lucas-oliveira",
    politicoNome: "Lucas Oliveira",
    politicoEmail: "lucas@vereador.com",
    politicoPartido: "PL",
    cargo: "vereador",
    nivelPolitico: "municipal",
    cicloEleitoral: "municipal_2028",
    parentGabineteId: g3Id,
    corPrincipal: "#1d4ed8",
    criadoPor: SUPER_UID,
  });
  await criarUsuario("lucas@vereador.com", SENHA, { email: "lucas@vereador.com", nome: "Lucas Oliveira", role: "vereador", gabineteId: g4Id, campanhaId: g4Id, criadoPor: SUPER_UID });
  await criarUsuario("paula.assessora@email.com", SENHA, { email: "paula.assessora@email.com", nome: "Paula Assessora", role: "assessor", gabineteId: g4Id, campanhaId: g4Id, criadoPor: SUPER_UID });
  await criarUsuario("lucas.coordenador@email.com", SENHA, { email: "lucas.coordenador@email.com", nome: "Lucas Coordenador", role: "coordenador", gabineteId: g4Id, campanhaId: g4Id, coordenadorId: "", criadoPor: SUPER_UID });
  await criarUsuario("lucas.colab1@email.com", SENHA, { email: "lucas.colab1@email.com", nome: "Lucas Colaborador 1", role: "colaborador", gabineteId: g4Id, campanhaId: g4Id, coordenadorId: "", criadoPor: SUPER_UID });
  await criarUsuario("lucas.colab2@email.com", SENHA, { email: "lucas.colab2@email.com", nome: "Lucas Colaborador 2", role: "colaborador", gabineteId: g4Id, campanhaId: g4Id, coordenadorId: "", criadoPor: SUPER_UID });

  console.log("\n✅ CENÁRIO COMPLETO CRIADO COM SUCESSO!");
  console.log(`   ${4} gabinetes, ${19} usuários`);
}

main().catch((e) => { console.error("Erro:", e); process.exit(1); });

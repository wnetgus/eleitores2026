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
      await db.collection("usuarios").doc(user.uid).set({ ...dados, criadoEm: FieldValue.serverTimestamp(), ativo: true }, { merge: true });
      console.log(`  🔄 ${dados.role}: ${email} (já existia, atualizado)`);
      return user.uid;
    }
    console.error(`  ❌ ${dados.role}: ${email} - ${e.message}`);
    return null;
  }
}

async function criarGabinete(dados) {
  const ref = await db.collection("campanhas").add({ ...dados, ativo: true, criadoEm: FieldValue.serverTimestamp() });
  console.log(`  ✅ Gabinete: ${dados.nome}`);
  return ref.id;
}

async function main() {
  const SENHA = "111111";
  const SUPER_UID = (await auth.getUserByEmail("wnetgus@gmail.com")).uid;

  console.log(`
╔════════════════════════════════════════════╗
║  🌳 ÁRVORE MÍNIMA — ELEITORES 2026       ║
║                                           ║
║  Ricardo Almeida (Dep. Federal)           ║
║   └── Sofia Martins (Assessora)           ║
║        └── Thiago Oliveira (Coordenador)  ║
║             └── Larissa Santos (Colab.)   ║
╚════════════════════════════════════════════╝
`);

  // ============================================
  // 1. GABINETE — Ricardo Almeida (Dep. Federal)
  // ============================================
  console.log("📌 1. CRIANDO GABINETE: Ricardo Almeida (Deputado Federal)");
  const g1Id = await criarGabinete({
    nome: "Ricardo Almeida",
    slug: "ricardo-almeida",
    politicoNome: "Ricardo Almeida",
    politicoEmail: "ricardo@deputado.com",
    politicoPartido: "PT",
    cargo: "deputado_federal",
    nivelPolitico: "federal",
    cicloEleitoral: "estadual_federal_2026",
    corPrincipal: "#cc2936",
    criadoPor: SUPER_UID,
  });

  // Ricardo Almeida — politico
  await criarUsuario("ricardo@deputado.com", SENHA, {
    email: "ricardo@deputado.com", nome: "Ricardo Almeida", role: "politico",
    gabineteId: g1Id, campanhaId: g1Id, criadoPor: SUPER_UID,
  });

  // Sofia Martins — assessora
  const sofiaUid = await criarUsuario("sofia@assessora.com", SENHA, {
    email: "sofia@assessora.com", nome: "Sofia Martins", role: "assessor",
    gabineteId: g1Id, campanhaId: g1Id, criadoPor: SUPER_UID,
  });

  // Thiago Oliveira — coordenador
  const thiagoUid = await criarUsuario("thiago@coordenador.com", SENHA, {
    email: "thiago@coordenador.com", nome: "Thiago Oliveira", role: "coordenador",
    gabineteId: g1Id, campanhaId: g1Id, criadoPor: SUPER_UID,
  });

  // Larissa Santos — colaborador vinculado ao Thiago
  await criarUsuario("larissa@colaborador.com", SENHA, {
    email: "larissa@colaborador.com", nome: "Larissa Santos", role: "colaborador",
    gabineteId: g1Id, campanhaId: g1Id, coordenadorId: thiagoUid,
    status: "ativo", criadoPor: SUPER_UID,
  });

  console.log(`
╔════════════════════════════════════════════╗
║  ✅ ÁRVORE MÍNIMA CRIADA COM SUCESSO!    ║
╚════════════════════════════════════════════╝

📋 LOGINS PARA TESTE (senha: ${SENHA}):

  👤 Super Admin:    wnetgus@gmail.com
  👤 Dep. Federal:   ricardo@deputado.com
  👤 Assessora:      sofia@assessora.com
  👤 Coordenador:    thiago@coordenador.com
  👤 Colaborador:    larissa@colaborador.com

🌳 HIERARQUIA:
  Ricardo Almeida (Dep. Federal)
   └── Sofia Martins (Assessora)
        └── Thiago Oliveira (Coordenador)
             └── Larissa Santos (Colaborador)

📌 Gabinete ID: ${g1Id}
`);

}

main().catch((e) => { console.error("Erro:", e); process.exit(1); });

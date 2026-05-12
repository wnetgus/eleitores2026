#!/usr/bin/env node

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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

async function main() {
  // Buscar coordenador
  const coordUser = await auth.getUserByEmail("carlos.coordenador@email.com");
  const coordUid = coordUser.uid;
  const coordDoc = await db.collection("usuarios").doc(coordUid).get();
  const coordData = coordDoc.data();
  console.log("Coordenador encontrado:", coordData.nome, "UID:", coordUid);

  // Buscar colaborador e atualizar nome + coordenadorId
  const colabUser = await auth.getUserByEmail("carlos.colaborador@email.com");
  const colabUid = colabUser.uid;
  await db.collection("usuarios").doc(colabUid).update({
    nome: "Pedro Colaborador",
    coordenadorId: coordUid,
  });
  console.log("Colaborador atualizado: Pedro Colaborador, vinculado ao coordenador");

  // Atualizar coordenador com dados do colaborador
  await db.collection("usuarios").doc(coordUid).update({
    equipe: [colabUid],
  });
  console.log("Coordenador atualizado com equipe");
}

main().catch(console.error);

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

const updates = [
  { email: "carlos.coordenador@email.com", estado: "PE", cidadePrincipal: "Recife", regiao: "Zona Sul" },
  { email: "marcos.coordenador@email.com", estado: "PE", cidadePrincipal: "Caruaru", regiao: "Agreste" },
  { email: "joao.coordenador@email.com", estado: "PE", cidadePrincipal: "Recife", regiao: "Zona Norte" },
  { email: "lucas.coordenador@email.com", estado: "PE", cidadePrincipal: "Olinda", regiao: "Sede" },
];

for (const u of updates) {
  try {
    const user = await auth.getUserByEmail(u.email);
    await db.collection("usuarios").doc(user.uid).update({
      estado: u.estado,
      cidadePrincipal: u.cidadePrincipal,
      regiao: u.regiao,
    });
    console.log("OK:", u.email);
  } catch (e) {
    console.log("ERRO:", u.email, e.message);
  }
}

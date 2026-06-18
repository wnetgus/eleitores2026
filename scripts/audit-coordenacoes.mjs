#!/usr/bin/env node
import { readFileSync } from "fs";
import { resolve } from "path";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

try {
  const env = readFileSync(resolve("c:/Users/Weyne/VS CODE Projetos/Eleitores2026/.env.local"), "utf-8");
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
} catch { /* ok */ }

const pk = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (getApps().length === 0) initializeApp({ credential: cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: pk }) });
const db = getFirestore();

const snap = await db.collection("coordenacoes").get();
console.log(`\nTotal de coordenações: ${snap.size}\n`);

const AUDITADAS = ["Recife","Olinda","Caruaru","Garanhuns","Petrolina","Salgueiro","Timbaúba","Surubim"];

if (snap.size === 0) {
  console.log("Coleção vazia — nenhum documento encontrado.");
} else {
  console.log("municipio        | coordenadorNome      | campanhaId             | status");
  console.log("-----------------+----------------------+------------------------+--------");
  for (const d of snap.docs) {
    const data = d.data();
    const municipio      = (data.municipio      ?? "(ausente)").padEnd(16).slice(0, 16);
    const coordenadorNome = (data.coordenadorNome ?? "(ausente)").padEnd(20).slice(0, 20);
    const campanhaId     = (data.campanhaId     ?? "(ausente)").padEnd(22).slice(0, 22);
    const status         = data.status ?? "(ausente)";
    console.log(`${municipio} | ${coordenadorNome} | ${campanhaId} | ${status}`);
  }
}

console.log("\n--- Verificação por cidade ---");
const ativas = new Set(
  snap.docs
    .filter((d) => d.data().status === "ativa")
    .map((d) => d.data().municipio)
);

for (const cidade of AUDITADAS) {
  const tem = ativas.has(cidade);
  console.log(`${cidade.padEnd(14)} : ${tem ? "✅ SIM" : "❌ NÃO"}`);
}

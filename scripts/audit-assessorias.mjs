#!/usr/bin/env node
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
} catch { /* ok */ }

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (getApps().length === 0) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const TARGET_CAMPANHA = "5Y0Xi6Z1p9KvJiEqQODM";

const snap = await db.collection("assessorias").get();
console.log(`\nTotal de documentos: ${snap.size}\n`);

const rows = [];
let semCampanhaId = 0;
let campanhaIdVazio = 0;
let statusDiferente = 0;
let semMunicipio = 0;
let foraDaCampanha = 0;

for (const d of snap.docs) {
  const data = d.data();
  const municipio  = data.municipio  ?? "(ausente)";
  const campanhaId = data.campanhaId ?? "(ausente)";
  const status     = data.status     ?? "(ausente)";

  if (!data.campanhaId)           semCampanhaId++;
  if (data.campanhaId === "")     campanhaIdVazio++;
  if (data.status !== "ativa")    statusDiferente++;
  if (!data.municipio)            semMunicipio++;
  if (data.campanhaId !== TARGET_CAMPANHA) foraDaCampanha++;

  rows.push({ id: d.id, municipio, campanhaId, status });
}

console.log("municipio          | campanhaId             | status");
console.log("-------------------+------------------------+--------");
for (const r of rows) {
  console.log(
    r.municipio.padEnd(18) + " | " +
    r.campanhaId.padEnd(22) + " | " +
    r.status
  );
}

console.log("\n--- Anomalias ---");
console.log(`campanhaId ausente  : ${semCampanhaId}`);
console.log(`campanhaId vazio    : ${campanhaIdVazio}`);
console.log(`status != "ativa"   : ${statusDiferente}`);
console.log(`municipio ausente   : ${semMunicipio}`);
console.log(`fora de ${TARGET_CAMPANHA}: ${foraDaCampanha}`);

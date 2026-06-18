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

const snap = await db.collection("usuarios").where("role", "==", "assessor").get();

console.log(`\nTotal de assessores: ${snap.size}\n`);
console.log("nome                  | uid                          | campanhaId             | cidade          | cidadePrincipal | cidades[]      | ativo  | status");
console.log("----------------------+------------------------------+------------------------+-----------------+-----------------+----------------+--------+-------");

const ativos = [];

for (const d of snap.docs) {
  const data = d.data();
  const nome           = (data.nome           ?? "(ausente)").padEnd(21).slice(0, 21);
  const uid            = d.id.padEnd(28).slice(0, 28);
  const campanhaId     = (data.campanhaId     ?? data.gabineteId ?? "(ausente)").padEnd(22).slice(0, 22);
  const cidade         = (data.cidade         ?? "(ausente)").padEnd(15).slice(0, 15);
  const cidadePrincipal = (data.cidadePrincipal ?? "(ausente)").padEnd(15).slice(0, 15);
  const cidades        = Array.isArray(data.cidades) ? data.cidades.join(", ") : "(ausente)";
  const cidadesStr     = cidades.padEnd(14).slice(0, 14);
  const ativo          = String(data.ativo ?? "(ausente)").padEnd(6).slice(0, 6);
  const status         = data.status ?? "(ausente)";

  console.log(`${nome} | ${uid} | ${campanhaId} | ${cidade} | ${cidadePrincipal} | ${cidadesStr} | ${ativo} | ${status}`);

  if (data.ativo === true || data.ativo === undefined) {
    const municipio = data.cidadePrincipal || data.cidade || null;
    if (municipio) ativos.push({ municipio, nome: data.nome ?? "(sem nome)" });
  }
}

console.log("\n--- Municípios com assessor ativo ---");
if (ativos.length === 0) {
  console.log("Nenhum assessor ativo com município identificado.");
} else {
  ativos.forEach(({ municipio, nome }) => console.log(`${municipio} -> ${nome}`));
}

console.log(`\nTotal municípios com assessor ativo: ${ativos.length}`);

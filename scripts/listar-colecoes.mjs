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

const cols = await db.listCollections();
console.log("Coleções no Firestore:");
for (const c of cols) console.log(" -", c.id);

// Verificar campos de território nos assessores
const snap = await db.collection("usuarios").where("role", "==", "assessor").get();
console.log(`\nAssessores (${snap.size}):`);
for (const d of snap.docs) {
  const u = d.data();
  console.log(`  ${u.nome}`);
  console.log(`    cidadePrincipal: ${u.cidadePrincipal ?? "(ausente)"}`);
  console.log(`    cidades        : ${u.cidades ? JSON.stringify(u.cidades) : "(ausente)"}`);
  console.log(`    estado         : ${u.estado ?? "(ausente)"}`);
  console.log(`    regiao         : ${u.regiao ?? "(ausente)"}`);
}

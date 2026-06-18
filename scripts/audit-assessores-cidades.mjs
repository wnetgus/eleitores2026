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

const snap = await db.collection("usuarios").where("role", "==", "assessor").get();

for (const d of snap.docs) {
  const data = d.data();
  console.log(`\n--- ${data.nome} (ativo: ${data.ativo})`);
  console.log(`  cidadePrincipal : ${data.cidadePrincipal ?? "(ausente)"}`);
  console.log(`  cidade          : ${data.cidade ?? "(ausente)"}`);
  console.log(`  cidades[]       : ${JSON.stringify(data.cidades ?? [])}`);
}

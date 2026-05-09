import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { Eleitor, Atividade, Campanha } from "@/types";

const colecoes = {
  eleitores: "eleitores",
  usuarios: "usuarios",
  atividades: "atividades",
  metas: "metas",
  campanhas: "campanhas",
};

export async function getCampanhas() {
  const q = query(collection(db, colecoes.campanhas), orderBy("criadoEm", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Campanha));
}

export async function criarCampanha(data: Omit<Campanha, "id" | "criadoEm">) {
  const ref = await addDoc(collection(db, colecoes.campanhas), { ...data, criadoEm: serverTimestamp() });
  return ref.id;
}

export async function atualizarCampanha(id: string, data: Partial<Campanha>) {
  await updateDoc(doc(db, colecoes.campanhas, id), data);
}

export async function cadastrarEleitor(data: Omit<Eleitor, "id" | "criadoEm">) {
  const docRef = await addDoc(collection(db, colecoes.eleitores), {
    ...data,
    criadoEm: serverTimestamp(),
  });
  return docRef.id;
}

export async function buscarEleitores(campanhaId?: string, colaboradorId?: string) {
  const constraints: any[] = [];
  if (campanhaId) constraints.push(where("campanhaId", "==", campanhaId));
  if (colaboradorId) constraints.push(where("colaboradorId", "==", colaboradorId));
  constraints.push(orderBy("criadoEm", "desc"));
  const q = query(collection(db, colecoes.eleitores), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Eleitor));
}

export async function buscarEleitoresComFiltros(filtros: Record<string, any>) {
  let constraints: any[] = [];
  if (filtros.campanhaId) constraints.push(where("campanhaId", "==", filtros.campanhaId));
  if (filtros.colaboradorId) constraints.push(where("colaboradorId", "==", filtros.colaboradorId));
  if (filtros.estado) constraints.push(where("estado", "==", filtros.estado));
  if (filtros.cidade) constraints.push(where("cidade", "==", filtros.cidade));
  if (filtros.bairro) constraints.push(where("bairro", "==", filtros.bairro));
  if (filtros.grauApoio) constraints.push(where("grauApoio", "==", filtros.grauApoio));
  constraints.push(orderBy("criadoEm", "desc"));
  if (filtros.limite) constraints.push(limit(filtros.limite));
  const q = query(collection(db, colecoes.eleitores), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Eleitor));
}

export async function atualizarEleitor(id: string, data: Partial<Eleitor>) {
  await updateDoc(doc(db, colecoes.eleitores, id), { ...data, atualizadoEm: serverTimestamp() });
}

export async function excluirEleitor(id: string) {
  await deleteDoc(doc(db, colecoes.eleitores, id));
}

export async function verificarTituloDuplicado(titulo: string, campanhaId?: string): Promise<boolean> {
  const constraints: any[] = [where("tituloEleitoral", "==", titulo)];
  if (campanhaId) constraints.push(where("campanhaId", "==", campanhaId));
  const q = query(collection(db, colecoes.eleitores), ...constraints);
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

export async function registrarAtividade(data: Omit<Atividade, "id" | "criadoEm">) {
  await addDoc(collection(db, colecoes.atividades), {
    ...data,
    criadoEm: serverTimestamp(),
  });
}

export async function buscarAtividades(limite = 50, campanhaId?: string) {
  const constraints: any[] = [];
  if (campanhaId) constraints.push(where("campanhaId", "==", campanhaId));
  constraints.push(orderBy("criadoEm", "desc"));
  constraints.push(limit(limite));
  const q = query(collection(db, colecoes.atividades), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Atividade));
}

export async function contarEleitores(campanhaId?: string, colaboradorId?: string): Promise<number> {
  const constraints: any[] = [];
  if (campanhaId) constraints.push(where("campanhaId", "==", campanhaId));
  if (colaboradorId) constraints.push(where("colaboradorId", "==", colaboradorId));
  constraints.push(orderBy("criadoEm", "desc"));
  const q = query(collection(db, colecoes.eleitores), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.size;
}

export async function buscarEleitoresPorPeriodo(inicio: Date, fim: Date, campanhaId?: string, colaboradorId?: string) {
  const constraints: any[] = [];
  if (campanhaId) constraints.push(where("campanhaId", "==", campanhaId));
  if (colaboradorId) constraints.push(where("colaboradorId", "==", colaboradorId));
  constraints.push(where("criadoEm", ">=", Timestamp.fromDate(inicio)));
  constraints.push(where("criadoEm", "<=", Timestamp.fromDate(fim)));
  constraints.push(orderBy("criadoEm", "desc"));
  const q = query(collection(db, colecoes.eleitores), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Eleitor));
}

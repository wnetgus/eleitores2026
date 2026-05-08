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
  DocumentData,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { Eleitor, Atividade } from "@/types";

const colecoes = {
  eleitores: "eleitores",
  usuarios: "usuarios",
  atividades: "atividades",
  metas: "metas",
};

export async function cadastrarEleitor(data: Omit<Eleitor, "id" | "criadoEm">) {
  const docRef = await addDoc(collection(db, colecoes.eleitores), {
    ...data,
    criadoEm: serverTimestamp(),
  });
  return docRef.id;
}

export async function buscarEleitores(colaboradorId?: string) {
  const constraints: any[] = [];
  if (colaboradorId) {
    constraints.push(where("colaboradorId", "==", colaboradorId));
  }
  constraints.push(orderBy("criadoEm", "desc"));
  const q = query(collection(db, colecoes.eleitores), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Eleitor));
}

export async function buscarEleitoresComFiltros(filtros: Record<string, any>) {
  let constraints: any[] = [];
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

export async function verificarTituloDuplicado(titulo: string): Promise<boolean> {
  const q = query(collection(db, colecoes.eleitores), where("tituloEleitoral", "==", titulo));
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

export async function registrarAtividade(data: Omit<Atividade, "id" | "criadoEm">) {
  await addDoc(collection(db, colecoes.atividades), {
    ...data,
    criadoEm: serverTimestamp(),
  });
}

export async function buscarAtividades(limite = 50) {
  const q = query(collection(db, colecoes.atividades), orderBy("criadoEm", "desc"), limit(limite));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Atividade));
}

export async function contarEleitores(colaboradorId?: string): Promise<number> {
  const constraints: any[] = [];
  if (colaboradorId) constraints.push(where("colaboradorId", "==", colaboradorId));
  constraints.push(orderBy("criadoEm", "desc"));
  const q = query(collection(db, colecoes.eleitores), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.size;
}

export async function buscarEleitoresPorPeriodo(inicio: Date, fim: Date, colaboradorId?: string) {
  const constraints: any[] = [];
  if (colaboradorId) constraints.push(where("colaboradorId", "==", colaboradorId));
  constraints.push(where("criadoEm", ">=", Timestamp.fromDate(inicio)));
  constraints.push(where("criadoEm", "<=", Timestamp.fromDate(fim)));
  constraints.push(orderBy("criadoEm", "desc"));
  const q = query(collection(db, colecoes.eleitores), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Eleitor));
}

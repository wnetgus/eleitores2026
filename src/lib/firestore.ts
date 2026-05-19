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
  getCountFromServer,
} from "firebase/firestore";
import { db } from "./firebase";
import { Eleitor, Atividade, Gabinete, Candidato } from "@/types";

const colecoes = {
  eleitores: "eleitores",
  usuarios: "usuarios",
  atividades: "atividades",
  metas: "metas",
  gabinetes: "campanhas",
  candidatos: "candidatos",
};

export async function getGabinetes() {
  const q = query(collection(db, colecoes.gabinetes), orderBy("criadoEm", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Gabinete));
}

export async function criarGabinete(data: Omit<Gabinete, "id" | "criadoEm">) {
  const ref = await addDoc(collection(db, colecoes.gabinetes), { ...data, criadoEm: serverTimestamp() });
  return ref.id;
}

export async function atualizarGabinete(id: string, data: Partial<Gabinete>) {
  await updateDoc(doc(db, colecoes.gabinetes, id), data);
}

export async function cadastrarEleitor(data: Omit<Eleitor, "id" | "criadoEm"> | Record<string, any>) {
  const docRef = await addDoc(collection(db, colecoes.eleitores), {
    ...data,
    criadoEm: serverTimestamp(),
  });
  if (data.colaboradorId) {
    try {
      await updateDoc(doc(db, colecoes.usuarios, data.colaboradorId), {
        ultimaAtividade: serverTimestamp(),
      });
    } catch {
      // non-critical: eleitor foi salvo, apenas o timestamp de atividade falhou
    }
  }
  return docRef.id;
}

export async function buscarEleitores(gabineteId?: string, colaboradorId?: string) {
  const constraints: any[] = [];
  if (gabineteId) constraints.push(where("campanhaId", "==", gabineteId));
  if (colaboradorId) constraints.push(where("colaboradorId", "==", colaboradorId));
  constraints.push(orderBy("criadoEm", "desc"));
  const q = query(collection(db, colecoes.eleitores), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Eleitor));
}

export async function buscarEleitoresComFiltros(filtros: Record<string, any>) {
  let constraints: any[] = [];
  if (filtros.gabineteId) constraints.push(where("campanhaId", "==", filtros.gabineteId));
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

export async function verificarDocumentoDuplicado(documento: string, gabineteId?: string): Promise<boolean> {
  const constraints: any[] = [where("documento", "==", documento)];
  if (gabineteId) constraints.push(where("campanhaId", "==", gabineteId));
  const q = query(collection(db, colecoes.eleitores), ...constraints);
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

export async function buscarCandidatos(gabineteId: string): Promise<Candidato[]> {
  const q = query(
    collection(db, colecoes.candidatos),
    where("gabineteId", "==", gabineteId),
    where("ativo", "==", true),
    orderBy("nome", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Candidato));
}

export async function cadastrarCandidato(data: Omit<Candidato, "id" | "criadoEm">) {
  const ref = await addDoc(collection(db, colecoes.candidatos), {
    ...data,
    criadoEm: serverTimestamp(),
  });
  return ref.id;
}

export async function importarCandidatos(gabineteId: string, lista: Omit<Candidato, "id" | "criadoEm" | "gabineteId">[]) {
  const batch = lista.map((c) =>
    addDoc(collection(db, colecoes.candidatos), {
      ...c,
      gabineteId,
      criadoEm: serverTimestamp(),
    })
  );
  return Promise.all(batch);
}

export async function registrarAtividade(data: Omit<Atividade, "id" | "criadoEm">) {
  await addDoc(collection(db, colecoes.atividades), {
    ...data,
    criadoEm: serverTimestamp(),
  });
}

export async function buscarGabinetesFilhos(parentId: string): Promise<Gabinete[]> {
  const q = query(collection(db, colecoes.gabinetes), where("parentGabineteId", "==", parentId), orderBy("criadoEm", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Gabinete));
}

export async function buscarEleitoresPorGabinetes(gabineteIds: string[]): Promise<Eleitor[]> {
  if (gabineteIds.length === 0) return [];
  // Firestore limita `in` a 30 itens — processar em chunks paralelos
  const chunks: string[][] = [];
  for (let i = 0; i < gabineteIds.length; i += 30) chunks.push(gabineteIds.slice(i, i + 30));
  const snaps = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(db, colecoes.eleitores), where("campanhaId", "in", chunk), orderBy("criadoEm", "desc")))
    )
  );
  return snaps.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor)));
}

export async function atualizarMetaPadraoEquipe(coordenadorId: string, meta: number) {
  await updateDoc(doc(db, colecoes.usuarios, coordenadorId), { metaPadraoEquipe: meta });
}

export async function buscarAtividades(limite = 50, gabineteId?: string) {
  // sem escopo explícito = incompatível com rules (retornaria PERMISSION_DENIED)
  if (!gabineteId) return [];
  const q = query(
    collection(db, colecoes.atividades),
    where("gabineteId", "==", gabineteId),
    orderBy("criadoEm", "desc"),
    limit(limite)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Atividade));
}

export async function contarEleitores(gabineteId?: string, colaboradorId?: string): Promise<number> {
  const constraints: any[] = [];
  if (gabineteId) constraints.push(where("campanhaId", "==", gabineteId));
  if (colaboradorId) constraints.push(where("colaboradorId", "==", colaboradorId));
  const q = query(collection(db, colecoes.eleitores), ...constraints);
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}

export async function buscarEleitoresPorPeriodo(inicio: Date, fim: Date, gabineteId?: string, colaboradorId?: string) {
  const constraints: any[] = [];
  if (gabineteId) constraints.push(where("campanhaId", "==", gabineteId));
  if (colaboradorId) constraints.push(where("colaboradorId", "==", colaboradorId));
  constraints.push(where("criadoEm", ">=", Timestamp.fromDate(inicio)));
  constraints.push(where("criadoEm", "<=", Timestamp.fromDate(fim)));
  constraints.push(orderBy("criadoEm", "desc"));
  const q = query(collection(db, colecoes.eleitores), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Eleitor));
}

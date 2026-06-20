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
import { Eleitor, Atividade, Gabinete, Candidato, MemoriaMandato } from "@/types";

const colecoes = {
  eleitores: "eleitores",
  usuarios: "usuarios",
  atividades: "atividades",
  metas: "metas",
  gabinetes: "campanhas",
  candidatos: "candidatos",
  memoriaMandato: "memoriaMandato",
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

export async function buscarEleitores(gabineteId?: string, colaboradorId?: string, max = 1000) {
  const constraints: any[] = [];
  if (gabineteId) constraints.push(where("campanhaId", "==", gabineteId));
  if (colaboradorId) constraints.push(where("colaboradorId", "==", colaboradorId));
  constraints.push(orderBy("criadoEm", "desc"));
  constraints.push(limit(max));
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

// ─── memoriaMandato ───────────────────────────────────────────────────────────
// Schema: { campanhaId, tipo, titulo, descricao, prioridade, status,
//           cidade?, classificacao?, motivo?, resultado?, impacto?,
//           responsavelId?, responsavelNome?, origem?, tags?,
//           criadoEm (serverTimestamp), atualizadoEm?, resolvidoEm? }
// Índice necessário para buscarMemoriasMandato: campanhaId ASC + criadoEm DESC

export async function criarMemoriaMandato(
  data: Omit<MemoriaMandato, "id" | "criadoEm" | "atualizadoEm" | "resolvidoEm">
): Promise<string> {
  const ref = await addDoc(collection(db, colecoes.memoriaMandato), {
    ...data,
    criadoEm: serverTimestamp(),
  });
  return ref.id;
}

export async function buscarMemoriasMandato(
  campanhaId: string,
  filtros?: {
    tipo?: MemoriaMandato["tipo"];
    status?: MemoriaMandato["status"];
    cidade?: string;
    limite?: number;
  }
): Promise<MemoriaMandato[]> {
  // Sem orderBy no servidor — evita dependência de índice composto não implantado.
  // A ordenação é feita client-side após a query simples por campanhaId.
  const snap = await getDocs(query(
    collection(db, colecoes.memoriaMandato),
    where("campanhaId", "==", campanhaId)
  ));
  let resultado = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MemoriaMandato));
  // Ordenar por criadoEm desc client-side
  resultado.sort((a, b) => {
    const ta = (a.criadoEm as any)?.toMillis?.() ?? new Date(a.criadoEm as any).getTime() ?? 0;
    const tb = (b.criadoEm as any)?.toMillis?.() ?? new Date(b.criadoEm as any).getTime() ?? 0;
    return tb - ta;
  });
  if (filtros?.tipo) resultado = resultado.filter((m) => m.tipo === filtros.tipo);
  if (filtros?.status) resultado = resultado.filter((m) => m.status === filtros.status);
  if (filtros?.cidade) resultado = resultado.filter((m) => m.cidade === filtros.cidade);
  if (filtros?.limite) resultado = resultado.slice(0, filtros.limite);
  return resultado;
}

export async function atualizarMemoriaMandato(
  id: string,
  data: Partial<Omit<MemoriaMandato, "id" | "campanhaId" | "criadoEm">>
): Promise<void> {
  await updateDoc(doc(db, colecoes.memoriaMandato, id), {
    ...data,
    atualizadoEm: serverTimestamp(),
  });
}

// ─── Memória automática (gatilhos) ───────────────────────────────────────────
// Wrapper não-crítico: nunca lança exceção — falha silenciosa é intencional.

export async function registrarMemoriaAutomatica(
  data: Omit<MemoriaMandato, "id" | "criadoEm" | "atualizadoEm" | "resolvidoEm">
): Promise<void> {
  if (!data.campanhaId) return; // sem campanha, sem registro — evita documento órfão
  try {
    await criarMemoriaMandato({
      ...data,
      origem: "auto",
      tags: ["auto", ...(data.tags || [])],
    });
  } catch {
    // não-crítico: memória automática falhou silenciosamente
  }
}

// Gatilho 3 — pendência concluída (aguarda wiring ao modal do dashboard)
export async function registrarPendenciaConcluida(params: {
  campanhaId: string;
  titulo: string;
  descricao: string;
  cidade?: string;
  resultado?: string;
  responsavelId?: string;
  responsavelNome?: string;
}): Promise<void> {
  return registrarMemoriaAutomatica({
    campanhaId: params.campanhaId,
    tipo: "pendencia",
    titulo: `Pendência resolvida: ${params.titulo}`,
    descricao: params.descricao,
    prioridade: "media",
    status: "concluido",
    ...(params.cidade && { cidade: params.cidade }),
    ...(params.resultado && { resultado: params.resultado }),
    ...(params.responsavelId && { responsavelId: params.responsavelId }),
    ...(params.responsavelNome && { responsavelNome: params.responsavelNome }),
  });
}

// Gatilho 5 — alerta resolvido (aguarda wiring ao modal do dashboard)
export async function registrarAlertaResolvido(params: {
  campanhaId: string;
  titulo: string;
  descricao: string;
  cidade?: string;
  responsavelId?: string;
  responsavelNome?: string;
}): Promise<void> {
  return registrarMemoriaAutomatica({
    campanhaId: params.campanhaId,
    tipo: "alerta",
    titulo: `Alerta resolvido: ${params.titulo}`,
    descricao: params.descricao,
    prioridade: "media",
    status: "concluido",
    ...(params.cidade && { cidade: params.cidade }),
    ...(params.responsavelId && { responsavelId: params.responsavelId }),
    ...(params.responsavelNome && { responsavelNome: params.responsavelNome }),
  });
}

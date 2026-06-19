import { buscarMemoriasMandato } from "./firestore";
import { MemoriaMandato } from "@/types";

// ── Tipos exportados ──────────────────────────────────────────────────────────

export interface SugestaoEstrategica {
  titulo: string;
  descricao: string;
  baseHistorica: number;
  resultadoMedio: string;
  recomendacao: string;
}

export interface EstrategiaVencedora {
  tipo: MemoriaMandato["tipo"];
  quantidade: number;
  sucessos: number;
  taxaSucesso: number;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const TODOS_TIPOS: MemoriaMandato["tipo"][] = [
  "decisao",
  "pendencia",
  "alerta",
  "conquista",
  "expansao",
];

const LABEL_TIPO: Record<MemoriaMandato["tipo"], string> = {
  decisao:  "Decisões Estratégicas",
  pendencia:"Pendências",
  alerta:   "Alertas",
  conquista:"Conquistas Territoriais",
  expansao: "Expansões Regionais",
};

// ── Helper interno ────────────────────────────────────────────────────────────

function _computarEstrategias(memorias: MemoriaMandato[]): EstrategiaVencedora[] {
  return TODOS_TIPOS
    .map((tipo) => {
      const doTipo = memorias.filter((m) => m.tipo === tipo);
      const sucessos = doTipo.filter((m) => m.status === "concluido").length;
      const quantidade = doTipo.length;
      return {
        tipo,
        quantidade,
        sucessos,
        taxaSucesso: quantidade > 0 ? Math.round((sucessos / quantidade) * 100) : 0,
      };
    })
    .filter((e) => e.quantidade > 0)
    .sort((a, b) => b.taxaSucesso - a.taxaSucesso);
}

// ── buscarMemoriasSemelhantes ─────────────────────────────────────────────────
// Retorna memórias concluídas do mesmo tipo e classificação, ordenadas por
// criadoEm desc (ordem preservada da busca Firestore).

export async function buscarMemoriasSemelhantes(
  campanhaId: string,
  params: {
    tipo: MemoriaMandato["tipo"];
    classificacao?: MemoriaMandato["classificacao"];
    cidade?: string;
  }
): Promise<MemoriaMandato[]> {
  const todas = await buscarMemoriasMandato(campanhaId);
  return todas.filter((m) => {
    if (m.status !== "concluido") return false;
    if (m.tipo !== params.tipo) return false;
    if (params.classificacao && m.classificacao !== params.classificacao) return false;
    if (params.cidade && m.cidade !== params.cidade) return false;
    return true;
  });
}

// ── calcularEstrategiasVencedoras ─────────────────────────────────────────────
// Agrupa todas as memórias por tipo, calcula quantidade, sucessos e taxa de
// sucesso. Retorna apenas tipos com ao menos 1 registro, ordem decrescente de
// taxaSucesso.

export async function calcularEstrategiasVencedoras(
  campanhaId: string
): Promise<EstrategiaVencedora[]> {
  const todas = await buscarMemoriasMandato(campanhaId);
  return _computarEstrategias(todas);
}

// ── gerarSugestaoEstrategica ──────────────────────────────────────────────────
// Analisa o histórico completo (ou escopado por cidade/tipo) e retorna uma
// sugestão acionável baseada nos padrões de maior taxa de sucesso.

export async function gerarSugestaoEstrategica(
  campanhaId: string,
  contexto?: {
    tipo?: MemoriaMandato["tipo"];
    cidade?: string;
  }
): Promise<SugestaoEstrategica> {
  const todas = await buscarMemoriasMandato(campanhaId);
  const estrategias = _computarEstrategias(todas);

  const escopoBase = contexto?.cidade
    ? todas.filter((m) => m.cidade === contexto.cidade)
    : todas;
  const escopo = contexto?.tipo
    ? escopoBase.filter((m) => m.tipo === contexto.tipo)
    : escopoBase;

  const concluidas = escopo.filter((m) => m.status === "concluido");
  const emAberto = escopo.filter((m) => m.status === "aberto").length;
  const baseHistorica = escopo.length;
  const taxaGeral =
    baseHistorica > 0 ? Math.round((concluidas.length / baseHistorica) * 100) : 0;

  const resultadoMedio =
    baseHistorica > 0
      ? `${taxaGeral}% de conclusão em ${baseHistorica} registro${baseHistorica !== 1 ? "s" : ""}`
      : "Dados insuficientes";

  const melhor = estrategias[0];

  let titulo: string;
  let descricao: string;
  let recomendacao: string;

  if (baseHistorica === 0) {
    titulo = "Inicie sua história estratégica";
    descricao =
      "Nenhuma memória registrada ainda. O motor de aprendizado precisa de histórico para gerar sugestões inteligentes.";
    recomendacao =
      "Crie pelo menos 5 registros de decisões, conquistas ou expansões para ativar as sugestões.";
  } else if (melhor && melhor.taxaSucesso >= 70) {
    titulo = `Replicar padrão: ${LABEL_TIPO[melhor.tipo]}`;
    descricao = `Análise de ${baseHistorica} registro${baseHistorica !== 1 ? "s" : ""} indica que "${LABEL_TIPO[melhor.tipo]}" têm ${melhor.taxaSucesso}% de taxa de sucesso — o melhor padrão da campanha.`;
    recomendacao = `Priorize ações do tipo "${LABEL_TIPO[melhor.tipo]}" nas regiões com menor cobertura. Padrão validado em ${melhor.sucessos} case${melhor.sucessos !== 1 ? "s" : ""}.`;
  } else if (contexto?.cidade && concluidas.length > 0) {
    titulo = `Aprendizado territorial: ${contexto.cidade}`;
    descricao = `Em ${contexto.cidade}, ${concluidas.length} de ${baseHistorica} registros foram concluídos com sucesso (${taxaGeral}% de efetividade).`;
    recomendacao = `Replique as estratégias vencedoras de ${contexto.cidade} nos municípios com perfil semelhante.`;
  } else {
    titulo = "Consolidar registros antes de expandir";
    descricao = `${emAberto} registro${emAberto !== 1 ? "s" : ""} em aberto e ${concluidas.length} concluído${concluidas.length !== 1 ? "s" : ""}. Taxa de conclusão atual: ${taxaGeral}%.`;
    recomendacao =
      emAberto > 0
        ? `Resolva os ${emAberto} registro${emAberto !== 1 ? "s" : ""} em aberto para enriquecer a base de aprendizado.`
        : "Continue registrando para acumular histórico e ativar sugestões avançadas.";
  }

  return { titulo, descricao, baseHistorica, resultadoMedio, recomendacao };
}

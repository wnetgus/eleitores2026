export type PendenciaEstrategica = {
  id: string;
  prioridade: number;
  tipo: "critica" | "alta" | "media" | "baixa";
  titulo: string;
  descricao: string;
  territorio: string;
  origem: "Força Territorial" | "Base Eleitoral" | "Inteligência Política" | "Metas";
  destino: string;
  acao: string;
};

const PRIORIDADE_NUM: Record<PendenciaEstrategica["tipo"], number> = {
  critica: 1,
  alta: 2,
  media: 3,
  baixa: 4,
};

export function criarPendencia(params: {
  tipo: PendenciaEstrategica["tipo"];
  titulo: string;
  descricao: string;
  territorio: string;
  origem: PendenciaEstrategica["origem"];
  destino: string;
  acao: string;
}): PendenciaEstrategica {
  return {
    id: `${params.origem}-${params.territorio}-${params.titulo}`,
    prioridade: PRIORIDADE_NUM[params.tipo],
    tipo: params.tipo,
    titulo: params.titulo,
    descricao: params.descricao,
    territorio: params.territorio,
    origem: params.origem,
    destino: params.destino,
    acao: params.acao,
  };
}

export function ordenarPendencias(pendencias: PendenciaEstrategica[]): PendenciaEstrategica[] {
  return [...pendencias].sort((a, b) =>
    a.prioridade !== b.prioridade
      ? a.prioridade - b.prioridade
      : a.territorio.localeCompare(b.territorio)
  );
}

export function agruparPendenciasPorTipo(pendencias: PendenciaEstrategica[]): {
  critica: PendenciaEstrategica[];
  alta: PendenciaEstrategica[];
  media: PendenciaEstrategica[];
  baixa: PendenciaEstrategica[];
} {
  return {
    critica: pendencias.filter((p) => p.tipo === "critica"),
    alta:    pendencias.filter((p) => p.tipo === "alta"),
    media:   pendencias.filter((p) => p.tipo === "media"),
    baixa:   pendencias.filter((p) => p.tipo === "baixa"),
  };
}

export function agruparPendenciasPorOrigem(pendencias: PendenciaEstrategica[]): {
  "Força Territorial": PendenciaEstrategica[];
  "Base Eleitoral": PendenciaEstrategica[];
  "Inteligência Política": PendenciaEstrategica[];
  "Metas": PendenciaEstrategica[];
} {
  return {
    "Força Territorial":    pendencias.filter((p) => p.origem === "Força Territorial"),
    "Base Eleitoral":       pendencias.filter((p) => p.origem === "Base Eleitoral"),
    "Inteligência Política": pendencias.filter((p) => p.origem === "Inteligência Política"),
    "Metas":                pendencias.filter((p) => p.origem === "Metas"),
  };
}

export function contarPendencias(pendencias: PendenciaEstrategica[]): {
  total: number;
  criticas: number;
  altas: number;
  medias: number;
  baixas: number;
} {
  return {
    total:   pendencias.length,
    criticas: pendencias.filter((p) => p.tipo === "critica").length,
    altas:    pendencias.filter((p) => p.tipo === "alta").length,
    medias:   pendencias.filter((p) => p.tipo === "media").length,
    baixas:   pendencias.filter((p) => p.tipo === "baixa").length,
  };
}

export function getResumoPendencias(pendencias: PendenciaEstrategica[]): {
  total: number;
  criticas: number;
  texto: string;
} {
  const { total, criticas } = contarPendencias(pendencias);
  const texto =
    criticas > 0
      ? `${criticas} ${criticas === 1 ? "ação crítica exige" : "ações críticas exigem"} atenção imediata.`
      : total > 0
      ? `${total} ${total === 1 ? "pendência aguarda" : "pendências aguardam"} decisão.`
      : "Nenhuma pendência no momento.";
  return { total, criticas, texto };
}

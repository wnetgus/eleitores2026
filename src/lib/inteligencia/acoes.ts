export type AcaoEstrategica = {
  prioridade: "critica" | "alta" | "media" | "baixa";
  categoria: "expansao" | "estrutura" | "recuperacao" | "crescimento" | "monitoramento";
  titulo: string;
  descricao: string;
  destino: string;
};

const ACOES: Record<string, AcaoEstrategica> = {
  "Sem Cobertura": {
    prioridade: "critica",
    categoria: "expansao",
    titulo: "Designar Assessoria",
    descricao: "Município possui eleitores cadastrados mas não possui assessoria regional.",
    destino: "/assessores",
  },
  "Sem Coordenação": {
    prioridade: "alta",
    categoria: "estrutura",
    titulo: "Criar Coordenação",
    descricao: "Território possui assessoria mas não possui coordenação ativa.",
    destino: "/coordenadores",
  },
  "Em Risco": {
    prioridade: "alta",
    categoria: "recuperacao",
    titulo: "Recuperar Base",
    descricao: "Fortalecer conversão política e coordenação territorial.",
    destino: "/relatorios",
  },
  "Intervenção Necessária": {
    prioridade: "critica",
    categoria: "recuperacao",
    titulo: "Reestruturar Território",
    descricao: "Necessário plano emergencial de recuperação política.",
    destino: "/relatorios",
  },
  "Base Fragilizada": {
    prioridade: "media",
    categoria: "monitoramento",
    titulo: "Monitorar Território",
    descricao: "Acompanhar evolução da base e reforçar conversão.",
    destino: "/eleitores",
  },
  "Crescimento Forte": {
    prioridade: "baixa",
    categoria: "crescimento",
    titulo: "Expandir Operação",
    descricao: "Território em crescimento consistente.",
    destino: "/metas",
  },
  "Domínio Consolidado": {
    prioridade: "baixa",
    categoria: "crescimento",
    titulo: "Escalar Estratégia",
    descricao: "Expandir influência e ampliar cobertura.",
    destino: "/metas",
  },
};

const ACAO_DEFAULT: AcaoEstrategica = {
  prioridade: "media",
  categoria: "monitoramento",
  titulo: "Monitorar Território",
  descricao: "Acompanhar evolução da situação territorial.",
  destino: "/relatorios",
};

export function getAcaoPorSituacao(situacao: string): AcaoEstrategica {
  return ACOES[situacao] ?? ACAO_DEFAULT;
}

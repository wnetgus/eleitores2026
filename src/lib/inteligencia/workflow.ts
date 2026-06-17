export type WorkflowStatus =
  | "detectada"
  | "em_andamento"
  | "assessor_designado"
  | "coordenacao_criada"
  | "estrutura_ativa"
  | "concluida"
  | "cancelada";

export type WorkflowItem = {
  id: string;
  status: WorkflowStatus;
  titulo: string;
  territorio: string;
  responsavel: string;
  prazoDias: number;
  criadoEm: Date;
  atualizadoEm: Date;
  proximaEtapa?: string;
};

const LABELS: Record<WorkflowStatus, string> = {
  detectada:           "Detectada",
  em_andamento:        "Em andamento",
  assessor_designado:  "Assessor designado",
  coordenacao_criada:  "Coordenação criada",
  estrutura_ativa:     "Estrutura ativa",
  concluida:           "Concluída",
  cancelada:           "Cancelada",
};

const CORES: Record<WorkflowStatus, string> = {
  detectada:           "red",
  em_andamento:        "amber",
  assessor_designado:  "blue",
  coordenacao_criada:  "cyan",
  estrutura_ativa:     "emerald",
  concluida:           "emerald",
  cancelada:           "zinc",
};

const PROXIMA_ETAPA: Partial<Record<WorkflowStatus, string>> = {
  detectada:          "Designar Assessoria",
  em_andamento:       "Formalizar Assessoria",
  assessor_designado: "Criar Coordenação",
  coordenacao_criada: "Montar Equipe",
  estrutura_ativa:    "Expandir Operação",
};

const FLUXO: WorkflowStatus[] = [
  "detectada",
  "em_andamento",
  "assessor_designado",
  "coordenacao_criada",
  "estrutura_ativa",
  "concluida",
];

export function getWorkflowLabel(status: WorkflowStatus): string {
  return LABELS[status];
}

export function getWorkflowCor(status: WorkflowStatus): string {
  return CORES[status];
}

export function getPrazoRestante(criadoEm: Date, prazoDias: number): {
  diasRestantes: number;
  atrasado: boolean;
} {
  const decorridos = Math.floor((Date.now() - criadoEm.getTime()) / 86_400_000);
  const diasRestantes = prazoDias - decorridos;
  return { diasRestantes, atrasado: diasRestantes < 0 };
}

export function podeAvancar(status: WorkflowStatus): boolean {
  return FLUXO.indexOf(status) !== -1 && status !== "concluida" && status !== "cancelada";
}

export function getProximaEtapa(status: WorkflowStatus): string | undefined {
  return PROXIMA_ETAPA[status];
}

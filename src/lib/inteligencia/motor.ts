import { criarPendencia, ordenarPendencias, PendenciaEstrategica } from "./pendencias";

// ── Tipos de entrada ──────────────────────────────────────────────────────────

export type TerritorioPolitico = {
  cidade: string;
  eleitores: number;
  fortes: number;
  medios: number;
  indecisos: number;
  fracos: number;
  crescimento30d: number;
  possuiAssessoria: boolean;
  possuiCoordenacao: boolean;
  assessorResponsavel: string;
  // Campos opcionais para regras avançadas (Sprint 11)
  diasSemNovoCadastro?: number;   // dias sem novo eleitor registrado
  colaboradoresCount?: number;     // total de colaboradores ativos no território
  novosEleitores30d?: number;      // novos eleitores cadastrados nos últimos 30 dias
};

// ── Tipos de saída (estruturalmente compatíveis com os componentes politico/) ──

export type MotorAlerta = {
  tipo: "critico" | "oportunidade" | "sucesso" | "atencao";
  titulo: string;
  descricao: string;
  cidade: string;
  responsavel: string;
  tempo: string;
  acao: string;
};

export type MotorAgenda = {
  cidade: string;
  titulo: string;
  descricao: string;
  responsavel: string;
  prioridade: "critica" | "alta" | "normal";
  status: "hoje" | "esta_semana" | "concluida";
};

export type MotorDecisao = {
  cidade: string;
  titulo: string;
  descricao: string;
  responsavel: string;
  criadoEm: string;
  prazoDias: number;
  status: "planejada" | "em_andamento" | "atrasada" | "concluida";
  historico: string[];
};

export type MotorEvento = {
  data: string;
  cidade: string;
  titulo: string;
  descricao: string;
  responsavel: string;
  tipo: "expansao" | "estrutura" | "recuperacao" | "meta";
};

// ── Resultado agregado ────────────────────────────────────────────────────────

export interface MotorResultado {
  pendencias: PendenciaEstrategica[];
  alertas: MotorAlerta[];
  agenda: MotorAgenda[];
  decisoes: MotorDecisao[];
  memoria: MotorEvento[];
}

// ── Utilitário interno ────────────────────────────────────────────────────────

function dataHoje(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// ── Motor central ─────────────────────────────────────────────────────────────

export function executarMotorTerritorial(territorios: TerritorioPolitico[]): MotorResultado {
  const pendencias: PendenciaEstrategica[] = [];
  const alertas: MotorAlerta[] = [];
  const agenda: MotorAgenda[] = [];
  const decisoes: MotorDecisao[] = [];
  const memoria: MotorEvento[] = [];
  const hoje = dataHoje();

  const totalCampanha = territorios.reduce((s, t) => s + t.eleitores, 0);

  // REGRA 6 — dependência crítica: assessor com >60% dos eleitores da campanha
  if (totalCampanha > 0) {
    const porAssessor: Record<string, number> = {};
    for (const t of territorios) {
      const a = t.assessorResponsavel || "indefinido";
      porAssessor[a] = (porAssessor[a] || 0) + t.eleitores;
    }
    for (const [assessor, qtd] of Object.entries(porAssessor)) {
      if (qtd / totalCampanha > 0.6) {
        const pct = Math.round((qtd / totalCampanha) * 100);
        pendencias.push(criarPendencia({
          tipo: "alta",
          titulo: "Dependência Crítica de Assessor",
          descricao: `${assessor} concentra ${pct}% dos eleitores da campanha — risco alto se o assessor sair ou perder desempenho.`,
          territorio: "Campanha",
          origem: "Inteligência Política",
          destino: "/assessores",
          acao: "Redistribuir territórios",
        }));
        alertas.push({
          tipo: "atencao",
          titulo: `Concentração Crítica: ${assessor}`,
          descricao: `${pct}% dos eleitores sob único responsável. Distribua territórios para reduzir risco.`,
          cidade: "Campanha",
          responsavel: assessor,
          tempo: "Esta semana",
          acao: "Redistribuir territórios",
        });
      }
    }
  }

  for (const t of territorios) {
    const resp = t.assessorResponsavel || "A definir";

    // REGRA 1 — sem assessoria com eleitores cadastrados
    if (!t.possuiAssessoria && t.eleitores > 0) {
      pendencias.push(criarPendencia({
        tipo: "critica",
        titulo: "Designar Assessoria",
        descricao: `${t.cidade} possui ${t.eleitores} eleitores mas não possui assessoria regional.`,
        territorio: t.cidade,
        origem: "Força Territorial",
        destino: "/assessores",
        acao: "Designar Assessoria",
      }));
      agenda.push({
        cidade: t.cidade,
        titulo: "Designar Assessoria Regional",
        descricao: `Município com ${t.eleitores} apoiadores sem cobertura territorial.`,
        responsavel: resp,
        prioridade: "critica",
        status: "hoje",
      });
      decisoes.push({
        cidade: t.cidade,
        titulo: "Criação de Assessoria Regional",
        descricao: `Decisão estratégica para cobrir ${t.cidade} com estrutura assessorial.`,
        responsavel: resp,
        criadoEm: hoje,
        prazoDias: 15,
        status: "planejada",
        historico: ["Pendência detectada automaticamente pelo motor estratégico."],
      });
      memoria.push({
        data: hoje,
        cidade: t.cidade,
        titulo: "Território sem Assessoria Detectado",
        descricao: `${t.cidade} identificada como território descoberto com ${t.eleitores} eleitores registrados.`,
        responsavel: resp,
        tipo: "expansao",
      });
    }

    // REGRA 2 — assessoria presente, sem coordenação
    if (t.possuiAssessoria && !t.possuiCoordenacao) {
      pendencias.push(criarPendencia({
        tipo: "media",
        titulo: "Criar Coordenação",
        descricao: `${t.cidade} possui assessoria mas não possui coordenação territorial ativa.`,
        territorio: t.cidade,
        origem: "Força Territorial",
        destino: "/coordenadores",
        acao: "Criar Coordenação",
      }));
      agenda.push({
        cidade: t.cidade,
        titulo: "Criar Coordenação Territorial",
        descricao: `Assessoria presente em ${t.cidade} sem estrutura de coordenação.`,
        responsavel: resp,
        prioridade: "normal",
        status: "esta_semana",
      });
      decisoes.push({
        cidade: t.cidade,
        titulo: "Estruturação da Coordenação Local",
        descricao: `Decisão para criar coordenação territorial em ${t.cidade}.`,
        responsavel: resp,
        criadoEm: hoje,
        prazoDias: 30,
        status: "planejada",
        historico: ["Município com assessoria mas sem coordenação detectado pelo motor."],
      });
      memoria.push({
        data: hoje,
        cidade: t.cidade,
        titulo: "Estrutura Parcial Identificada",
        descricao: `${t.cidade} com assessoria ativa mas sem coordenação territorial definida.`,
        responsavel: resp,
        tipo: "estrutura",
      });
    }

    // REGRA 3 — base forte abaixo de 10%
    if (t.eleitores > 0 && t.fortes / t.eleitores < 0.10) {
      const pct = Math.round((t.fortes / t.eleitores) * 100);
      pendencias.push(criarPendencia({
        tipo: "alta",
        titulo: "Recuperar Base",
        descricao: `Base forte de ${t.cidade} está em ${pct}% — abaixo do mínimo de 10%.`,
        territorio: t.cidade,
        origem: "Base Eleitoral",
        destino: "/relatorios",
        acao: "Recuperar Base",
      }));
      agenda.push({
        cidade: t.cidade,
        titulo: "Recuperação de Base Eleitoral",
        descricao: `Base forte em ${pct}% — intervenção necessária em ${t.cidade}.`,
        responsavel: resp,
        prioridade: "alta",
        status: "esta_semana",
      });
      decisoes.push({
        cidade: t.cidade,
        titulo: "Plano de Recuperação de Base",
        descricao: `Recuperar base forte em ${t.cidade} de ${pct}% para 15%+.`,
        responsavel: resp,
        criadoEm: hoje,
        prazoDias: 60,
        status: "planejada",
        historico: [
          "Base fraca detectada pelo motor estratégico.",
          `${t.indecisos} indecisos identificados para conversão.`,
        ],
      });
      memoria.push({
        data: hoje,
        cidade: t.cidade,
        titulo: "Base em Risco Identificada",
        descricao: `Força política de ${t.cidade} em ${pct}%. Intervenção prioritária necessária.`,
        responsavel: resp,
        tipo: "recuperacao",
      });
    }

    // REGRA 4 — crescimento acelerado (oportunidade)
    if (t.crescimento30d > 100) {
      alertas.push({
        tipo: "oportunidade",
        titulo: `Expansão Acelerada em ${t.cidade}`,
        descricao: `Crescimento de ${t.crescimento30d}% em 30 dias — momento ideal para ampliar estrutura.`,
        cidade: t.cidade,
        responsavel: resp,
        tempo: "Agora",
        acao: "Expandir estrutura",
      });
    }

    // REGRA 5 — retração (atenção)
    if (t.crescimento30d < -20) {
      alertas.push({
        tipo: "atencao",
        titulo: `Retração Detectada em ${t.cidade}`,
        descricao: `Queda de ${Math.abs(t.crescimento30d)}% em 30 dias — ação preventiva recomendada.`,
        cidade: t.cidade,
        responsavel: resp,
        tempo: "Urgente",
        acao: "Investigar retração",
      });
    }

    // REGRA 7 — abandono silencioso (município sem novo cadastro em 45+ dias)
    if (t.eleitores > 0 && t.diasSemNovoCadastro !== undefined && t.diasSemNovoCadastro > 45) {
      pendencias.push(criarPendencia({
        tipo: "alta",
        titulo: "Território em Abandono",
        descricao: `${t.cidade} não recebe novos cadastros há ${t.diasSemNovoCadastro} dias. Base existente sem expansão.`,
        territorio: t.cidade,
        origem: "Força Territorial",
        destino: "/colaboradores",
        acao: "Reativar mobilização",
      }));
      alertas.push({
        tipo: "atencao",
        titulo: `Abandono Silencioso: ${t.cidade}`,
        descricao: `${t.diasSemNovoCadastro} dias sem nenhum cadastro novo. Equipe pode estar inativa.`,
        cidade: t.cidade,
        responsavel: resp,
        tempo: `${t.diasSemNovoCadastro}d sem cadastro`,
        acao: "Reativar mobilização",
      });
    }

    // REGRA 8 — equipe improdutiva (3+ colaboradores, 0 novos eleitores em 30 dias)
    if (
      t.colaboradoresCount !== undefined &&
      t.novosEleitores30d !== undefined &&
      t.colaboradoresCount >= 3 &&
      t.novosEleitores30d === 0
    ) {
      pendencias.push(criarPendencia({
        tipo: "alta",
        titulo: "Equipe Improdutiva",
        descricao: `${t.cidade} tem ${t.colaboradoresCount} colaboradores mas nenhum cadastro nos últimos 30 dias.`,
        territorio: t.cidade,
        origem: "Força Territorial",
        destino: "/colaboradores",
        acao: "Avaliar equipe",
      }));
      agenda.push({
        cidade: t.cidade,
        titulo: "Avaliar Produtividade da Equipe",
        descricao: `${t.colaboradoresCount} colaboradores sem produção em 30 dias. Investigar motivo.`,
        responsavel: resp,
        prioridade: "alta",
        status: "esta_semana",
      });
    }

    // REGRA 9 — município descoberto sem eleitores (expansão potencial)
    if (!t.possuiAssessoria && t.eleitores === 0) {
      alertas.push({
        tipo: "oportunidade",
        titulo: `Território Inexplorado: ${t.cidade}`,
        descricao: `Município sem cobertura e sem eleitores. Avalie potencial de expansão.`,
        cidade: t.cidade,
        responsavel: "Sem responsável",
        tempo: "Planejamento",
        acao: "Analisar expansão",
      });
    }
  }

  return {
    pendencias: ordenarPendencias(pendencias),
    alertas,
    agenda,
    decisoes,
    memoria,
  };
}

// ── Helpers puros ─────────────────────────────────────────────────────────────

export function getPendencias(territorios: TerritorioPolitico[]): PendenciaEstrategica[] {
  return executarMotorTerritorial(territorios).pendencias;
}

export function getAlertas(territorios: TerritorioPolitico[]): MotorAlerta[] {
  return executarMotorTerritorial(territorios).alertas;
}

export function getAgenda(territorios: TerritorioPolitico[]): MotorAgenda[] {
  return executarMotorTerritorial(territorios).agenda;
}

export function getDecisoes(territorios: TerritorioPolitico[]): MotorDecisao[] {
  return executarMotorTerritorial(territorios).decisoes;
}

export function getMemoria(territorios: TerritorioPolitico[]): MotorEvento[] {
  return executarMotorTerritorial(territorios).memoria;
}

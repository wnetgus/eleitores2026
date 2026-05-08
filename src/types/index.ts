export type UserRole = "admin" | "coordenador" | "colaborador";

export interface AppUser {
  uid: string;
  email: string;
  nome: string;
  role: UserRole;
  equipe?: string;
  coordenadorId?: string;
  cidadePrincipal?: string;
  regiao?: string;
  criadoEm: Date;
  ativo: boolean;
  criadoPor?: string;
}

export interface Eleitor {
  id?: string;
  nomeCompleto: string;
  telefone: string;
  tituloEleitoral: string;
  estado: string;
  cidade: string;
  bairro: string;
  grauApoio: "forte" | "medio" | "fraco" | "indeciso";
  observacoes: string;
  colaboradorId: string;
  colaboradorNome: string;
  coordenadorId: string;
  coordenadorNome?: string;
  criadoEm: Date;
  atualizadoEm?: Date;
  editadoPor?: string;
  editadoPorNome?: string;
}

export interface Atividade {
  id?: string;
  acao: string;
  usuarioId: string;
  usuarioNome: string;
  usuarioRole: UserRole;
  detalhes: string;
  criadoEm: Date;
}

export interface Meta {
  id?: string;
  colaboradorId: string;
  colaboradorNome: string;
  coordenadorId?: string;
  meta: number;
  periodo: "diario" | "semanal" | "mensal";
  inicio: Date;
  fim: Date;
}

export interface Estado {
  sigla: string;
  nome: string;
}

export interface Cidade {
  nome: string;
  estado: string;
}

export const ROLE_CONFIG = {
  admin: {
    label: "Admin Master",
    color: "from-purple-600 to-purple-800",
    border: "border-purple-500/30",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    badge: "bg-purple-500/20 text-purple-400",
    icon: "👑",
    gradient: "from-purple-500 to-purple-700",
    menuTitle: "Admin",
  },
  coordenador: {
    label: "Coordenador",
    color: "from-blue-600 to-blue-800",
    border: "border-blue-500/30",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    badge: "bg-blue-500/20 text-blue-400",
    icon: "🎯",
    gradient: "from-blue-500 to-blue-700",
    menuTitle: "Coordenador",
  },
  colaborador: {
    label: "Colaborador",
    color: "from-emerald-600 to-emerald-800",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    badge: "bg-emerald-500/20 text-emerald-400",
    icon: "⚡",
    gradient: "from-emerald-500 to-emerald-700",
    menuTitle: "Colaborador",
  },
} as const;

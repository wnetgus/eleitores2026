export type UserRole = "super_admin" | "admin" | "politico" | "coordenador" | "colaborador";

export interface AppUser {
  uid: string;
  email: string;
  nome: string;
  role: UserRole;
  campanhaId?: string;
  campanhaNome?: string;
  equipe?: string;
  coordenadorId?: string;
  cidadePrincipal?: string;
  regiao?: string;
  criadoEm: Date;
  ativo: boolean;
  criadoPor?: string;
}

export interface Campanha {
  id?: string;
  nome: string;
  slug: string;
  politicoNome: string;
  politicoEmail: string;
  cargo: string;
  corPrincipal: string;
  logo?: string;
  slogan?: string;
  ativo: boolean;
  criadoEm: Date;
  criadoPor?: string;
}

export interface Eleitor {
  id?: string;
  campanhaId: string;
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
  campanhaId?: string;
  acao: string;
  usuarioId: string;
  usuarioNome: string;
  usuarioRole: UserRole;
  detalhes: string;
  criadoEm: Date;
}

export interface Meta {
  id?: string;
  campanhaId: string;
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

export const ROLE_CONFIG: Record<string, { label: string; color: string; border: string; bg: string; text: string; badge: string; icon: string; gradient: string; menuTitle: string }> = {
  super_admin: {
    label: "Super Admin",
    color: "from-rose-600 to-rose-800",
    border: "border-rose-500/30",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    badge: "bg-rose-500/20 text-rose-400",
    icon: "🔱",
    gradient: "from-rose-500 to-rose-700",
    menuTitle: "Super Admin",
  },
  admin: {
    label: "Admin",
    color: "from-purple-600 to-purple-800",
    border: "border-purple-500/30",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    badge: "bg-purple-500/20 text-purple-400",
    icon: "👑",
    gradient: "from-purple-500 to-purple-700",
    menuTitle: "Admin",
  },
  politico: {
    label: "Político",
    color: "from-amber-600 to-amber-800",
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    badge: "bg-amber-500/20 text-amber-400",
    icon: "🏛️",
    gradient: "from-amber-500 to-amber-700",
    menuTitle: "Campanha",
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
};

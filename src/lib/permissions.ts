import { AppUser, UserRole } from "@/types";

export function can(user: AppUser | null, ...roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

export function isSuperAdmin(user: AppUser | null): boolean {
  return can(user, "super_admin");
}

export function isAdminMaster(user: AppUser | null): boolean {
  return can(user, "admin_master");
}

export function isPolitico(user: AppUser | null): boolean {
  return can(user, "politico");
}

export function isPrefeito(user: AppUser | null): boolean {
  return can(user, "prefeito");
}

export function isVereador(user: AppUser | null): boolean {
  return can(user, "vereador");
}

export function isAssessor(user: AppUser | null): boolean {
  return can(user, "assessor");
}

export function isCoordenador(user: AppUser | null): boolean {
  return can(user, "coordenador");
}

export function isColaborador(user: AppUser | null): boolean {
  return can(user, "colaborador");
}

export function isPoliticoOuAssessor(user: AppUser | null): boolean {
  return can(user, "politico") || can(user, "prefeito") || can(user, "vereador") || can(user, "assessor");
}

export function isSuperOrMaster(user: AppUser | null): boolean {
  return isSuperAdmin(user) || isAdminMaster(user);
}

export function canManageGabinetes(user: AppUser | null): boolean {
  return isSuperOrMaster(user);
}

export function canManageUsers(user: AppUser | null): boolean {
  return isSuperOrMaster(user) || isAssessor(user);
}

export function canManageColaboradores(user: AppUser | null): boolean {
  return isSuperOrMaster(user) || isAssessor(user) || isCoordenador(user);
}

export function canExportData(user: AppUser | null): boolean {
  return isSuperOrMaster(user) || isAssessor(user) || isPolitico(user) || isPrefeito(user) || isVereador(user) || isCoordenador(user);
}

export function canDeleteRecords(user: AppUser | null): boolean {
  return isSuperOrMaster(user) || isAssessor(user);
}

export function canViewAllRecords(user: AppUser | null): boolean {
  return isSuperOrMaster(user) || isAssessor(user);
}

export function canViewLogs(user: AppUser | null): boolean {
  return isSuperOrMaster(user) || isAssessor(user);
}

import { ROLE_CONFIG } from "@/types";

export function getRoleConfig(user: AppUser | null) {
  if (!user) return ROLE_CONFIG.colaborador;
  return ROLE_CONFIG[user.role] || ROLE_CONFIG.colaborador;
}

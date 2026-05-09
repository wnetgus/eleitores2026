import { AppUser, UserRole } from "@/types";

export function can(user: AppUser | null, ...roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

export function isSuperAdmin(user: AppUser | null): boolean {
  return can(user, "super_admin");
}

export function isAdmin(user: AppUser | null): boolean {
  return can(user, "admin");
}

export function isPolitico(user: AppUser | null): boolean {
  return can(user, "politico");
}

export function isCoordenador(user: AppUser | null): boolean {
  return can(user, "coordenador");
}

export function isColaborador(user: AppUser | null): boolean {
  return can(user, "colaborador");
}

export function canManageUsers(user: AppUser | null): boolean {
  return isSuperAdmin(user) || isAdmin(user) || isPolitico(user);
}

export function canManageColaboradores(user: AppUser | null): boolean {
  return isAdmin(user) || isPolitico(user) || isCoordenador(user);
}

export function canExportData(user: AppUser | null): boolean {
  return isSuperAdmin(user) || isAdmin(user) || isPolitico(user) || isCoordenador(user);
}

export function canDeleteRecords(user: AppUser | null): boolean {
  return isSuperAdmin(user) || isAdmin(user);
}

export function canViewAllRecords(user: AppUser | null): boolean {
  return isSuperAdmin(user) || isAdmin(user);
}

export function canViewLogs(user: AppUser | null): boolean {
  return isSuperAdmin(user) || isAdmin(user);
}

import { ROLE_CONFIG } from "@/types";

export function getRoleConfig(user: AppUser | null) {
  if (!user) return ROLE_CONFIG.colaborador;
  return ROLE_CONFIG[user.role] || ROLE_CONFIG.colaborador;
}

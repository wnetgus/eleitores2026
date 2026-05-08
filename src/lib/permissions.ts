import { AppUser, UserRole, ROLE_CONFIG } from "@/types";

export function can(user: AppUser | null, ...roles: UserRole[]): boolean {
  if (!user) return false;
  const allowed = roles.includes(user.role);
  console.log(`[can] user=${user.email} role=${user.role} ativo=${user.ativo} allowed=${allowed} roles=${roles}`);
  return allowed;
}

export function isAdmin(user: AppUser | null): boolean {
  return can(user, "admin");
}

export function isCoordenador(user: AppUser | null): boolean {
  return can(user, "coordenador");
}

export function isColaborador(user: AppUser | null): boolean {
  return can(user, "colaborador");
}

export function canManageUsers(user: AppUser | null): boolean {
  return isAdmin(user);
}

export function canManageColaboradores(user: AppUser | null): boolean {
  return isAdmin(user) || isCoordenador(user);
}

export function canExportData(user: AppUser | null): boolean {
  return isAdmin(user) || isCoordenador(user);
}

export function canDeleteRecords(user: AppUser | null): boolean {
  return isAdmin(user);
}

export function canViewAllRecords(user: AppUser | null): boolean {
  return isAdmin(user);
}

export function canViewLogs(user: AppUser | null): boolean {
  return isAdmin(user);
}

export function getRoleConfig(user: AppUser | null) {
  if (!user) return ROLE_CONFIG.colaborador;
  return ROLE_CONFIG[user.role];
}

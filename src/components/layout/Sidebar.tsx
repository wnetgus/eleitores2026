"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  Shield,
  Target,
  Zap,
  Crown,
  Flag,
  Activity,
  TrendingUp,
  FileSpreadsheet,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { getRoleConfig, isAdmin, isCoordenador } from "@/lib/permissions";
import { ROLE_CONFIG } from "@/types";

const adminMenu = [
  { href: "/dashboard", label: "Dashboard Global", icon: Crown },
  { href: "/eleitores", label: "Eleitores", icon: Users },
  { href: "/coordenadores", label: "Coordenadores", icon: Target },
  { href: "/colaboradores", label: "Colaboradores", icon: Users },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/exportacoes", label: "Exportações", icon: FileSpreadsheet },
  { href: "/metas", label: "Metas", icon: TrendingUp },
  { href: "/logs", label: "Logs", icon: Activity },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

const coordenadorMenu = [
  { href: "/dashboard", label: "Dashboard Equipe", icon: Target },
  { href: "/eleitores", label: "Eleitores", icon: Users },
  { href: "/colaboradores", label: "Colaboradores", icon: Users },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/metas", label: "Metas", icon: TrendingUp },
];

const colaboradorMenu = [
  { href: "/eleitores", label: "Novo Cadastro", icon: UserPlus },
  { href: "/dashboard", label: "Meus Cadastros", icon: LayoutDashboard },
  { href: "/metas", label: "Minha Meta", icon: Flag },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { userData } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (!userData) {
    console.log("[Sidebar] userData is null");
    return null;
  }

  console.log("[Sidebar] userData.role:", userData.role, "ativo:", userData.ativo);
  console.log("[Sidebar] isAdmin:", isAdmin(userData));

  const config = getRoleConfig(userData);
  const roleInfo = ROLE_CONFIG[userData.role];

  let menuItems;
  if (isAdmin(userData)) menuItems = adminMenu;
  else if (isCoordenador(userData)) menuItems = coordenadorMenu;
  else {
    console.log("[Sidebar] Falling back to colaborador menu - role not admin/coordenador");
    menuItems = colaboradorMenu;
  }

  return (
    <>
      <button
        className={`fixed top-4 z-50 lg:hidden bg-white/10 backdrop-blur-xl p-2.5 rounded-xl border border-white/10 ${collapsed ? "left-4" : "left-4"}`}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <Menu size={20} className="text-white" />
      </button>

      <aside
        className={`fixed top-0 left-0 z-40 h-full bg-black/40 backdrop-blur-2xl border-r border-white/[0.06] 
          transition-all duration-300 flex flex-col
          ${collapsed ? "w-[72px]" : "w-[260px]"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className={`flex items-center px-5 h-16 border-b border-white/[0.06] ${collapsed ? "justify-center" : ""}`}>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${roleInfo.gradient} flex items-center justify-center`}>
                <Shield size={16} className="text-white" />
              </div>
              <div>
                <span className="text-white font-bold text-lg">Eleitores 2026</span>
                <span className={`text-[10px] block ${roleInfo.text}`}>{roleInfo.label}</span>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex ml-auto text-white/40 hover:text-white transition-colors"
          >
            <ChevronLeft size={18} className={`transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                  ${isActive
                    ? `${roleInfo.bg} ${roleInfo.text} ${roleInfo.border}`
                    : "text-white/50 hover:text-white hover:bg-white/5"
                  }
                  ${collapsed ? "justify-center" : ""}`}
              >
                <Icon size={20} />
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={`p-3 border-t border-white/[0.06] ${collapsed ? "text-center" : ""}`}>
          {!collapsed && (
            <div className="px-3 py-2 mb-2 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${roleInfo.gradient} flex items-center justify-center text-sm`}>
                {roleInfo.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/90 font-medium truncate">{userData.nome}</p>
                <p className={`text-xs ${roleInfo.text} capitalize`}>{roleInfo.label}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all
              ${collapsed ? "justify-center" : ""}`}
          >
            <LogOut size={20} />
            {!collapsed && <span className="text-sm font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
    </>
  );
}

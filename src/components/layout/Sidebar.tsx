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
  Globe,
  Building2,
  Star,
  Eye,
  Map,
  Clock,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { isSuperAdmin, isAdminMaster, isPolitico, isPrefeito, isVereador, isAssessor, isCoordenador, isColaborador, getRoleConfig } from "@/lib/permissions";
import { ROLE_CONFIG } from "@/types";

const superAdminMenu = [
  { href: "/dashboard", label: "Painel Global", icon: Globe },
  { href: "/mapa-politico", label: "Mapa Político", icon: Map },
  { href: "/campanhas", label: "Gabinetes", icon: Building2 },
  { href: "/admins", label: "Admin Masters", icon: Shield },
  { href: "/solicitacoes", label: "Solicitações", icon: Clock },
  { href: "/assessores", label: "Assessores", icon: Shield },
  { href: "/coordenadores", label: "Coordenadores", icon: Target },
  { href: "/colaboradores", label: "Colaboradores", icon: Users },
  { href: "/eleitores", label: "Eleitores", icon: Users },
  { href: "/candidatos", label: "Candidatos", icon: Star },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/exportacoes", label: "Exportações", icon: FileSpreadsheet },
  { href: "/metas", label: "Metas", icon: TrendingUp },
  { href: "/logs", label: "Logs", icon: Activity },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

const politicoMenu = [
  { href: "/dashboard", label: "Meu Mandato", icon: Crown },
  { href: "/mapa-politico", label: "Mapa Político", icon: Map },
  { href: "/assessores", label: "Assessores", icon: Shield },
  { href: "/coordenadores", label: "Coordenadores", icon: Target },
  { href: "/colaboradores", label: "Colaboradores", icon: Users },
  { href: "/eleitores", label: "Eleitores", icon: Users },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/exportacoes", label: "Exportações", icon: FileSpreadsheet },
  { href: "/metas", label: "Metas", icon: TrendingUp },
];

const prefeitoMenu = [
  { href: "/dashboard", label: "Meu Município", icon: Crown },
  { href: "/mapa-politico", label: "Mapa Político", icon: Map },
  { href: "/coordenadores", label: "Coordenadores", icon: Target },
  { href: "/colaboradores", label: "Colaboradores", icon: Users },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/exportacoes", label: "Exportações", icon: FileSpreadsheet },
  { href: "/metas", label: "Metas", icon: TrendingUp },
];

const vereadorMenu = [
  { href: "/dashboard", label: "Meu Mandato", icon: Crown },
  { href: "/mapa-politico", label: "Mapa Político", icon: Map },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/exportacoes", label: "Exportações", icon: FileSpreadsheet },
  { href: "/metas", label: "Metas", icon: TrendingUp },
];

const assessorMenu = [
  { href: "/dashboard", label: "Dashboard", icon: Crown },
  { href: "/mapa-politico", label: "Mapa Político", icon: Map },
  { href: "/solicitacoes", label: "Solicitações", icon: Clock },
  { href: "/assessores", label: "Assessores", icon: Shield },
  { href: "/coordenadores", label: "Coordenadores", icon: Target },
  { href: "/colaboradores", label: "Colaboradores", icon: Users },
  { href: "/eleitores", label: "Eleitores", icon: Users },
  { href: "/candidatos", label: "Candidatos", icon: Star },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/exportacoes", label: "Exportações", icon: FileSpreadsheet },
  { href: "/metas", label: "Metas", icon: TrendingUp },
];

const coordenadorMenu = [
  { href: "/dashboard", label: "Dashboard", icon: Target },
  { href: "/colaboradores", label: "Colaboradores", icon: Users },
  { href: "/eleitores", label: "Eleitores", icon: Users },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/exportacoes", label: "Exportações", icon: FileSpreadsheet },
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
  const [pendentesCount, setPendentesCount] = useState(0);
  const pathname = usePathname();
  const { userData } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function loadPendentes() {
      try {
        const q = query(collection(db, "usuarios"), where("role", "==", "colaborador"), where("status", "in", ["pendente"]));
        const snap = await getDocs(q);
        setPendentesCount(snap.size);
      } catch {}
    }
    if (userData && (isSuperAdmin(userData) || isAdminMaster(userData) || isAssessor(userData))) {
      loadPendentes();
    }
  }, [userData]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (!userData) return null;

  const roleInfo = ROLE_CONFIG[userData.role] || ROLE_CONFIG.colaborador;

  let menuItems;
  const isAdmin = isSuperAdmin(userData) || isAdminMaster(userData);
  const isPoliticoRole = isPolitico(userData) || isPrefeito(userData) || isVereador(userData);

  if (isAdmin) menuItems = superAdminMenu;
  else if (isPolitico(userData)) menuItems = politicoMenu;
  else if (isPrefeito(userData)) menuItems = prefeitoMenu;
  else if (isVereador(userData)) menuItems = vereadorMenu;
  else if (isAssessor(userData)) menuItems = assessorMenu;
  else if (isCoordenador(userData)) menuItems = coordenadorMenu;
  else menuItems = colaboradorMenu;

  return (
    <>
      <button
        className="fixed top-4 z-50 lg:hidden bg-white/10 backdrop-blur-xl p-2.5 rounded-xl border border-white/10 left-4"
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
                {!collapsed && (
                  <span className="text-sm font-medium flex-1">{item.label}</span>
                )}
                {!collapsed && item.href === "/solicitacoes" && pendentesCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    {pendentesCount}
                  </span>
                )}
              </Link>
            );
          })}
          {isAssessor(userData) && userData?.gabineteId && (
            <Link
              href={`/gabinete/${userData.gabineteId}`}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-white/50 hover:text-white hover:bg-white/5 ${collapsed ? "justify-center" : ""}`}
            >
              <Eye size={20} />
              {!collapsed && <span className="text-sm font-medium">Painel do Gabinete</span>}
            </Link>
          )}
        </nav>

        <div className={`p-3 border-t border-white/[0.06] ${collapsed ? "text-center" : ""}`}>
          {!collapsed && (
            <div className="px-3 py-2 mb-1 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${roleInfo.gradient} flex items-center justify-center text-sm`}>
                {roleInfo.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/90 font-medium truncate">{userData.nome}</p>
                <p className={`text-[10px] ${roleInfo.text} uppercase tracking-wider`}>Operador • {roleInfo.label}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all ${collapsed ? "justify-center" : ""}`}
          >
            <LogOut size={20} />
            {!collapsed && <span className="text-sm font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />}
    </>
  );
}

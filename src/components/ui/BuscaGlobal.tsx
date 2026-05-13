"use client";

import { useEffect, useState, useRef } from "react";
import { collection, getDocs, query as fbQuery, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppUser, Gabinete } from "@/types";
import { isSuperOrMaster, isAssessor, isCoordenador, isColaborador } from "@/lib/permissions";
import { Search, X, Users, Building2, Shield, Target, Zap, Mail, MapPin } from "lucide-react";
import React from "react";

type Resultado =
  | { tipo: "colaborador"; item: AppUser; contexto: string }
  | { tipo: "coordenador"; item: AppUser; contexto: string }
  | { tipo: "assessor"; item: AppUser; contexto: string }
  | { tipo: "gabinete"; item: Gabinete };

const roleLabel: Record<string, string> = {
  colaborador: "Colaborador",
  coordenador: "Coordenador",
  assessor: "Assessor",
  politico: "Político",
  prefeito: "Prefeito",
  vereador: "Vereador",
};

const roleColor: Record<string, string> = {
  colaborador: "text-emerald-400",
  coordenador: "text-blue-400",
  assessor: "text-purple-400",
  politico: "text-rose-400",
  prefeito: "text-emerald-400",
  vereador: "text-amber-400",
};

const roleBg: Record<string, string> = {
  colaborador: "bg-emerald-500/10 border-emerald-500/20",
  coordenador: "bg-blue-500/10 border-blue-500/20",
  assessor: "bg-purple-500/10 border-purple-500/20",
  politico: "bg-rose-500/10 border-rose-500/20",
  prefeito: "bg-emerald-500/10 border-emerald-500/20",
  vereador: "bg-amber-500/10 border-amber-500/20",
};

function getSearchPlaceholder(role: string): string {
  if (["super_admin", "admin_master"].includes(role)) return "Buscar pessoa, gabinete ou cidade...";
  if (["assessor", "politico", "prefeito", "vereador"].includes(role)) return "Buscar coordenador, colaborador ou eleitor...";
  if (role === "coordenador") return "Buscar colaborador ou eleitor...";
  return "Buscar...";
}

function filtrarPorRole(usuarios: AppUser[], gabinetes: Gabinete[], role: string, userData: AppUser): { usuarios: AppUser[]; gabinetes: Gabinete[] } {
  if (isSuperOrMaster({ uid: "", email: "", nome: "", role, ativo: true } as AppUser)) {
    return { usuarios, gabinetes };
  }

  const campanhaId = userData?.campanhaId || userData?.gabineteId;

  if (isAssessor({ uid: "", email: "", nome: "", role, ativo: true } as AppUser) || ["politico", "prefeito", "vereador"].includes(role)) {
    return {
      usuarios: usuarios.filter((u) => u.campanhaId === campanhaId || u.gabineteId === campanhaId),
      gabinetes: gabinetes.filter((g) => g.id === campanhaId || g.parentGabineteId === campanhaId || g.parentGabineteId === userData?.campanhaId),
    };
  }

  if (isCoordenador({ uid: "", email: "", nome: "", role, ativo: true } as AppUser)) {
    return {
      usuarios: usuarios.filter((u) => u.role === "colaborador" && u.coordenadorId === userData?.uid),
      gabinetes: [],
    };
  }

  return { usuarios: [], gabinetes: [] };
}

interface BuscaProps {
  placeholder?: string;
  userData?: AppUser | null;
}

export function BuscaGlobal({ placeholder, userData }: BuscaProps) {
  const [aberto, setAberto] = useState(false);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [gabinetes, setGabinetes] = useState<Gabinete[]>([]);
  const [gabinetesMap, setGabinetesMap] = useState<Record<string, { nome: string; cargo: string }>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const [uSnap, gSnap] = await Promise.all([
          getDocs(fbQuery(collection(db, "usuarios"), orderBy("criadoEm", "desc"))),
          getDocs(collection(db, "campanhas")),
        ]);
        const us = uSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser));
        const gs = gSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Gabinete));
        setUsuarios(us);
        setGabinetes(gs);
        const map: Record<string, { nome: string; cargo: string }> = {};
        gs.forEach((g) => { if (g.id) map[g.id] = { nome: g.nome, cargo: g.cargo?.replace(/_/g, " ") }; });
        setGabinetesMap(map);
      } catch (e) { console.error(e); }
    }
    load();
  }, []);

  useEffect(() => {
    if (!query.trim() || !userData) { setResultados([]); return; }
    const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const { usuarios: usuariosFiltrados, gabinetes: gabinetesFiltrados } = filtrarPorRole(usuarios, gabinetes, userData.role, userData);
    const res: Resultado[] = [];

    gabinetesFiltrados.forEach((g) => {
      const nome = g.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (nome.includes(q) || g.politicoNome?.toLowerCase().includes(q) || g.politicoPartido?.toLowerCase().includes(q)) {
        res.push({ tipo: "gabinete", item: g });
      }
    });

    usuariosFiltrados.forEach((u) => {
      const nome = u.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!nome.includes(q) && !u.email.toLowerCase().includes(q)) return;
      const gab = u.gabineteId || u.campanhaId;
      const contexto = gab && gabinetesMap[gab] ? `${gabinetesMap[gab].nome} • ${gabinetesMap[gab].cargo}` : "";
      if (u.role === "colaborador") res.push({ tipo: "colaborador", item: u, contexto });
      else if (u.role === "coordenador") res.push({ tipo: "coordenador", item: u, contexto });
      else if (u.role === "assessor") res.push({ tipo: "assessor", item: u, contexto });
    });

    setResultados(res.slice(0, 15));
  }, [query, usuarios, gabinetes, gabinetesMap, userData]);

  useEffect(() => {
    if (aberto) setTimeout(() => inputRef.current?.focus(), 100);
  }, [aberto]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setAberto((v) => !v); }
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const getLink = (r: Resultado): string => {
    if (r.tipo === "gabinete") return `/gabinete/${r.item.id}`;
    return `/${r.tipo === "colaborador" ? "colaboradores" : r.tipo === "coordenador" ? "coordenadores" : "assessores"}`;
  };

  if (!userData) return null;
  if (isColaborador(userData)) return null;
  const ph = placeholder || getSearchPlaceholder(userData.role);

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-all text-sm text-white/40 hover:text-white/60 w-48 lg:w-64"
      >
        <Search size={14} />
        <span className="flex-1 text-left">{ph}</span>
        <kbd className="hidden sm:inline text-[10px] text-white/20 bg-white/[0.04] px-1.5 py-0.5 rounded">⌘K</kbd>
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60" onClick={() => setAberto(false)}>
          <div
            ref={containerRef}
            className="w-full max-w-lg bg-[#1a1a2e] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
              <Search size={16} className="text-white/30 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar colaborador, coordenador, assessor, gabinete..."
                className="flex-1 bg-transparent text-white text-sm placeholder-white/30 outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-white/30 hover:text-white">
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {resultados.length === 0 && query && (
                <p className="text-center text-white/30 text-sm py-8">Nenhum resultado encontrado</p>
              )}
              {resultados.map((r, i) => (
                <a
                  key={`${r.tipo}-${r.tipo === "gabinete" ? r.item.id : (r.item as AppUser).uid}-${i}`}
                  href={getLink(r)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:bg-white/[0.04] ${roleBg[r.tipo === "gabinete" ? "politico" : r.tipo === "colaborador" ? "colaborador" : r.tipo] || "bg-white/[0.02] border-white/[0.06]"}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${roleColor[r.tipo === "gabinete" ? "politico" : r.tipo === "colaborador" ? "colaborador" : r.tipo]}`}
                    style={{ background: r.tipo === "gabinete" ? (r.item as Gabinete).corPrincipal || "#8b5cf6" + "20" : "rgba(255,255,255,0.05)" }}
                  >
                    {r.item.nome?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium truncate">{r.item.nome}</p>
                      <span className={`text-[10px] font-medium ${roleColor[r.tipo === "gabinete" ? "politico" : r.tipo]}`}>
                        {r.tipo === "gabinete" ? "Gabinete" : roleLabel[r.tipo] || r.tipo}
                      </span>
                    </div>
                    {r.tipo === "gabinete" ? (
                      <p className="text-xs text-white/40 truncate">
                        {(r.item as Gabinete).cargo?.replace(/_/g, " ")} {(r.item as Gabinete).politicoPartido ? `• ${(r.item as Gabinete).politicoPartido}` : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-white/40 truncate">
                        {(r as any).contexto || r.item.email}
                      </p>
                    )}
                  </div>
                  {r.tipo !== "gabinete" && (r.item as AppUser).email && (
                    <span className="text-[10px] text-white/20 hidden md:block truncate max-w-[120px]">{(r.item as AppUser).email}</span>
                  )}
                </a>
              ))}
              {!query && (
                <div className="text-center text-white/20 text-xs py-8">
                  Digite para buscar na plataforma
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

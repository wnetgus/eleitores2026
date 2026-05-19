"use client";

import { useState, useMemo } from "react";
import { AppUser, Gabinete } from "@/types";
import { isSuperOrMaster, isAssessor, isCoordenador, isColaborador } from "@/lib/permissions";
import { Search, ChevronDown } from "lucide-react";

type PaginaOp = "eleitores" | "colaboradores" | "coordenadores" | "assessores";

export interface FiltrosOperacionais {
  texto: string;
  coordenadorId?: string;
  colaboradorId?: string;
  assessorId?: string;
  gabineteId?: string;
}

interface Props {
  pagina: PaginaOp;
  userData?: AppUser | null;
  gabinetes?: Gabinete[];
  assessores?: AppUser[];
  coordenadores?: AppUser[];
  colaboradores?: AppUser[];
  onFilter: (filtros: FiltrosOperacionais) => void;
}

interface Nivel {
  chave: keyof FiltrosOperacionais;
  placeholder: string;
  opcoes: { value: string; label: string }[];
}

function getPlaceholder(pagina: PaginaOp): string {
  const map: Record<PaginaOp, string> = {
    eleitores: "Buscar eleitor por nome, cidade...",
    colaboradores: "Buscar colaborador por nome, email...",
    coordenadores: "Buscar coordenador por nome, email...",
    assessores: "Buscar assessor por nome, email...",
  };
  return map[pagina];
}

function roleLabel(role?: string): string {
  const map: Record<string, string> = {
    assessor: "Assessor",
    coordenador: "Coordenador",
    colaborador: "Colaborador",
  };
  return map[role || ""] || "";
}

function nivelLabel(pagina: PaginaOp, chave: string): string {
  if (chave === "gabineteId") return "Gabinete";
  if (chave === "assessorId") return "Assessor";
  if (chave === "coordenadorId") return "Coordenador";
  if (chave === "colaboradorId") return "Colaborador";
  return "";
}

function gerarNiveis(
  pagina: PaginaOp,
  role: string | undefined,
  gabinetes: Gabinete[] | undefined,
  assessores: AppUser[] | undefined,
  coordenadores: AppUser[] | undefined,
  colaboradores: AppUser[] | undefined,
  filtrosAtuais: FiltrosOperacionais
): Nivel[] {
  const niveis: Nivel[] = [];

  const podeVerGabinete = isSuperOrMaster({ uid: "", email: "", nome: "", role: role || "", ativo: true } as AppUser);
  const podeVerAssessor = isSuperOrMaster({ uid: "", email: "", nome: "", role: role || "", ativo: true } as AppUser)
    || ["politico", "prefeito", "vereador"].includes(role || "");
  const podeVerCoordenador = isSuperOrMaster({ uid: "", email: "", nome: "", role: role || "", ativo: true } as AppUser)
    || isAssessor({ uid: "", email: "", nome: "", role: role || "", ativo: true } as AppUser)
    || ["politico", "prefeito", "vereador"].includes(role || "");
  const podeVerColaborador = isSuperOrMaster({ uid: "", email: "", nome: "", role: role || "", ativo: true } as AppUser)
    || isAssessor({ uid: "", email: "", nome: "", role: role || "", ativo: true } as AppUser)
    || isCoordenador({ uid: "", email: "", nome: "", role: role || "", ativo: true } as AppUser)
    || ["politico", "prefeito", "vereador"].includes(role || "");

  const { gabineteId, assessorId, coordenadorId } = filtrosAtuais;

  // Gabinete: assessores page bloqueia cascata até selecionar; coordenadores/colaboradores mostram a lista completa por padrão
  if (podeVerGabinete && (pagina === "assessores" || pagina === "coordenadores" || pagina === "colaboradores")) {
    const ops = (gabinetes || []).map((g) => ({ value: g.id!, label: `${g.nome} (${g.cargo?.replace(/_/g, " ") || ""})` }));
    niveis.push({ chave: "gabineteId", placeholder: "Selecione o gabinete...", opcoes: ops });
    if (pagina === "assessores" && !gabineteId) return niveis;
  }

  if (podeVerAssessor && pagina !== "assessores") {
    let ops: { value: string; label: string }[] = [];
    if (pagina === "coordenadores" || pagina === "colaboradores") {
      if (gabineteId) {
        ops = (assessores || []).filter((a) => (a.gabineteId || a.campanhaId) === gabineteId).map((a) => ({ value: a.uid, label: a.nome }));
      } else if (!podeVerGabinete) {
        // politico/prefeito/vereador: assessores já vêm escopados pela página
        ops = (assessores || []).map((a) => ({ value: a.uid, label: a.nome }));
      }
    } else if (pagina === "eleitores") {
      if (podeVerGabinete && gabineteId) {
        ops = (assessores || []).filter((a) => (a.gabineteId || a.campanhaId) === gabineteId).map((a) => ({ value: a.uid, label: a.nome }));
      } else if (!podeVerGabinete) {
        ops = (assessores || []).map((a) => ({ value: a.uid, label: a.nome }));
      }
    }
    if (ops.length > 0) {
      niveis.push({ chave: "assessorId", placeholder: "Selecione o assessor...", opcoes: ops });
      if (!assessorId) return niveis;
    }
  }

  // Coordenador select não faz sentido na própria página de coordenadores (seria redundante)
  if (podeVerCoordenador && pagina !== "coordenadores") {
    let ops: { value: string; label: string }[] = [];
    if (assessorId) {
      ops = (coordenadores || []).filter((c) => c.assessorId === assessorId || c.criadoPor === assessorId).map((c) => ({ value: c.uid, label: c.nome }));
    } else if (gabineteId) {
      ops = (coordenadores || []).filter((c) => (c.gabineteId || c.campanhaId) === gabineteId).map((c) => ({ value: c.uid, label: c.nome }));
    } else if (!podeVerGabinete && !podeVerAssessor) {
      ops = (coordenadores || []).map((c) => ({ value: c.uid, label: c.nome }));
    }
    if (ops.length > 0) {
      niveis.push({ chave: "coordenadorId", placeholder: "Selecione o coordenador...", opcoes: ops });
      if (!coordenadorId && (pagina === "colaboradores" || pagina === "eleitores")) return niveis;
    }
  }

  if (podeVerColaborador && (pagina === "colaboradores" || pagina === "eleitores")) {
    let ops: { value: string; label: string }[] = [];
    if (coordenadorId) {
      ops = (colaboradores || []).filter((c) => c.coordenadorId === coordenadorId).map((c) => ({ value: c.uid, label: c.nome }));
    } else if (assessorId) {
      const myCoordIds = (coordenadores || [])
        .filter((c) => c.assessorId === assessorId || c.criadoPor === assessorId)
        .map((c) => c.uid);
      ops = myCoordIds.length > 0
        ? (colaboradores || []).filter((c) => myCoordIds.includes(c.coordenadorId || "")).map((c) => ({ value: c.uid, label: c.nome }))
        : (colaboradores || []).filter((c) => (c.gabineteId || c.campanhaId) === (assessores?.find((a) => a.uid === assessorId)?.gabineteId)).map((c) => ({ value: c.uid, label: c.nome }));
    } else if (gabineteId) {
      ops = (colaboradores || []).filter((c) => (c.gabineteId || c.campanhaId) === gabineteId).map((c) => ({ value: c.uid, label: c.nome }));
    } else if (!podeVerGabinete && !podeVerAssessor && !podeVerCoordenador) {
      ops = (colaboradores || []).map((c) => ({ value: c.uid, label: c.nome }));
    }
    if (ops.length > 0) {
      niveis.push({ chave: "colaboradorId", placeholder: "Selecione o colaborador...", opcoes: ops });
    }
  }

  return niveis;
}

export function BuscaOperacional({ pagina, userData, gabinetes, assessores, coordenadores, colaboradores, onFilter }: Props) {
  const [texto, setTexto] = useState("");
  const [gabineteId, setGabineteId] = useState("");
  const [assessorId, setAssessorId] = useState("");
  const [coordenadorId, setCoordenadorId] = useState("");
  const [colaboradorId, setColaboradorId] = useState("");

  const filtrosAtuais: FiltrosOperacionais = { texto, gabineteId: gabineteId || undefined, assessorId: assessorId || undefined, coordenadorId: coordenadorId || undefined, colaboradorId: colaboradorId || undefined };

  const niveis = useMemo(
    () => userData ? gerarNiveis(pagina, userData.role, gabinetes, assessores, coordenadores, colaboradores, filtrosAtuais) : [],
    [pagina, userData?.role, gabinetes, assessores, coordenadores, colaboradores, gabineteId, assessorId, coordenadorId]
  );

  if (!userData) return null;

  function emitir(parcial: Partial<FiltrosOperacionais>) {
    const novo = { ...filtrosAtuais, ...parcial };
    onFilter(novo);
  }

  function handleTexto(v: string) {
    setTexto(v);
    emitir({ texto: v });
  }

  function handleNivel(chave: keyof FiltrosOperacionais, valor: string) {
    const reset: Partial<FiltrosOperacionais> = { texto };
    const nivelKeys = ["gabineteId", "assessorId", "coordenadorId", "colaboradorId"];
    const idx = nivelKeys.indexOf(chave);
    for (let i = idx; i < nivelKeys.length; i++) {
      (reset as any)[nivelKeys[i]] = undefined;
    }
    (reset as any)[chave] = valor || undefined;

    if (chave === "gabineteId") { setGabineteId(valor); setAssessorId(""); setCoordenadorId(""); setColaboradorId(""); }
    else if (chave === "assessorId") { setAssessorId(valor); setCoordenadorId(""); setColaboradorId(""); }
    else if (chave === "coordenadorId") { setCoordenadorId(valor); setColaboradorId(""); }
    else if (chave === "colaboradorId") { setColaboradorId(valor); }

    onFilter(reset as FiltrosOperacionais);
  }

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full">
      <div className="relative w-full md:w-72">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        <input
          type="text"
          value={texto}
          onChange={(e) => handleTexto(e.target.value)}
          placeholder={getPlaceholder(pagina)}
          className="w-full pl-10 pr-4 py-[7px] bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 min-w-0">
        {niveis.map((nivel) => (
          <div key={nivel.chave} className="relative w-full sm:w-52">
            <select
              value={filtrosAtuais[nivel.chave] || ""}
              onChange={(e) => handleNivel(nivel.chave, e.target.value)}
              className="w-full px-4 py-[7px] pr-8 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
            >
              <option value="" className="bg-[#0a0a0f] text-white/40">{nivel.placeholder}</option>
              {nivel.opcoes.length === 0 && (
                <option value="" disabled className="bg-[#0a0a0f] text-white/20">Nenhum disponível</option>
              )}
              {nivel.opcoes.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#0a0a0f]">{opt.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Gabinete, Eleitor, AppUser } from "@/types";
import { isSuperOrMaster, isPolitico, isPrefeito, isVereador, isAssessor, getRoleConfig } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { formatDate, parseDate } from "@/lib/utils";
import { calcularSFPSimples, calcularIC } from "@/lib/inteligencia";
import {
  ChevronDown, ChevronRight, Users, Target, Zap, Map as MapIcon,
  Building2, Globe, MapPin, TrendingUp, Mail, Shield, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Minus, BarChart3, ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";

// ─── helpers ──────────────────────────────────────────────────────────────────

function getStatus(ultimaData: any): { label: string; color: string; dot: string } {
  if (!ultimaData) return { label: "Sem dados", color: "text-gray-400", dot: "bg-gray-400" };
  const data = ultimaData?.seconds ? new Date(ultimaData.seconds * 1000) : new Date(ultimaData);
  const dias = (Date.now() - data.getTime()) / (1000 * 60 * 60 * 24);
  if (dias <= 3) return { label: "Ativo",         color: "text-emerald-400", dot: "bg-emerald-400" };
  if (dias <= 7) return { label: "Baixa atividade", color: "text-amber-400", dot: "bg-amber-400" };
  return              { label: "Inativo",          color: "text-red-400",    dot: "bg-red-400" };
}

function calcularCrescimento(el: Eleitor[]): string {
  const agora = Date.now();
  const recentes  = el.filter(e => parseDate(e.criadoEm).getTime() > agora - 7  * 864e5).length;
  const anteriores = el.filter(e => { const t = parseDate(e.criadoEm).getTime(); return t > agora - 14 * 864e5 && t <= agora - 7 * 864e5; }).length;
  if (anteriores === 0) return recentes > 0 ? "+100%" : "0%";
  const pct = Math.round(((recentes - anteriores) / anteriores) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

function CardPessoa({ nome, email, role, contexto }: { nome: string; email?: string; role: string; contexto?: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] text-sm hover:bg-white/[0.04] transition-all">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
        style={{ background: role === "assessor" ? "#7C3AED" : role === "coordenador" ? "#3B82F6" : "#059669" }}>
        {nome.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white/80 text-sm truncate">{nome}</p>
        {contexto && <p className="text-white/30 text-[10px] truncate">{contexto}</p>}
      </div>
      {email && <span className="text-white/20 text-xs hidden md:block truncate max-w-[120px]">{email}</span>}
    </div>
  );
}

// ─── Nucleo card (deputado view) ───────────────────────────────────────────────

type Nucleo = {
  g: Gabinete;
  el: Eleitor[];
  coords: AppUser[];
  colabs: AppUser[];
  assessoresDaBase: AppUser[];
  sfp: ReturnType<typeof calcularSFPSimples>;
  ic: ReturnType<typeof calcularIC>;
  status: ReturnType<typeof getStatus>;
  cidade: string;
  estado: string;
};

function NucleoCard({
  nucleo, expanded, onToggle, usuarios,
}: { nucleo: Nucleo; expanded: boolean; onToggle: () => void; usuarios: AppUser[] }) {
  const { g, el, coords, colabs, assessoresDaBase, sfp, ic, status, cidade, estado } = nucleo;
  const [coordsOpen, setCoordsOpen] = useState<Record<string, boolean>>({});
  const fortes = el.filter(e => e.grauApoio === "forte").length;
  const apoioForte = el.length > 0 ? Math.round((fortes / el.length) * 100) : 0;

  return (
    <div className="border border-white/[0.08] rounded-2xl overflow-hidden transition-all hover:border-white/[0.14]">
      {/* Cabeçalho clicável */}
      <button onClick={onToggle} className="w-full p-4 bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left">
        {/* Cidade + estado + status */}
        <div className="flex items-center gap-2 mb-2.5">
          <MapPin size={13} className="text-amber-400 shrink-0" />
          <span className="text-white/90 font-semibold text-sm">{cidade}</span>
          {estado !== "—" && <span className="text-white/30 text-xs">{estado}</span>}
          <div className="ml-auto flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${status.dot}`} />
            <span className={`text-[10px] ${status.color}`}>{status.label}</span>
          </div>
        </div>

        {/* Político */}
        <div className="flex items-center gap-2.5 mb-3.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ background: g.corPrincipal || "#059669" }}>
            {(g.politicoNome || g.nome).charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{g.politicoNome || g.nome}</p>
            <p className="text-white/40 text-xs truncate capitalize">
              {g.cargo}{g.politicoPartido ? ` • ${g.politicoPartido}` : ""}
              {g.politicoNumero ? ` • ${g.politicoNumero}` : ""}
            </p>
          </div>
          <span className="ml-auto text-white/20">{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
        </div>

        {/* Métricas em grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-white/[0.04] rounded-xl p-2.5 text-center">
            <p className="text-white font-bold text-base leading-tight">{el.length.toLocaleString("pt-BR")}</p>
            <p className="text-white/40 text-[10px] mt-0.5">Eleitores</p>
          </div>
          <div className="bg-white/[0.04] rounded-xl p-2.5 text-center">
            <p className="text-white font-bold text-base leading-tight">{coords.length}</p>
            <p className="text-white/40 text-[10px] mt-0.5">Coord.</p>
          </div>
          <div className="bg-white/[0.04] rounded-xl p-2.5 text-center">
            <p className="text-white font-bold text-base leading-tight">{colabs.length}</p>
            <p className="text-white/40 text-[10px] mt-0.5">Militantes</p>
          </div>
        </div>

        {/* SFP + crescimento */}
        <div className="flex items-center gap-2 flex-wrap">
          {sfp ? (
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${sfp.bg} ${sfp.cor}`}>
              SFP {sfp.label}
            </span>
          ) : (
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-white/5 text-white/30">
              SFP — poucos dados
            </span>
          )}
          {ic ? (
            <span className={`text-xs font-semibold ml-auto ${ic.cor}`}>
              {ic.seta} {ic.label}
            </span>
          ) : (
            <span className="text-xs text-white/30 ml-auto">{calcularCrescimento(el)}</span>
          )}
        </div>

        {/* Barra de conversão */}
        {el.length > 0 && (
          <div className="flex items-center gap-2 mt-2.5 text-xs">
            <span className="text-white/30">Apoio Forte</span>
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all" style={{ width: `${apoioForte}%` }} />
            </div>
            <span className="text-emerald-400 font-medium">{apoioForte}%</span>
          </div>
        )}
      </button>

      {/* Expansão: equipe operacional */}
      {expanded && (
        <div className="border-t border-white/[0.06] p-4 space-y-3 bg-white/[0.01]">
          {assessoresDaBase.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-purple-400 mb-1.5 flex items-center gap-1">
                <Shield size={11} /> Assessores ({assessoresDaBase.length})
              </p>
              <div className="space-y-1">
                {assessoresDaBase.map(a => (
                  <CardPessoa key={a.uid} nome={a.nome} email={a.email} role="assessor"
                    contexto={`Assessor(a) • ${g.cargo} ${g.nome}`} />
                ))}
              </div>
            </div>
          )}

          {coords.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-400 mb-1.5 flex items-center gap-1">
                <Target size={11} /> Coordenadores ({coords.length})
              </p>
              <div className="space-y-1">
                {coords.map(c => {
                  const colsDoCoord = usuarios.filter(u => u.role === "colaborador" && u.coordenadorId === c.uid);
                  return (
                    <div key={c.uid}>
                      <button onClick={() => setCoordsOpen(p => ({ ...p, [c.uid]: !p[c.uid] }))}
                        className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] text-left text-sm transition-all">
                        <span className="text-white/30">{coordsOpen[c.uid] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
                        <div className="w-6 h-6 rounded-lg bg-blue-700 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{c.nome.charAt(0)}</div>
                        <span className="text-white/80 flex-1 truncate text-xs">{c.nome}</span>
                        <span className="text-white/30 text-[10px] shrink-0">{colsDoCoord.length} militantes</span>
                      </button>
                      {coordsOpen[c.uid] && (
                        <div className="ml-7 mt-1 space-y-1">
                          {colsDoCoord.map(col => (
                            <CardPessoa key={col.uid} nome={col.nome} email={col.email} role="colaborador"
                              contexto={`Militante • Coord. ${c.nome}`} />
                          ))}
                          {colsDoCoord.length === 0 && <p className="text-xs text-white/30 italic pl-2">Nenhum militante</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {assessoresDaBase.length === 0 && coords.length === 0 && colabs.length === 0 && (
            <p className="text-xs text-white/30 italic">Nenhuma equipe registrada nesta base</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── View Executiva Territorial (deputado federal) ─────────────────────────────

function ViewExecutiva({
  gAtual, gabinetes, eleitores, usuarios, router,
}: {
  gAtual: Gabinete;
  gabinetes: Gabinete[];
  eleitores: Eleitor[];
  usuarios: AppUser[];
  router: ReturnType<typeof useRouter>;
}) {
  const [sortBy, setSortBy] = useState<"eleitores" | "crescimento" | "sfp">("eleitores");
  const [nucleoExpanded, setNucleoExpanded] = useState<Record<string, boolean>>({});

  const meuGabId = gAtual.id!;
  const bases = useMemo(() =>
    gabinetes.filter(g => g.parentGabineteId === meuGabId && g.ativo),
    [gabinetes, meuGabId]
  );

  const nucleos: Nucleo[] = useMemo(() => {
    return bases.map(g => {
      const el = eleitores.filter(e => e.campanhaId === g.id);
      const coords = usuarios.filter(u => u.role === "coordenador" && (u.campanhaId === g.id || u.gabineteId === g.id));
      const colabs = usuarios.filter(u => u.role === "colaborador" && (u.campanhaId === g.id || u.gabineteId === g.id));
      const assessoresDaBase = usuarios.filter(u => u.role === "assessor" && (u.gabineteId === g.id || u.campanhaId === g.id));
      const sfp = calcularSFPSimples(el);
      const ic = calcularIC(el);
      const sorted = [...el].sort((a, b) => parseDate(b.criadoEm).getTime() - parseDate(a.criadoEm).getTime());
      const status = getStatus(sorted[0]?.criadoEm ?? null);
      const cidade = g.cidade || el.find(e => e.cidade)?.cidade || "—";
      const estado = g.estado || el.find(e => e.estado)?.estado || "—";
      return { g, el, coords, colabs, assessoresDaBase, sfp, ic, status, cidade, estado };
    });
  }, [bases, eleitores, usuarios]);

  const nucleosSorted = useMemo(() => {
    return [...nucleos].sort((a, b) => {
      if (sortBy === "crescimento") return (b.ic?.variacao ?? -999) - (a.ic?.variacao ?? -999);
      if (sortBy === "sfp")        return (b.sfp?.score ?? 0) - (a.sfp?.score ?? 0);
      return b.el.length - a.el.length; // "eleitores"
    });
  }, [nucleos, sortBy]);

  // KPIs globais (próprios + bases)
  const totalEleitoresGlobal = eleitores.length;
  const cidadesAlcancadas    = useMemo(() => new Set(eleitores.map(e => e.cidade).filter(Boolean)).size, [eleitores]);
  const basesAtivas          = useMemo(() => nucleos.filter(n => n.status.label === "Ativo").length, [nucleos]);
  const icGlobal             = useMemo(() => calcularIC(eleitores), [eleitores]);
  const sfpGlobal            = useMemo(() => calcularSFPSimples(eleitores), [eleitores]);

  // Equipe direta do deputado
  const meusAssessores  = useMemo(() => usuarios.filter(u => u.role === "assessor"     && (u.gabineteId === meuGabId || u.campanhaId === meuGabId)), [usuarios, meuGabId]);
  const meusCoordenadores = useMemo(() => usuarios.filter(u => u.role === "coordenador" && (u.gabineteId === meuGabId || u.campanhaId === meuGabId)), [usuarios, meuGabId]);
  const [equipeDiretaOpen, setEquipeDiretaOpen] = useState(false);
  const [coordEquipOpen, setCoordEquipOpen] = useState<Record<string, boolean>>({});

  // Alertas automáticos
  const alertas = useMemo(() => {
    const list: { tipo: "danger" | "warn"; msg: string }[] = [];
    const semEleitores = nucleos.filter(n => n.el.length === 0);
    const emQueda = nucleos.filter(n => n.ic && (n.ic.direcao === "queda" || n.ic.direcao === "retraindo"));
    const semAtividade = nucleos.filter(n => n.status.label === "Inativo" && n.el.length > 0);
    if (semEleitores.length > 0) list.push({ tipo: "warn",   msg: `${semEleitores.length} ${semEleitores.length === 1 ? "base sem" : "bases sem"} eleitores cadastrados` });
    if (emQueda.length > 0)      list.push({ tipo: "danger", msg: `${emQueda.length} ${emQueda.length === 1 ? "base com queda" : "bases com queda"} de cadastros esta semana` });
    if (semAtividade.length > 0) list.push({ tipo: "warn",   msg: `${semAtividade.length} ${semAtividade.length === 1 ? "base inativa" : "bases inativas"} nos últimos 7 dias` });
    return list;
  }, [nucleos]);

  return (
    <div className="space-y-6">

      {/* ── KPI BAR ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-white">{totalEleitoresGlobal.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-white/40 mt-0.5">Eleitores</p>
          <p className="text-[10px] text-white/20 mt-1">total da coalizão</p>
        </GlassCard>

        <GlassCard className="p-4 text-center">
          {icGlobal ? (
            <>
              <p className={`text-2xl font-bold ${icGlobal.cor}`}>
                {icGlobal.variacao > 0 ? "+" : ""}{icGlobal.variacao}%
              </p>
              <p className="text-xs text-white/40 mt-0.5">Crescimento</p>
              <p className={`text-[10px] mt-1 ${icGlobal.cor}`}>{icGlobal.seta} vs semana anterior</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-white/30">—</p>
              <p className="text-xs text-white/40 mt-0.5">Crescimento</p>
              <p className="text-[10px] text-white/20 mt-1">dados insuficientes</p>
            </>
          )}
        </GlassCard>

        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{cidadesAlcancadas}</p>
          <p className="text-xs text-white/40 mt-0.5">Municípios</p>
          <p className="text-[10px] text-white/20 mt-1">com presença ativa</p>
        </GlassCard>

        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{basesAtivas}<span className="text-sm text-white/30">/{bases.length}</span></p>
          <p className="text-xs text-white/40 mt-0.5">Bases Ativas</p>
          <p className="text-[10px] text-white/20 mt-1">aliados com movimento</p>
        </GlassCard>

        <GlassCard className={`p-4 text-center ${sfpGlobal ? sfpGlobal.bg : "bg-white/5"} border ${sfpGlobal ? "border-white/10" : "border-white/5"}`}>
          {sfpGlobal ? (
            <>
              <p className={`text-2xl font-bold ${sfpGlobal.cor}`}>{sfpGlobal.score.toFixed(1)}</p>
              <p className="text-xs text-white/40 mt-0.5">SFP Global</p>
              <p className={`text-[10px] font-semibold mt-1 ${sfpGlobal.cor}`}>{sfpGlobal.label}</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-white/30">—</p>
              <p className="text-xs text-white/40 mt-0.5">SFP Global</p>
              <p className="text-[10px] text-white/20 mt-1">poucos dados</p>
            </>
          )}
        </GlassCard>
      </div>

      {/* ── ALERTAS ── */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm border
              ${a.tipo === "danger"
                ? "bg-red-500/8 border-red-500/20 text-red-400"
                : "bg-amber-500/8 border-amber-500/20 text-amber-400"}`}>
              <AlertTriangle size={15} className="shrink-0" />
              <span>{a.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── NUCLEOS TERRITORIAIS ── */}
      <div>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h2 className="text-white font-semibold">Núcleos Territoriais</h2>
            <p className="text-xs text-white/40">{bases.length} {bases.length === 1 ? "base vinculada" : "bases vinculadas"} • clique para expandir equipe</p>
          </div>

          {/* Sort */}
          {bases.length > 1 && (
            <div className="flex gap-1.5">
              {(["eleitores", "crescimento", "sfp"] as const).map(opt => (
                <button key={opt} onClick={() => setSortBy(opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize
                    ${sortBy === opt ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/5 text-white/40 hover:text-white/70"}`}>
                  {opt === "eleitores" ? "Eleitores" : opt === "crescimento" ? "Crescimento" : "SFP"}
                </button>
              ))}
            </div>
          )}
        </div>

        {nucleosSorted.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Building2 size={32} className="mx-auto mb-3 text-white/20" />
            <p className="text-white/40 text-sm">Nenhuma base política vinculada</p>
            <p className="text-white/20 text-xs mt-1">Vincule prefeitos e vereadores aliados no painel do gabinete</p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {nucleosSorted.map(nucleo => (
              <NucleoCard
                key={nucleo.g.id}
                nucleo={nucleo}
                expanded={!!nucleoExpanded[nucleo.g.id!]}
                onToggle={() => setNucleoExpanded(p => ({ ...p, [nucleo.g.id!]: !p[nucleo.g.id!] }))}
                usuarios={usuarios}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── EQUIPE DIRETA DO DEPUTADO ── */}
      <GlassCard className="p-4">
        <button onClick={() => setEquipeDiretaOpen(p => !p)}
          className="w-full flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-white/50" />
            <span className="text-white font-semibold text-sm">Equipe Direta</span>
            <span className="text-xs text-white/30">
              {meusAssessores.length} assessores • {meusCoordenadores.length} coordenadores
            </span>
          </div>
          <span className="text-white/30">{equipeDiretaOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
        </button>

        {equipeDiretaOpen && (
          <div className="mt-4 space-y-4">
            {meusAssessores.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-purple-400 mb-1.5 flex items-center gap-1">
                  <Shield size={11} /> Assessores Parlamentares ({meusAssessores.length})
                </p>
                <div className="space-y-1">
                  {meusAssessores.map(a => (
                    <CardPessoa key={a.uid} nome={a.nome} email={a.email} role="assessor"
                      contexto={`Assessor(a) • ${gAtual.cargo} ${gAtual.nome}`} />
                  ))}
                </div>
              </div>
            )}

            {meusCoordenadores.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-blue-400 mb-1.5 flex items-center gap-1">
                  <Target size={11} /> Coordenadores Diretos ({meusCoordenadores.length})
                </p>
                <div className="space-y-1">
                  {meusCoordenadores.map(c => {
                    const cols = usuarios.filter(u => u.role === "colaborador" && u.coordenadorId === c.uid);
                    return (
                      <div key={c.uid}>
                        <button onClick={() => setCoordEquipOpen(p => ({ ...p, [c.uid]: !p[c.uid] }))}
                          className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] text-left text-sm transition-all">
                          <span className="text-white/30">{coordEquipOpen[c.uid] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
                          <div className="w-6 h-6 rounded-lg bg-blue-700 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{c.nome.charAt(0)}</div>
                          <span className="text-white/80 flex-1 truncate text-xs">{c.nome}</span>
                          <span className="text-white/30 text-[10px] shrink-0">{cols.length} militantes</span>
                        </button>
                        {coordEquipOpen[c.uid] && (
                          <div className="ml-7 mt-1 space-y-1">
                            {cols.map(col => (
                              <CardPessoa key={col.uid} nome={col.nome} email={col.email} role="colaborador"
                                contexto={`Militante • Coord. ${c.nome}`} />
                            ))}
                            {cols.length === 0 && <p className="text-xs text-white/30 italic pl-2">Nenhum militante</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {meusAssessores.length === 0 && meusCoordenadores.length === 0 && (
              <p className="text-xs text-white/30 italic">Nenhuma equipe direta registrada</p>
            )}
          </div>
        )}
      </GlassCard>

    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function MapaPoliticoPage() {
  const { userData } = useAuth();
  const router = useRouter();
  const [gabinetes, setGabinetes] = useState<Gabinete[]>([]);
  const [eleitores, setEleitores] = useState<Eleitor[]>([]);
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [gabineteAtual, setGabineteAtual] = useState<Gabinete | null>(null);
  const [loading, setLoading] = useState(true);

  const podeAcessar = isSuperOrMaster(userData) || isPolitico(userData) || isPrefeito(userData) || isVereador(userData) || isAssessor(userData);

  useEffect(() => {
    if (userData && !podeAcessar) { router.push("/dashboard"); return; }
    load();
  }, [userData]);

  useEffect(() => {
    if (!loading && isSuperOrMaster(userData)) {
      const allIds: Record<string, boolean> = {};
      gabinetes.forEach((g) => { if (g.id) allIds[g.id] = true; });
      setExpanded((prev) => ({ ...prev, ...allIds }));
    }
  }, [loading, gabinetes.length]);

  async function load() {
    try {
      const gabId = userData?.gabineteId || userData?.campanhaId;
      if (isSuperOrMaster(userData)) {
        const [gSnap, eSnap, uSnap] = await Promise.all([
          getDocs(query(collection(db, "campanhas"), orderBy("criadoEm", "desc"))),
          getDocs(query(collection(db, "eleitores"), orderBy("criadoEm", "desc"))),
          getDocs(collection(db, "usuarios")),
        ]);
        setGabinetes(gSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Gabinete)));
        setEleitores(eSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor)));
        setUsuarios(uSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
      } else if (gabId) {
        const [gabOwn, filhosSnap] = await Promise.all([
          getDoc(doc(db, "campanhas", gabId)),
          getDocs(query(collection(db, "campanhas"), where("parentGabineteId", "==", gabId))),
        ]);
        const gabs: Gabinete[] = [];
        if (gabOwn.exists()) gabs.push({ id: gabOwn.id, ...gabOwn.data() } as Gabinete);
        filhosSnap.docs.forEach((d) => gabs.push({ id: d.id, ...d.data() } as Gabinete));
        setGabinetes(gabs);

        const allIds = gabs.map((g) => g.id!).filter(Boolean);
        if (allIds.length > 0) {
          const [eSnap, uSnap1, uSnap2] = await Promise.all([
            getDocs(query(collection(db, "eleitores"), where("campanhaId", "in", allIds))),
            getDocs(query(collection(db, "usuarios"), where("campanhaId", "in", allIds))),
            getDocs(query(collection(db, "usuarios"), where("gabineteId", "in", allIds))),
          ]);
          setEleitores(eSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Eleitor)));
          const uMap = new Map<string, AppUser>();
          [...uSnap1.docs, ...uSnap2.docs].forEach((d) => uMap.set(d.id, { uid: d.id, ...d.data() } as AppUser));
          setUsuarios([...uMap.values()]);
        }
        const gAtual = gabs.find((g) => g.id === gabId);
        if (gAtual) setGabineteAtual(gAtual);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function getPessoas(gabineteId?: string) {
    const assessores = usuarios.filter((u) => u.role === "assessor" && (u.gabineteId === gabineteId || u.campanhaId === gabineteId));
    const coordenadores = usuarios.filter((u) => u.role === "coordenador" && (u.campanhaId === gabineteId || u.gabineteId === gabineteId));
    const colaboradores = usuarios.filter((u) => u.role === "colaborador" && (!u.status || u.status === "ativo"));
    const colabsNoGab = colaboradores.filter((c) => eleitores.some((e) => e.colaboradorId === c.uid && e.campanhaId === gabineteId));
    const bases = gabinetes.filter((g) => g.parentGabineteId === gabineteId && g.ativo);
    return { assessores, coordenadores, colaboradores: colabsNoGab, bases };
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <svg className="animate-spin h-8 w-8 text-emerald-500" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );

  const gabId = userData?.gabineteId || userData?.campanhaId;
  const ativos = gabinetes.filter((g) => g.ativo);
  const gAtual = ativos.find((g) => g.id === gabId);
  const parente: Gabinete | null = gAtual?.parentGabineteId ? ativos.find((g) => g.id === gAtual.parentGabineteId) || null : null;
  const parente2: Gabinete | null = parente?.parentGabineteId ? ativos.find((g) => g.id === parente.parentGabineteId) || null : null;

  // ── render helpers para prefeito/vereador/assessor (mantidos) ─────────────────

  function renderConteudoEstrategico(g: Gabinete, totalEleitores: number) {
    const status = getStatus(eleitores.filter((e) => e.campanhaId === g.id).sort((a, b) => parseDate(b.criadoEm).getTime() - parseDate(a.criadoEm).getTime())[0]?.criadoEm || null);
    const cidades = [...new Set(eleitores.filter((e) => e.campanhaId === g.id).map((e) => e.cidade))];
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-white/[0.03]"><p className="text-white/40">Eleitores</p><p className="text-white font-medium">{totalEleitores}</p></div>
          <div className="p-2 rounded-lg bg-white/[0.03]"><p className="text-white/40">Cidade</p><p className="text-white font-medium">{cidades[0] || "-"}</p></div>
          <div className="p-2 rounded-lg bg-white/[0.03]"><p className="text-white/40">Partido</p><p className="text-white font-medium">{g.politicoPartido || "-"}</p></div>
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20"><p className="text-emerald-400/70">Crescimento</p><p className="text-emerald-400 font-bold">{calcularCrescimento(eleitores.filter(e => e.campanhaId === g.id))}</p></div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${status.dot}`} />
          <span className={`text-xs ${status.color}`}>{status.label}</span>
          {cidades.length > 1 && <span className="text-white/30">• {cidades.length} cidades</span>}
        </div>
      </div>
    );
  }

  function renderConteudoOperacional(g: Gabinete, totalEleitores: number, assessores: any[], coordenadores: any[], colabs: any[], bases: any[]) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-white/[0.03]"><p className="text-white/40">Assessores</p><p className="text-white font-medium">{assessores.length}</p></div>
          <div className="p-2 rounded-lg bg-white/[0.03]"><p className="text-white/40">Coordenadores</p><p className="text-white font-medium">{coordenadores.length}</p></div>
          <div className="p-2 rounded-lg bg-white/[0.03]"><p className="text-white/40">Militantes</p><p className="text-white font-medium">{colabs.length}</p></div>
          <div className="p-2 rounded-lg bg-white/[0.03]"><p className="text-white/40">Eleitores</p><p className="text-white font-medium">{totalEleitores}</p></div>
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20"><p className="text-emerald-400/70">Crescimento</p><p className="text-emerald-400 font-bold">{calcularCrescimento(eleitores.filter(e => e.campanhaId === g.id))}</p></div>
        </div>
        {assessores.length > 0 && (
          <div><p className="text-xs font-medium text-purple-400 mb-1 flex items-center gap-1"><Shield size={12} /> Assessores</p>
            <div className="space-y-1">{assessores.map((a: any) => (<CardPessoa key={a.uid} nome={a.nome} email={a.email} role="assessor" contexto={`Assessor(a) • ${g.cargo} ${g.nome}`} />))}</div></div>
        )}
        {coordenadores.length > 0 && (
          <div>
            <p className="text-xs font-medium text-blue-400 mb-2 flex items-center gap-1"><Target size={12} /> Coordenadores ({coordenadores.length})</p>
            <div className="space-y-1">
              {coordenadores.map((c: any) => {
                const cols = usuarios.filter((u) => u.role === "colaborador" && u.coordenadorId === c.uid);
                return (
                  <div key={c.uid}>
                    <button onClick={() => toggleExpand(`coord_${c.uid}`)} className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] text-sm hover:bg-white/[0.04] text-left transition-all">
                      <span className="text-white/30">{expanded[`coord_${c.uid}`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                      <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{c.nome.charAt(0)}</div>
                      <div className="flex-1 min-w-0"><p className="text-white/80 text-sm truncate">{c.nome}</p></div>
                      <span className="text-white/40 text-xs shrink-0">{cols.length} militantes</span>
                    </button>
                    {expanded[`coord_${c.uid}`] && (<div className="ml-6 mt-1 space-y-1">{cols.map((col) => (<CardPessoa key={col.uid} nome={col.nome} email={col.email} role="colaborador" contexto={`Militante • Coord. ${c.nome}`} />))}{cols.length === 0 && <p className="text-xs text-white/30 italic pl-2">Sem militantes</p>}</div>)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderArvore(g: Gabinete, depth: number = 0) {
    if (!g?.id) return null;
    const isExpanded = !!expanded[g.id!];
    const { assessores, coordenadores, colaboradores: colabs, bases } = getPessoas(g.id);
    const totalEleitores = eleitores.filter((e) => e.campanhaId === g.id).length;
    const status = getStatus(eleitores.filter((e) => e.campanhaId === g.id).sort((a, b) => parseDate(b.criadoEm).getTime() - parseDate(a.criadoEm).getTime())[0]?.criadoEm || null);
    const filhos = ativos.filter((f) => f.parentGabineteId === g.id);

    return (
      <div key={g.id} style={{ marginLeft: depth * 20 }} className="mb-2">
        <div className="border border-white/[0.06] rounded-xl overflow-hidden">
          <button onClick={() => toggleExpand(g.id!)} className="w-full flex items-center gap-3 p-3 bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left">
            <span className="text-white/40 shrink-0">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: g.corPrincipal || "#059669" }}>{g.nome.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">{g.nome}</p>
              <p className="text-xs text-white/40 truncate">{g.cargo}{g.politicoPartido ? ` • ${g.politicoPartido}` : ""}</p>
            </div>
            <div className="hidden md:flex items-center gap-3 text-xs text-white/50 shrink-0">
              <span className="flex items-center gap-1"><Users size={12} />{totalEleitores}</span>
              <span className="flex items-center gap-1"><Zap size={12} />{colabs.length}</span>
            </div>
            <div className={`w-2 h-2 rounded-full ${status.dot} shrink-0`} title={status.label} />
          </button>
          {isExpanded && (
            <div className="p-3 pt-2 bg-white/[0.01] space-y-3">
              {renderConteudoOperacional(g, totalEleitores, assessores, coordenadores, colabs, bases)}
            </div>
          )}
        </div>
        {isExpanded && filhos.map((f) => renderArvore(f, depth + 1))}
      </div>
    );
  }

  // ── render view para prefeito/vereador/assessor ───────────────────────────────

  function renderViewHierarquica(g: Gabinete) {
    const { assessores: todosAssessores, coordenadores: todosCoords, colaboradores: todosColabs } = getPessoas(g.id);

    // Assessor enxerga apenas sua própria cadeia (seus coords e militantes)
    const eAssessor = isAssessor(userData);
    const coordenadores = eAssessor
      ? todosCoords.filter((c) => c.assessorId === userData?.uid)
      : todosCoords;
    const coordIds = new Set(coordenadores.map((c) => c.uid));
    const colabs = eAssessor
      ? todosColabs.filter((col) => col.coordenadorId && coordIds.has(col.coordenadorId))
      : todosColabs;
    // Assessor não exibe outros assessores (pares)
    const assessores = eAssessor ? [] : todosAssessores;

    // Contexto territorial do assessor (cidades sob responsabilidade)
    const cidadesAssessor: string[] = eAssessor && userData
      ? ((userData as any).cidades ?? (userData.cidadePrincipal ? [userData.cidadePrincipal] : []))
      : [];

    return (
      <div className="space-y-3">
        {parente2 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] text-sm opacity-60">
            <div className="w-6 h-6 rounded-lg bg-amber-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{parente2.nome.charAt(0)}</div>
            <p className="text-white/60 text-xs truncate">{parente2.cargo} {parente2.nome}</p>
          </div>
        )}
        {parente && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] text-sm opacity-80 ml-4">
            <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{parente.nome.charAt(0)}</div>
            <p className="text-white/70 text-xs truncate">{parente.cargo} {parente.nome}</p>
          </div>
        )}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-emerald-500/30 ml-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5" style={{ background: g.corPrincipal || "#059669" }}>{g.nome.charAt(0)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm">{g.nome}</p>
            <p className="text-xs text-white/40">{g.cargo}{g.politicoPartido ? ` • ${g.politicoPartido}` : ""}</p>
            {/* Território do assessor logado */}
            {eAssessor && cidadesAssessor.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {cidadesAssessor.map((c) => (
                  <span key={c} className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300/80 text-[10px] border border-purple-500/20">
                    <MapPin size={9} className="shrink-0" />{c}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="ml-12 space-y-3">
          {assessores.length > 0 && <div><p className="text-xs font-medium text-purple-400 mb-1">Assessores</p><div className="space-y-1">{assessores.map((a) => <CardPessoa key={a.uid} nome={a.nome} email={a.email} role="assessor" contexto={`Assessor(a) • ${g.cargo} ${g.nome}`} />)}</div></div>}
          {coordenadores.length > 0 && (
            <div>
              <p className="text-xs font-medium text-blue-400 mb-1">
                Coordenadores ({coordenadores.length})
                {eAssessor && <span className="text-white/30 font-normal"> · seu território</span>}
              </p>
              <div className="space-y-1">
                {coordenadores.map((c) => {
                  const cols = eAssessor
                    ? usuarios.filter((u) => u.role === "colaborador" && u.coordenadorId === c.uid)
                    : usuarios.filter((u) => u.role === "colaborador" && u.coordenadorId === c.uid);
                  return (
                    <div key={c.uid}>
                      <button onClick={() => toggleExpand(`coord_h_${c.uid}`)} className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] text-sm hover:bg-white/[0.04] text-left transition-all">
                        <span className="text-white/30">{expanded[`coord_h_${c.uid}`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{c.nome.charAt(0)}</div>
                        <span className="text-white/80 flex-1 truncate text-sm">{c.nome}</span>
                        {c.cidadePrincipal && <span className="text-white/25 text-[10px] shrink-0 hidden sm:block">{c.cidadePrincipal}</span>}
                        <span className="text-white/40 text-xs shrink-0">{cols.length} militantes</span>
                      </button>
                      {expanded[`coord_h_${c.uid}`] && <div className="ml-8 mt-1 space-y-1">{cols.map((col) => <CardPessoa key={col.uid} nome={col.nome} email={col.email} role="colaborador" contexto={`Militante • Coord. ${c.nome}`} />)}{cols.length === 0 && <p className="text-xs text-white/30 italic pl-2">Nenhum militante</p>}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {eAssessor && coordenadores.length === 0 && (
            <p className="text-xs text-white/30 italic">Nenhum coordenador vinculado a você ainda</p>
          )}
          {colabs.filter(c => !c.coordenadorId).length > 0 && <div><p className="text-xs font-medium text-emerald-400 mb-1">Militantes diretos</p>{colabs.filter(c => !c.coordenadorId).map((col) => <CardPessoa key={col.uid} nome={col.nome} email={col.email} role="colaborador" contexto={`Militante • ${g.nome}`} />)}</div>}
        </div>
      </div>
    );
  }

  // ── main render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
          <MapIcon size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Mapa Político</h1>
          <p className="text-sm text-white/50">
            {isPolitico(userData)
              ? "Força política territorial • visão executiva"
              : "Estrutura hierárquica da sua organização política"}
          </p>
        </div>
      </div>

      {/* SUPER ADMIN: árvore operacional completa */}
      {isSuperOrMaster(userData) && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Globe size={18} className="text-white/40" />
            <h2 className="text-sm font-semibold text-white/60">Todos os Gabinetes</h2>
            <span className="text-xs text-white/20">({ativos.length} ativos)</span>
          </div>
          <div className="space-y-3">
            {ativos.filter((g) => !g.parentGabineteId).map((g) => renderArvore(g, 0))}
            {ativos.filter((g) => !g.parentGabineteId).length === 0 && (
              <p className="text-white/30 text-sm italic">Nenhum gabinete ativo</p>
            )}
          </div>
        </div>
      )}

      {/* DEPUTADO FEDERAL: visão executiva territorial */}
      {isPolitico(userData) && gAtual && (
        <ViewExecutiva
          gAtual={gAtual}
          gabinetes={gabinetes}
          eleitores={eleitores}
          usuarios={usuarios}
          router={router}
        />
      )}

      {/* PREFEITO / VEREADOR / ASSESSOR: visão hierárquica */}
      {(isPrefeito(userData) || isVereador(userData) || isAssessor(userData)) && gAtual && renderViewHierarquica(gAtual)}
    </div>
  );
}

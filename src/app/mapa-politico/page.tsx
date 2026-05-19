"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Gabinete, Eleitor, AppUser } from "@/types";
import { isSuperOrMaster, isPolitico, isPrefeito, isVereador, isAssessor, getRoleConfig } from "@/lib/permissions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { formatDate, parseDate } from "@/lib/utils";
import { ChevronDown, ChevronRight, Users, Target, Zap, Map as MapIcon, Building2, Globe, MapPin, TrendingUp, Mail, Shield } from "lucide-react";
import { useRouter } from "next/navigation";

function getStatus(ultimaData: any): { label: string; color: string; dot: string } {
  if (!ultimaData) return { label: "Sem dados", color: "text-gray-400", dot: "bg-gray-400" };
  const data = ultimaData?.seconds ? new Date(ultimaData.seconds * 1000) : new Date(ultimaData);
  const dias = (Date.now() - data.getTime()) / (1000 * 60 * 60 * 24);
  if (dias <= 3) return { label: "Ativo", color: "text-emerald-400", dot: "bg-emerald-400" };
  if (dias <= 7) return { label: "Baixa atividade", color: "text-amber-400", dot: "bg-amber-400" };
  return { label: "Inativo", color: "text-red-400", dot: "bg-red-400" };
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

  // Auto expandir gabinetes para Super Admin
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
          getDocs(query(collection(db, "usuarios"), orderBy("criadoEm", "desc"))),
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
    const colaboradores = usuarios.filter((u) => u.role === "colaborador");
    const colabsNoGab = colaboradores.filter((c) => eleitores.some((e) => e.colaboradorId === c.uid && e.campanhaId === gabineteId));
    const bases = gabinetes.filter((g) => g.parentGabineteId === gabineteId && g.ativo);
    return { assessores, coordenadores, colaboradores: colabsNoGab, bases };
  }

  if (loading) return <div className="flex justify-center py-20"><svg className="animate-spin h-8 w-8 text-emerald-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;

  // Garantir que gabineteAtual tem o get
  const gabId = userData?.gabineteId || userData?.campanhaId;
  const gAtual = gabinetes.find((g) => g.id === gabId);
  const _ativos = gabinetes.filter((g) => g.ativo);
  const parente: Gabinete | null = gAtual?.parentGabineteId ? _ativos.find((g) => g.id === gAtual.parentGabineteId) || null : null;
  const parente2: Gabinete | null = parente?.parentGabineteId ? _ativos.find((g) => g.id === parente.parentGabineteId) || null : null;
  const parentes = { parente, parente2, _ativos };

  function renderArvore(g: Gabinete, depth: number = 0) {
    if (!g?.id) return null;
    const isExpanded = !!expanded[g.id!];
    const { assessores, coordenadores, colaboradores: colabs, bases } = getPessoas(g.id);
    const totalEleitores = eleitores.filter((e) => e.campanhaId === g.id).length;
    const status = getStatus(eleitores.filter((e) => e.campanhaId === g.id).sort((a, b) => parseDate(b.criadoEm).getTime() - parseDate(a.criadoEm).getTime())[0]?.criadoEm || null);

    return (
      <div key={g.id} style={{ marginLeft: depth * 20 }} className="mb-2">
        {/* CARD DO GABINETE */}
        <div className="border border-white/[0.06] rounded-xl overflow-hidden">
          <button
            onClick={() => toggleExpand(g.id!)}
            className="w-full flex items-center gap-3 p-3 bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left"
          >
            <span className="text-white/40 shrink-0">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: `#059669` }}>
              {g.nome.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">{g.nome}</p>
              <p className="text-xs text-white/40 truncate">{g.cargo} {g.politicoPartido ? `• ${g.politicoPartido}` : ""}</p>
            </div>
            <div className="hidden md:flex items-center gap-3 text-xs text-white/50 shrink-0">
              <span className="flex items-center gap-1"><Users size={12} />{totalEleitores}</span>
              <span className="flex items-center gap-1"><Zap size={12} />{colabs.length}</span>
            </div>
            <div className={`w-2 h-2 rounded-full ${status.dot} shrink-0`} title={status.label} />
          </button>

          {/* CONTEÚDO EXPANDIDO - ESTRATÉGICO OU OPERACIONAL CONFORME O NÓ */}
          {isExpanded && (
            <div className="p-3 pt-2 bg-white/[0.01] space-y-3">
              {isSuperOrMaster(userData) || g.id === (userData?.campanhaId || userData?.gabineteId)
                ? renderConteudoOperacional(g, totalEleitores, assessores, coordenadores, colabs, bases)
                : renderConteudoEstrategico(g, totalEleitores)
              }
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderConteudoEstrategico(g: Gabinete, totalEleitores: number) {
    const status = getStatus(eleitores.filter((e) => e.campanhaId === g.id).sort((a, b) => parseDate(b.criadoEm).getTime() - parseDate(a.criadoEm).getTime())[0]?.criadoEm || null);
    const cidades = [...new Set(eleitores.filter((e) => e.campanhaId === g.id).map((e) => e.cidade))];
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-white/[0.03]"><p className="text-white/40">Eleitores</p><p className="text-white font-medium">{totalEleitores}</p></div>
          <div className="p-2 rounded-lg bg-white/[0.03]"><p className="text-white/40">Cidade</p><p className="text-white font-medium">{cidades[0] || "-"}</p></div>
          <div className="p-2 rounded-lg bg-white/[0.03]"><p className="text-white/40">Partido</p><p className="text-white font-medium">{g.politicoPartido || "-"}</p></div>
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20"><p className="text-emerald-400/70">Crescimento</p><p className="text-emerald-400 font-bold">{calcularCrescimento(eleitores, g.id!)}</p></div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${status.dot}`} />
          <span className={`text-xs ${status.color}`}>{status.label}</span>
          {cidades.length > 1 && <span className="text-white/30">• {cidades.length} cidades</span>}
        </div>
        {totalEleitores > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/40">📊 Conversão:</span>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              {(() => {
                const fortes = eleitores.filter((e) => e.campanhaId === g.id && (e.grauApoio === "forte" || e.grauApoio === "medio")).length;
                const pct = Math.round((fortes / totalEleitores) * 100);
                return <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${pct}%` }} />;
              })()}
            </div>
            <span className="text-emerald-400 font-medium">{Math.round(eleitores.filter((e) => e.campanhaId === g.id && (e.grauApoio === "forte" || e.grauApoio === "medio")).length / totalEleitores * 100)}%</span>
          </div>
        )}
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
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20"><p className="text-emerald-400/70">Crescimento</p><p className="text-emerald-400 font-bold">{calcularCrescimento(eleitores, g.id!)}</p></div>
        </div>
        {totalEleitores > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/40">📊 Conversão:</span>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              {(() => {
                const fortes = eleitores.filter((e) => e.campanhaId === g.id && (e.grauApoio === "forte" || e.grauApoio === "medio")).length;
                const pct = Math.round((fortes / totalEleitores) * 100);
                return <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${pct}%` }} />;
              })()}
            </div>
            <span className="text-emerald-400 font-medium">{Math.round(eleitores.filter((e) => e.campanhaId === g.id && (e.grauApoio === "forte" || e.grauApoio === "medio")).length / totalEleitores * 100)}%</span>
          </div>
        )}
        {assessores.length > 0 && (
          <div><p className="text-xs font-medium text-purple-400 mb-1 flex items-center gap-1"><Shield size={12} /> Assessores ({assessores.length})</p>
            <div className="space-y-1">{assessores.map((a) => (<CardPessoa key={a.uid} nome={a.nome} email={a.email} role="assessor" contexto={`Assessor(a) • ${g.cargo} ${g.nome}`} />))}</div></div>
        )}
        {bases.length > 0 && (
          <div><p className="text-xs font-medium text-amber-400 mb-1 flex items-center gap-1"><Building2 size={12} /> Bases Vinculadas ({bases.length})</p>
            <div className="space-y-1">{(() => {
              const cidades = [...new Set(bases.map((b) => { const el = eleitores.find((e) => e.campanhaId === b.id && e.cidade); return el?.cidade || "Sem cidade"; }))];
              return cidades.map((cidade) => {
                const basesDaCidade = bases.filter((b) => { const el = eleitores.find((e) => e.campanhaId === b.id && e.cidade); return (el?.cidade || "Sem cidade") === cidade; });
                return (<div key={cidade}><button onClick={() => toggleExpand(`cidade_${cidade}`)} className="w-full flex items-center gap-2 p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-all text-left text-sm mb-0.5"><span className="text-white/30">{expanded[`cidade_${cidade}`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span><MapPin size={14} className="text-amber-400 shrink-0" /><span className="text-white/80 font-medium">{cidade}</span><span className="text-white/30 text-xs">({basesDaCidade.length})</span></button>
                  {expanded[`cidade_${cidade}`] && (<div className="ml-6 space-y-1 mt-1">{basesDaCidade.map((b) => (<div key={b.id}><div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] text-sm"><button onClick={() => toggleExpand(`base_${b.id}`)} className="text-white/30 hover:text-white">{expanded[`base_${b.id}`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button><div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{b.nome.charAt(0)}</div><div className="flex-1 min-w-0"><p className="text-white/80 text-sm truncate">{b.nome}</p><p className="text-white/30 text-[10px] truncate">{b.cargo} • {cidade}</p></div><span className="text-white/40 text-xs shrink-0">{eleitores.filter((e) => e.campanhaId === b.id).length} eleitores</span></div>{expanded[`base_${b.id}`] && <div className="ml-6 mt-1 space-y-1">{renderPessoasDaBase(b)}</div>}</div>))}</div>)}</div>);
              });
            })()}</div></div>
        )}
        {coordenadores.length > 0 && (
          <div>
            <p className="text-xs font-medium text-blue-400 mb-2 flex items-center gap-1"><Target size={12} /> Coordenadores ({coordenadores.length})</p>
            <div className="space-y-3">
              {assessores.map((a) => {
                const coordsDoAssessor = coordenadores.filter((c) => c.assessorId === a.uid);
                if (coordsDoAssessor.length === 0) return null;
                return (
                  <div key={a.uid}>
                    <div className="flex items-center gap-1.5 mb-1 pl-1">
                      <div className="w-4 h-4 rounded bg-purple-600/50 flex items-center justify-center text-white text-[9px] font-bold shrink-0">{a.nome.charAt(0)}</div>
                      <span className="text-xs text-purple-400/80">{a.nome}</span>
                    </div>
                    <div className="ml-3 space-y-1">
                      {coordsDoAssessor.map((c) => (
                        <div key={c.uid}>
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] text-sm"><button onClick={() => toggleExpand(`coord_${c.uid}`)} className="text-white/30 hover:text-white">{expanded[`coord_${c.uid}`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button><div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{c.nome.charAt(0)}</div><div className="flex-1 min-w-0"><p className="text-white/80 text-sm truncate">{c.nome}</p><p className="text-white/30 text-[10px] truncate">Coordenador(a) • {a.nome} • {g.nome}</p></div>{c.email && <span className="text-white/30 text-xs hidden md:block truncate max-w-[120px]">{c.email}</span>}</div>
                          {expanded[`coord_${c.uid}`] && (<div className="ml-6 mt-1 space-y-1">{(() => { const colsDoCoord = usuarios.filter((u) => u.role === "colaborador" && u.coordenadorId === c.uid); return colsDoCoord.length > 0 ? colsDoCoord.map((col) => (<CardPessoa key={col.uid} nome={col.nome} email={col.email} role="colaborador" contexto={`Militante • Coord. ${c.nome} • ${g.nome}`} />)) : (<p className="text-xs text-white/30 italic pl-2">Nenhum colaborador vinculado</p>); })()}</div>)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {(() => {
                const coordsSemAssessor = coordenadores.filter((c) => !c.assessorId || !assessores.find((a) => a.uid === c.assessorId));
                if (coordsSemAssessor.length === 0) return null;
                return (
                  <div key="sem-assessor">
                    <div className="flex items-center gap-1.5 mb-1 pl-1"><span className="text-xs text-white/30">Sem assessor vinculado</span></div>
                    <div className="ml-3 space-y-1">
                      {coordsSemAssessor.map((c) => {
                        const assessorNome = c.assessorId ? (usuarios.find((u) => u.uid === c.assessorId)?.nome || "") : "";
                        return (
                        <div key={c.uid}>
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] text-sm"><button onClick={() => toggleExpand(`coord_${c.uid}`)} className="text-white/30 hover:text-white">{expanded[`coord_${c.uid}`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button><div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{c.nome.charAt(0)}</div><div className="flex-1 min-w-0"><p className="text-white/80 text-sm truncate">{c.nome}</p><p className="text-white/30 text-[10px] truncate">Coordenador(a){assessorNome ? ` • ${assessorNome}` : ""} • {g.nome}</p></div>{c.email && <span className="text-white/30 text-xs hidden md:block truncate max-w-[120px]">{c.email}</span>}</div>
                          {expanded[`coord_${c.uid}`] && (<div className="ml-6 mt-1 space-y-1">{(() => { const colsDoCoord = usuarios.filter((u) => u.role === "colaborador" && u.coordenadorId === c.uid); return colsDoCoord.length > 0 ? colsDoCoord.map((col) => (<CardPessoa key={col.uid} nome={col.nome} email={col.email} role="colaborador" contexto={`Militante • Coord. ${c.nome} • ${g.nome}`} />)) : (<p className="text-xs text-white/30 italic pl-2">Nenhum colaborador vinculado</p>); })()}</div>)}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        {colabs.filter((c) => !c.coordenadorId).length > 0 && (
          <div><p className="text-xs font-medium text-emerald-400 mb-1 flex items-center gap-1"><Zap size={12} /> Militantes diretos ({colabs.filter((c) => !c.coordenadorId).length})</p>
            <div className="space-y-1">{colabs.filter((c) => !c.coordenadorId).map((col) => (<CardPessoa key={col.uid} nome={col.nome} email={col.email} role="colaborador" contexto={`Militante direto • ${g.nome}`} />))}</div></div>
        )}
        {assessores.length === 0 && coordenadores.length === 0 && colabs.length === 0 && bases.length === 0 && (
          <p className="text-xs text-white/30 italic">Nenhuma equipe vinculada a este gabinete</p>
        )}
      </div>
    );
  }

  function calcularCrescimento(eleitores: Eleitor[], gabineteId: string): string {
    const agora = Date.now();
    const semanaPassada = agora - 7 * 24 * 60 * 60 * 1000;
    const duasSemanas = agora - 14 * 24 * 60 * 60 * 1000;
    const recentes = eleitores.filter((e) => e.campanhaId === gabineteId && parseDate(e.criadoEm).getTime() > semanaPassada).length;
    const anteriores = eleitores.filter((e) => e.campanhaId === gabineteId && parseDate(e.criadoEm).getTime() > duasSemanas && parseDate(e.criadoEm).getTime() <= semanaPassada).length;
    if (anteriores === 0) return recentes > 0 ? "+100%" : "0%";
    const pct = Math.round(((recentes - anteriores) / anteriores) * 100);
    return pct >= 0 ? `+${pct}%` : `${pct}%`;
  }

  function renderPessoasDaBase(b: Gabinete) {
    const assessores = usuarios.filter((u) => u.role === "assessor" && (u.gabineteId === b.id || u.campanhaId === b.id));
    const coordenadores = usuarios.filter((u) => u.role === "coordenador" && (u.campanhaId === b.id || u.gabineteId === b.id));
    // Vereadores vinculados a esta base (se for prefeito) — busca por parentGabineteId OU mesmo deputado vinculante
    const vereadoresVinculados = b.cargo === "prefeito" && b.parentGabineteId ? ativos.filter((g) => {
      if (g.cargo !== "vereador" || !g.ativo) return false;
      // Vinculado diretamente ao prefeito
      if (g.parentGabineteId === b.id) return true;
      // Mesmo deputado vinculante (parentGabineteId igual)
      if (g.parentGabineteId && g.parentGabineteId === b.parentGabineteId) return true;
      return false;
    }) : [];

    return (
      <>
        {vereadoresVinculados.length > 0 && (
          <div>
            <p className="text-xs text-amber-400/70 mb-1">Vereadores Vinculados</p>
            {vereadoresVinculados.map((v) => (
              <div key={v.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] text-sm">
                <div className="w-7 h-7 rounded-lg bg-amber-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{v.nome.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 truncate">{v.nome}</p>
                  <p className="text-white/30 text-[10px] truncate">{v.cargo} • {v.politicoPartido || ""}</p>
                </div>
                <span className="text-white/40 text-xs shrink-0">{eleitores.filter((e) => e.campanhaId === v.id).length} eleitores</span>
              </div>
            ))}
          </div>
        )}

        {assessores.length > 0 && (
          <div>
            <p className="text-xs text-purple-400/70 mb-1">Assessores</p>
            {assessores.map((a) => <CardPessoa key={a.uid} nome={a.nome} email={a.email} role="assessor" contexto={`Assessor(a) • ${b.cargo} ${b.nome}`} />)}
          </div>
        )}

        {coordenadores.length > 0 && (
          <div>
            <p className="text-xs text-blue-400/70 mb-1">Coordenadores</p>
            {coordenadores.map((c) => {
              const colsDoCoord = usuarios.filter((u) => u.role === "colaborador" && u.coordenadorId === c.uid);
              return (
                <div key={c.uid}>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] text-sm">
                    <button onClick={() => toggleExpand(`coordBase_${c.uid}`)} className="text-white/30 hover:text-white">
                      {expanded[`coordBase_${c.uid}`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {c.nome.charAt(0)}
                    </div>
                    <span className="text-white/80 flex-1 truncate">{c.nome}</span>
                    <span className="text-white/40 text-xs">{colsDoCoord.length} militantes</span>
                  </div>
                  {expanded[`coordBase_${c.uid}`] && (
                    <div className="ml-6 mt-1 space-y-1">
                      {colsDoCoord.map((col) => <CardPessoa key={col.uid} nome={col.nome} email={col.email} role="colaborador" contexto={`Militante • ${b.nome}`} />)}
                      {colsDoCoord.length === 0 && <p className="text-xs text-white/30 italic pl-2">Nenhum militante</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {vereadoresVinculados.length === 0 && assessores.length === 0 && coordenadores.length === 0 && (
          <p className="text-xs text-white/30 italic pl-2">Nenhuma equipe operacional nesta base</p>
        )}
      </>
    );
  }

  function renderConteudoMapa(g: Gabinete, parents: { parente: Gabinete | null; parente2: Gabinete | null; _ativos: Gabinete[] }, usuarios: AppUser[], eleitores: Eleitor[], expanded: Record<string, boolean>, toggleExpand: (id: string) => void) {
    const ativos = parents._ativos;
    const p = parents.parente;
    const p2 = parents.parente2;

    if (isSuperOrMaster(userData) || isPolitico(userData)) {
      return renderArvore(g, 0);
    }

    if (isPrefeito(userData) || isVereador(userData)) {
      return (
        <div className="space-y-3">
          {p2 && <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] text-sm opacity-60">
            <div className="w-6 h-6 rounded-lg bg-amber-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{p2.nome.charAt(0)}</div>
            <p className="text-white/60 text-xs truncate">{p2.cargo} {p2.nome}</p>
          </div>}
          {p && <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] text-sm opacity-80 ml-4">
            <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{p.nome.charAt(0)}</div>
            <p className="text-white/70 text-xs truncate">{p.cargo} {p.nome}</p>
          </div>}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-emerald-500/30 ml-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "#059669" }}>{g.nome.charAt(0)}</div>
            <div><p className="text-white font-medium text-sm">{g.nome}</p><p className="text-xs text-white/40">{g.cargo} {g.politicoPartido ? `• ${g.politicoPartido}` : ""}</p></div>
          </div>
          <div className="ml-12 space-y-3">
            {(() => {
              const { assessores, coordenadores, colaboradores: colabs } = getPessoas(g.id);
              const vereadoresDaCidade = isPrefeito(userData) && g.parentGabineteId ? ativos.filter((v) => v.cargo === "vereador" && v.ativo && (v.parentGabineteId === g.id || v.parentGabineteId === g.parentGabineteId)) : [];
              return (
                <>
                  {assessores.length > 0 && <div><p className="text-xs font-medium text-purple-400 mb-1">Assessores ({assessores.length})</p>{assessores.map((a) => <CardPessoa key={a.uid} nome={a.nome} email={a.email} role="assessor" contexto={`Assessor(a) • ${g.cargo} ${g.nome}`} />)}</div>}
                  {vereadoresDaCidade.length > 0 && <div><p className="text-xs font-medium text-amber-400 mb-1">Vereadores Vinculados ({vereadoresDaCidade.length})</p>{vereadoresDaCidade.map((v) => <div key={v.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] text-sm"><div className="w-7 h-7 rounded-lg bg-amber-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{v.nome.charAt(0)}</div><div className="flex-1 min-w-0"><p className="text-white/80 truncate">{v.nome}</p><p className="text-white/30 text-[10px] truncate">{v.cargo}</p></div></div>)}</div>}
                  {coordenadores.length > 0 && <div><p className="text-xs font-medium text-blue-400 mb-1">Coordenadores ({coordenadores.length})</p>{coordenadores.map((c) => { const cols = usuarios.filter((u) => u.role === "colaborador" && u.coordenadorId === c.uid); const assessorNome = c.assessorId ? (usuarios.find((u) => u.uid === c.assessorId)?.nome || "") : ""; return <div key={c.uid}><button onClick={() => toggleExpand(`coord_direct_${c.uid}`)} className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] text-sm hover:bg-white/[0.04] text-left"><span className="text-white/30">{expanded[`coord_direct_${c.uid}`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span><div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{c.nome.charAt(0)}</div><div className="flex-1 min-w-0"><p className="text-white/80 truncate">{c.nome}</p><p className="text-white/30 text-[10px] truncate">Coordenador(a){assessorNome ? ` • ${assessorNome}` : ""} • {g.nome}</p></div><span className="text-white/40 text-xs shrink-0">{cols.length} militantes</span></button>{expanded[`coord_direct_${c.uid}`] && <div className="ml-8 mt-1 space-y-1">{cols.map((col) => <CardPessoa key={col.uid} nome={col.nome} email={col.email} role="colaborador" contexto={`Militante • Coord. ${c.nome} • ${g.nome}`} />)}{cols.length === 0 && <p className="text-xs text-white/30 italic">Nenhum militante</p>}</div>}</div>; })}</div>}
                  {colabs.filter((c) => !c.coordenadorId).length > 0 && <div><p className="text-xs font-medium text-emerald-400 mb-1">Militantes diretos</p>{colabs.filter((c) => !c.coordenadorId).map((col) => <CardPessoa key={col.uid} nome={col.nome} email={col.email} role="colaborador" contexto={`Militante • ${g.nome}`} />)}</div>}
                </>
              );
            })()}
          </div>
        </div>
      );
    }

    // Assessor
    return (
      <div className="space-y-3">
        {p2 && <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] text-sm opacity-60">
          <div className="w-6 h-6 rounded-lg bg-amber-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{p2.nome.charAt(0)}</div>
          <p className="text-white/60 text-xs truncate">{p2.cargo} {p2.nome}</p>
        </div>}
        {p && <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] text-sm opacity-80 ml-4">
          <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{p.nome.charAt(0)}</div>
          <p className="text-white/70 text-xs truncate">{p.cargo} {p.nome}</p>
        </div>}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-emerald-500/30 ml-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "#059669" }}>{g.nome.charAt(0)}</div>
          <div><p className="text-white font-medium text-sm">{g.nome}</p><p className="text-xs text-white/40">{g.cargo} {g.politicoPartido ? `• ${g.politicoPartido}` : ""}</p></div>
        </div>
        <div className="ml-12 space-y-3">
          {(() => {
            const { assessores, coordenadores, colaboradores: colabs } = getPessoas(g.id);
            return (
              <>
                {assessores.length > 0 && <div><p className="text-xs font-medium text-purple-400 mb-1">Assessores ({assessores.length})</p>{assessores.map((a) => <CardPessoa key={a.uid} nome={a.nome} email={a.email} role="assessor" contexto={`Assessor(a) • ${g.cargo} ${g.nome}`} />)}</div>}
                {coordenadores.length > 0 && <div><p className="text-xs font-medium text-blue-400 mb-1">Coordenadores ({coordenadores.length})</p>{coordenadores.map((c) => { const cols = usuarios.filter((u) => u.role === "colaborador" && u.coordenadorId === c.uid); const assessorNome = c.assessorId ? (usuarios.find((u) => u.uid === c.assessorId)?.nome || "") : ""; return <div key={c.uid}><button onClick={() => toggleExpand(`coord_ass_${c.uid}`)} className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] text-sm hover:bg-white/[0.04] text-left"><span className="text-white/30">{expanded[`coord_ass_${c.uid}`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span><div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{c.nome.charAt(0)}</div><div className="flex-1 min-w-0"><p className="text-white/80 truncate">{c.nome}</p><p className="text-white/30 text-[10px] truncate">Coordenador(a){assessorNome ? ` • ${assessorNome}` : ""} • {g.nome}</p></div><span className="text-white/40 text-xs shrink-0">{cols.length} militantes</span></button>{expanded[`coord_ass_${c.uid}`] && <div className="ml-8 mt-1 space-y-1">{cols.map((col) => <CardPessoa key={col.uid} nome={col.nome} email={col.email} role="colaborador" contexto={`Militante • Coord. ${c.nome} • ${g.nome}`} />)}{cols.length === 0 && <p className="text-xs text-white/30 italic">Nenhum militante</p>}</div>}</div>; })}</div>}
                {colabs.filter((c) => !c.coordenadorId).length > 0 && <div><p className="text-xs font-medium text-emerald-400 mb-1">Militantes diretos</p>{colabs.filter((c) => !c.coordenadorId).map((col) => <CardPessoa key={col.uid} nome={col.nome} email={col.email} role="colaborador" contexto={`Militante • ${g.nome}`} />)}</div>}
              </>
            );
          })()}
        </div>
      </div>
    );
  }

  const ativos = gabinetes.filter((g) => g.ativo);

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-lg">
          <MapIcon size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Mapa Político</h1>
          <p className="text-sm text-white/50">Estrutura hierárquica completa da sua organização política</p>
        </div>
      </div>

      {/* SUPER ADMIN: ÁRVORE COMPLETA — GABINETES RAIZ COM TODA HIERARQUIA */}
      {isSuperOrMaster(userData) ? (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Globe size={18} className="text-white/40" />
            <h2 className="text-sm font-semibold text-white/60">Todos os Gabinetes</h2>
            <span className="text-xs text-white/20">({ativos.length} ativos)</span>
          </div>
          <div className="space-y-3">
            {ativos.filter((g) => !g.parentGabineteId).map((g) => (
              <div key={g.id}>
                {renderArvore(g, 0)}
              </div>
            ))}
            {ativos.filter((g) => !g.parentGabineteId).length === 0 && (
              <p className="text-white/30 text-sm italic">Nenhum gabinete ativo</p>
            )}
          </div>
        </div>
      ) : (
        /* USUÁRIO COMUM: mostra apenas seu gabinete + hierarquia */
        gAtual && renderConteudoMapa(gAtual, parentes, usuarios, eleitores, expanded, toggleExpand)
      )}
    </div>
  );
}

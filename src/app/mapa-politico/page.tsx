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
  ChevronDown, ChevronRight, Users, Target, Zap, BarChart3,
  Building2, Globe, MapPin, TrendingUp, Mail, Shield, AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";

// ─── helpers ──────────────────────────────────────────────────────────────────

function getStatus(ultimaData: any): { label: string; color: string; dot: string } {
  if (!ultimaData) return { label: "Sem dados", color: "text-gray-400", dot: "bg-gray-400" };
  const data = ultimaData?.seconds ? new Date(ultimaData.seconds * 1000) : new Date(ultimaData);
  const dias = (Date.now() - data.getTime()) / (1000 * 60 * 60 * 24);
  if (dias <= 3) return { label: "Ativo",           color: "text-emerald-400", dot: "bg-emerald-400" };
  if (dias <= 7) return { label: "Baixa atividade", color: "text-amber-400",   dot: "bg-amber-400"   };
  return              { label: "Inativo",            color: "text-red-400",     dot: "bg-red-400"     };
}

function calcularCrescimento(el: Eleitor[]): string {
  const agora = Date.now();
  const recentes   = el.filter(e => parseDate(e.criadoEm).getTime() > agora - 7  * 864e5).length;
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

// ─── Score Territorial ─────────────────────────────────────────────────────────
// Fórmula: 40 pts qualidade (SFP) + 25 pts crescimento (IC) + 20 pts cobertura + 15 pts atividade recente
// Projetado para evoluir sem refatoração: apenas adicionar campos ao objeto retornado por cidadesStats.

function calcularScoreTerritorial({
  sfp, ic, temAssessor, temCoordenador, recentes30, totalEleitores,
}: {
  sfp: ReturnType<typeof calcularSFPSimples>;
  ic: ReturnType<typeof calcularIC>;
  temAssessor: boolean;
  temCoordenador: boolean;
  recentes30: number;
  totalEleitores: number;
}): number {
  const ptsSFP = sfp ? Math.min(40, Math.round((sfp.score / 3.0) * 40)) : 0;
  const ptsCrescimento = ic
    ? Math.round(((Math.max(-100, Math.min(100, ic.variacao)) + 100) / 200) * 25)
    : totalEleitores > 0 ? 12 : 0;
  const ptsCobertura = (temAssessor ? 10 : 0) + (temCoordenador ? 10 : 0);
  const ptsAtividade = totalEleitores > 0
    ? Math.min(15, Math.round((recentes30 / Math.max(totalEleitores * 0.1, 1)) * 15))
    : 0;
  return Math.min(100, ptsSFP + ptsCrescimento + ptsCobertura + ptsAtividade);
}

// ─── IC 30 dias — mesma janela de dashboard e assessores ──────────────────────

function calcularIC30d(el: Eleitor[], agora: number) {
  const atual    = el.filter(e => parseDate(e.criadoEm).getTime() > agora - 30 * 86400000).length;
  const anterior = el.filter(e => { const t = parseDate(e.criadoEm).getTime(); return t > agora - 60 * 86400000 && t <= agora - 30 * 86400000; }).length;
  if (atual === 0 && anterior === 0) return null;
  const variacao = anterior === 0 ? (atual > 0 ? 100 : 0) : Math.round(((atual - anterior) / anterior) * 100);
  if (variacao > 25)  return { atual, anterior, variacao, label: `+${variacao}% vs 30d anterior`, direcao: "acelerando" as const, cor: "text-emerald-400", seta: "↗" };
  if (variacao > 5)   return { atual, anterior, variacao, label: `+${variacao}% vs 30d anterior`, direcao: "crescendo"  as const, cor: "text-emerald-400", seta: "↗" };
  if (variacao >= -5) return { atual, anterior, variacao, label: "Estável",                        direcao: "estavel"    as const, cor: "text-white/50",    seta: "→" };
  if (variacao >= -25)return { atual, anterior, variacao, label: `${variacao}% vs 30d anterior`,  direcao: "retraindo"  as const, cor: "text-amber-400",   seta: "↘" };
  return               { atual, anterior, variacao, label: `${variacao}% vs 30d anterior`,  direcao: "queda"      as const, cor: "text-red-400",     seta: "⬇" };
}

// ─── View Força Territorial (deputado) ─────────────────────────────────────────

function ViewForcaTerritorial({
  gAtual, gabinetes, eleitores, usuarios,
}: {
  gAtual: Gabinete;
  gabinetes: Gabinete[];
  eleitores: Eleitor[];
  usuarios: AppUser[];
}) {
  const [sortBy, setSortBy] = useState<"score" | "forca" | "crescimento" | "risco">("score");
  const agora = useMemo(() => Date.now(), []);

  const assessores  = useMemo(() => usuarios.filter(u => u.role === "assessor"),     [usuarios]);
  const coordenadores = useMemo(() => usuarios.filter(u => u.role === "coordenador"), [usuarios]);

  // cidadesStats — unidade: município (nível 1).
  // Estrutura preparada para expansão futura: adicionar campos `territorio` e `bairros[]`
  // sem refatoração completa (territorioStats herda este shape).
  const cidadesStats = useMemo(() => {
    const todasCidades = new Set([
      ...eleitores.map(e => e.cidade).filter(Boolean),
      ...assessores.flatMap(a => (a.cidades ?? [])).filter(Boolean),
    ] as string[]);

    return [...todasCidades].map(cidade => {
      const el          = eleitores.filter(e => e.cidade === cidade);
      const assessor    = assessores.find(a => (a.cidades ?? []).includes(cidade)) ?? null;
      const coords      = coordenadores.filter(c => c.cidadePrincipal === cidade || c.cidade === cidade);
      const sfp         = calcularSFPSimples(el);
      const ic          = calcularIC30d(el, agora);
      const recentes30  = el.filter(e => parseDate(e.criadoEm).getTime() > agora - 30 * 86400000).length;
      const fortes      = el.filter(e => e.grauApoio === "forte").length;
      const pctForte    = el.length > 0 ? Math.round((fortes / el.length) * 100) : 0;
      const temAssessor    = !!assessor;
      const temCoordenador = coords.length > 0;
      const scoreT = calcularScoreTerritorial({ sfp, ic, temAssessor, temCoordenador, recentes30, totalEleitores: el.length });
      return {
        cidade,
        // territorio: null,  // futuro nível 2 — ex: "Zona Norte / Zona Sul"
        // bairros: [] as string[], // futuro nível 3 — ex: ["Boa Viagem", "Imbiribeira"]
        eleitoresData: el,
        assessor,
        coordenadoresData: coords,
        sfp,
        ic,
        recentes30,
        pctForte,
        temAssessor,
        temCoordenador,
        scoreT,
      };
    });
  }, [eleitores, assessores, coordenadores, agora]);

  const cidadesSorted = useMemo(() => {
    const lista = [...cidadesStats];
    if (sortBy === "score")       return lista.sort((a, b) => b.scoreT - a.scoreT);
    if (sortBy === "forca")       return lista.sort((a, b) => (b.sfp?.score ?? 0) - (a.sfp?.score ?? 0));
    if (sortBy === "crescimento") return lista.sort((a, b) => (b.ic?.variacao ?? -999) - (a.ic?.variacao ?? -999));
    return lista.sort((a, b) => {
      const rA = (!a.temAssessor ? 2 : !a.temCoordenador ? 1 : 0) + (a.ic?.direcao === "queda" || a.ic?.direcao === "retraindo" ? 1 : 0);
      const rB = (!b.temAssessor ? 2 : !b.temCoordenador ? 1 : 0) + (b.ic?.direcao === "queda" || b.ic?.direcao === "retraindo" ? 1 : 0);
      return rB - rA || b.eleitoresData.length - a.eleitoresData.length;
    });
  }, [cidadesStats, sortBy]);

  // KPIs globais
  const icGlobal      = useMemo(() => calcularIC30d(eleitores, agora), [eleitores, agora]);
  const sfpGlobal     = useMemo(() => calcularSFPSimples(eleitores), [eleitores]);
  const municipiosCobertos = cidadesStats.filter(c => c.eleitoresData.length > 0).length;
  const assessoresAtivos   = useMemo(() =>
    assessores.filter(a => {
      const el = eleitores.filter(e => (a.cidades ?? []).includes(e.cidade));
      return el.some(e => parseDate(e.criadoEm).getTime() > agora - 30 * 86400000);
    }).length,
  [assessores, eleitores, agora]);

  // Alertas estratégicos
  const alertas = useMemo(() => {
    const criticos:     { msg: string; link?: string; linkLabel?: string }[] = [];
    const atencao:      { msg: string; link?: string; linkLabel?: string }[] = [];
    const oportunidades: { msg: string }[] = [];

    const semAssessor = cidadesStats.filter(c => !c.temAssessor && c.eleitoresData.length > 0);
    if (semAssessor.length > 0)
      criticos.push({
        msg: `${semAssessor.length} ${semAssessor.length === 1 ? "município com eleitores sem assessoria regional" : "municípios com eleitores sem assessoria regional"}`,
        link: `/assessores?acao=expandir&municipios=${semAssessor.map(c => encodeURIComponent(c.cidade)).join(",")}`,
        linkLabel: "Designar assessoria",
      });

    const emQueda = cidadesStats.filter(c => c.ic?.direcao === "queda" || c.ic?.direcao === "retraindo");
    if (emQueda.length > 0)
      criticos.push({ msg: `${emQueda.length} ${emQueda.length === 1 ? "município" : "municípios"} com queda de cadastros (${emQueda.map(c => c.cidade).join(", ")})` });

    const semCoord = cidadesStats.filter(c => c.temAssessor && !c.temCoordenador);
    if (semCoord.length > 0) {
      const alertaEstrutura = semCoord
        .map(c => `${encodeURIComponent(c.cidade)}|${encodeURIComponent(c.assessor?.nome ?? "")}`)
        .join(",");
      atencao.push({
        msg: `${semCoord.length} ${semCoord.length === 1 ? "município com assessor mas sem coordenação ativa" : "municípios com assessor mas sem coordenação ativa"}`,
        link: `/coordenadores?alertaEstrutura=${alertaEstrutura}`,
        linkLabel: "Ver coordenadores",
      });
    }

    const assessSemAtiv = assessores.filter(a => {
      const el = eleitores.filter(e => (a.cidades ?? []).includes(e.cidade));
      return el.length > 0 && !el.some(e => parseDate(e.criadoEm).getTime() > agora - 30 * 86400000);
    });
    if (assessSemAtiv.length > 0)
      atencao.push({
        msg: `${assessSemAtiv.length} ${assessSemAtiv.length === 1 ? "assessoria sem cadastros" : "assessorias sem cadastros"} nos últimos 30 dias`,
        link: "/assessores", linkLabel: "Ver assessores",
      });

    const acelerando = cidadesStats.filter(c => (c.ic?.direcao === "acelerando" || c.ic?.direcao === "crescendo") && c.eleitoresData.length >= 10);
    if (acelerando.length > 0)
      oportunidades.push({ msg: `${acelerando.length} ${acelerando.length === 1 ? "município" : "municípios"} em crescimento acelerado — considere ampliar a coordenação` });

    return { criticos, atencao, oportunidades };
  }, [cidadesStats, assessores, eleitores, agora]);

  // Desempenho das assessorias — mesma lógica de statsExec da aba /assessores
  const assessoriasStats = useMemo(() => {
    return assessores.map(a => {
      const meusCoords    = coordenadores.filter(c => c.assessorId === a.uid);
      const coordIds      = new Set(meusCoords.map(c => c.uid));
      const meusEl        = eleitores.filter(e => coordIds.has(e.coordenadorId));
      const totalEleitores = meusEl.length;
      const fortes        = meusEl.filter(e => e.grauApoio === "forte").length;
      const forca         = totalEleitores > 0 ? Math.round((fortes / totalEleitores) * 100) : 0;
      const recentes30    = meusEl.filter(e => parseDate(e.criadoEm).getTime() > agora - 30 * 86400000).length;
      const prev30        = meusEl.filter(e => { const t = parseDate(e.criadoEm).getTime(); return t > agora - 60 * 86400000 && t <= agora - 30 * 86400000; }).length;
      const tendencia     = prev30 > 0 ? Math.round(((recentes30 - prev30) / prev30) * 100) : recentes30 > 0 ? 100 : 0;
      const badge = (() => {
        if (totalEleitores === 0 && meusCoords.length === 0) return { label: "🔴 Sem Base",           text: "text-red-400"     };
        if (totalEleitores === 0 && meusCoords.length > 0)  return { label: "🔴 Estrutura Parada",   text: "text-red-400"     };
        if (totalEleitores > 0 && recentes30 === 0)          return { label: "🔴 Estrutura Parada",   text: "text-red-400"     };
        if (totalEleitores > 0 && recentes30 > 0 && tendencia >= 10 && forca >= 35) return { label: "🟢 Expansão Forte",    text: "text-emerald-400" };
        if (totalEleitores > 0 && recentes30 > 0 && forca >= 20)                    return { label: "🟢 Operação Saudável",  text: "text-emerald-400" };
        return { label: "🟡 Crescimento Baixo", text: "text-amber-400" };
      })();
      const diagnostico = (() => {
        if (totalEleitores === 0 && meusCoords.length === 0) return "Sem estrutura montada";
        if (totalEleitores === 0 && meusCoords.length > 0)  return "Estrutura sem produção";
        if (totalEleitores > 0 && recentes30 === 0)          return "Sem novos cadastros nos últimos 30 dias";
        if (totalEleitores > 0 && recentes30 > 0 && tendencia < -25) return "Queda significativa de atividade";
        if (forca < 15 && totalEleitores >= 10)              return "Base pouco consolidada";
        if (totalEleitores > 0 && recentes30 > 0 && forca >= 30) return "Estrutura completa";
        return null as string | null;
      })();
      return { uid: a.uid, nome: a.nome, cidades: a.cidades ?? [], totalEleitores, totalCoords: meusCoords.length, forca, recentes30, tendencia, badge, diagnostico };
    }).sort((a, b) => b.totalEleitores - a.totalEleitores || b.forca - a.forca);
  }, [assessores, coordenadores, eleitores, agora]);

  return (
    <div className="space-y-6">

      {/* ── 1. KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-white">{eleitores.length.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-white/40 mt-0.5">Apoiadores</p>
          <p className="text-[10px] text-white/20 mt-1">base do mandato</p>
        </GlassCard>

        <GlassCard className="p-4 text-center">
          {icGlobal ? (
            <>
              <p className={`text-2xl font-bold ${icGlobal.cor}`}>{icGlobal.variacao > 0 ? "+" : ""}{icGlobal.variacao}%</p>
              <p className="text-xs text-white/40 mt-0.5">Crescimento</p>
              <p className={`text-[10px] mt-1 ${icGlobal.cor}`}>{icGlobal.seta} 30 dias</p>
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
          <p className="text-2xl font-bold text-amber-400">{municipiosCobertos}</p>
          <p className="text-xs text-white/40 mt-0.5">Municípios</p>
          <p className="text-[10px] text-white/20 mt-1">com presença</p>
        </GlassCard>

        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">
            {assessoresAtivos}<span className="text-sm text-white/30">/{assessores.length}</span>
          </p>
          <p className="text-xs text-white/40 mt-0.5">Assessorias Ativas</p>
          <p className="text-[10px] text-white/20 mt-1">com cadastros em 30d</p>
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

      {/* ── 2. ALERTAS ESTRATÉGICOS ── */}
      {(alertas.criticos.length > 0 || alertas.atencao.length > 0 || alertas.oportunidades.length > 0) && (
        <div className="space-y-2">
          {alertas.criticos.map((a, i) => (
            <div key={`c${i}`} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm border bg-red-500/8 border-red-500/20 text-red-400">
              <AlertTriangle size={15} className="shrink-0" />
              <span className="flex-1">{a.msg}</span>
              {a.link && (
                <a href={a.link} className="text-xs text-red-400/60 hover:text-red-300 transition-colors shrink-0">
                  {a.linkLabel} →
                </a>
              )}
            </div>
          ))}
          {alertas.atencao.map((a, i) => (
            <div key={`a${i}`} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm border bg-amber-500/8 border-amber-500/20 text-amber-400">
              <AlertTriangle size={15} className="shrink-0" />
              <span className="flex-1">{a.msg}</span>
              {a.link && (
                <a href={a.link} className="text-xs text-amber-400/60 hover:text-amber-300 transition-colors shrink-0">
                  {a.linkLabel} →
                </a>
              )}
            </div>
          ))}
          {alertas.oportunidades.map((a, i) => (
            <div key={`o${i}`} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm border bg-emerald-500/8 border-emerald-500/20 text-emerald-400">
              <TrendingUp size={15} className="shrink-0" />
              <span>{a.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── 3. FORÇA POR MUNICÍPIO ── */}
      <div>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h2 className="text-white font-semibold">Força por Município</h2>
            <p className="text-xs text-white/40">
              {cidadesStats.length} {cidadesStats.length === 1 ? "município no radar territorial" : "municípios no radar territorial"}
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {([
              { key: "score",       label: "Score"       },
              { key: "forca",       label: "Força"       },
              { key: "crescimento", label: "Crescimento" },
              { key: "risco",       label: "Risco"       },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => setSortBy(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${sortBy === key ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-white/5 text-white/40 hover:text-white/70"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {cidadesSorted.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Globe size={32} className="mx-auto mb-3 text-white/20" />
            <p className="text-white/40 text-sm">Nenhum município no radar</p>
            <p className="text-white/20 text-xs mt-1">Cadastre eleitores ou defina os territórios dos assessores</p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cidadesSorted.map(({ cidade, eleitoresData, assessor, coordenadoresData, sfp, ic, recentes30, pctForte, temAssessor, temCoordenador, scoreT }) => {
              const scoreCor    = scoreT >= 70 ? "text-emerald-400" : scoreT >= 40 ? "text-amber-400" : "text-red-400";
              const scoreBg     = scoreT >= 70 ? "bg-emerald-500/10" : scoreT >= 40 ? "bg-amber-500/10" : "bg-red-500/10";
              const cardBorder  = scoreT >= 70 ? "border-emerald-500/15" : scoreT >= 40 ? "border-amber-500/15" : "border-red-500/15";
              const scoreLabel  = scoreT >= 85 ? "Forte" : scoreT >= 70 ? "Boa" : scoreT >= 50 ? "Atenção" : scoreT >= 30 ? "Fraca" : "Crítica";
              return (
                <div key={cidade} className={`p-4 rounded-xl border ${cardBorder} bg-white/[0.02] space-y-3 hover:border-white/[0.10] transition-colors`}>

                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MapPin size={13} className="text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-white font-semibold text-sm">{cidade}</p>
                    </div>
                    <div className={`flex flex-col items-end shrink-0 px-2 py-1 rounded-lg ${scoreBg}`}>
                      <div className="flex items-baseline gap-0.5">
                        <span className={`text-lg font-bold leading-none ${scoreCor}`}>{scoreT}</span>
                        <span className={`text-[10px] ${scoreCor} opacity-50`}>/100</span>
                      </div>
                      <span className={`text-[10px] font-semibold leading-tight ${scoreCor} opacity-70`}>{scoreLabel}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {sfp ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sfp.bg} ${sfp.cor}`}>SFP {sfp.label}</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/30">SFP — poucos dados</span>
                    )}
                    {ic && <span className={`text-xs font-semibold ml-auto ${ic.cor}`}>{ic.seta} {ic.label}</span>}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/[0.05]">
                    <div className="text-center">
                      <p className="text-white font-bold text-base leading-tight">{eleitoresData.length}</p>
                      <p className="text-white/30 text-[10px] mt-0.5">eleitores</p>
                    </div>
                    <div className="text-center border-x border-white/[0.05]">
                      <p className="text-white font-bold text-base leading-tight">{coordenadoresData.length}</p>
                      <p className="text-white/30 text-[10px] mt-0.5">coords</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-bold text-base leading-tight ${pctForte >= 40 ? "text-emerald-400" : pctForte >= 20 ? "text-amber-400" : eleitoresData.length > 0 ? "text-red-400" : "text-white/30"}`}>
                        {eleitoresData.length > 0 ? `${pctForte}%` : "—"}
                      </p>
                      <p className="text-white/30 text-[10px] mt-0.5">apoio forte</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <span className={temAssessor    ? "text-emerald-400" : "text-red-400/70"  }>{temAssessor    ? "✓" : "✗"} Assessor</span>
                      <span className={temCoordenador ? "text-emerald-400" : "text-amber-400/70"}>{temCoordenador ? "✓" : "✗"} Coord</span>
                    </div>
                    {assessor && (
                      <span className="text-white/35 text-[11px] truncate max-w-[100px]">{assessor.nome.split(" ")[0]}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 4. DESEMPENHO DAS ASSESSORIAS ── */}
      {assessoriasStats.length > 0 && (
        <div>
          <h2 className="text-white font-semibold mb-1">Desempenho das Assessorias</h2>
          <p className="text-xs text-white/40 mb-4">Calculado sobre eleitores vinculados via cadeia de coordenação</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assessoriasStats.map(s => (
              <div key={s.uid} className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-bold text-sm">
                      {s.nome.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-white font-semibold text-sm truncate">{s.nome}</p>
                  </div>
                  <div className={`flex items-center shrink-0 px-2 py-1 rounded-full bg-white/[0.04] ${s.badge.text}`}>
                    <span className="text-xs font-medium whitespace-nowrap">{s.badge.label}</span>
                  </div>
                </div>

                {s.cidades.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {s.cidades.map(c => (
                      <span key={c} className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/[0.04] text-white/60 text-[11px]">
                        <MapPin size={9} className="text-white/30 shrink-0" />{c}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/[0.05]">
                  <div className="text-center">
                    <p className="text-white font-bold text-lg leading-tight">{s.totalEleitores}</p>
                    <p className="text-white/30 text-xs mt-0.5">eleitores</p>
                  </div>
                  <div className="text-center border-x border-white/[0.05]">
                    <p className="text-white font-bold text-lg leading-tight">{s.totalCoords}</p>
                    <p className="text-white/30 text-xs mt-0.5">coords</p>
                  </div>
                  <div className="text-center">
                    <p className={`font-bold text-lg leading-tight ${s.forca >= 40 ? "text-emerald-400" : s.forca >= 20 ? "text-amber-400" : s.totalEleitores > 0 ? "text-red-400" : "text-white/30"}`}>
                      {s.totalEleitores > 0 ? `${s.forca}%` : "—"}
                    </p>
                    <p className="text-white/30 text-xs mt-0.5">força</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-white/[0.04]">
                  {s.diagnostico ? (
                    <span className="text-white/35 italic">{s.diagnostico}</span>
                  ) : (
                    <span />
                  )}
                  <a
                    href={`/coordenadores?assessorId=${s.uid}&assessorNome=${encodeURIComponent(s.nome)}`}
                    className="text-amber-400/60 hover:text-amber-300 transition-colors shrink-0"
                  >
                    Ver equipe →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  const cols = usuarios.filter((u) => u.role === "colaborador" && u.coordenadorId === c.uid);
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
          <BarChart3 size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Força Territorial</h1>
          <p className="text-sm text-white/50">
            {isPolitico(userData)
              ? "Inteligência política por município · visão executiva"
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

      {/* DEPUTADO: Força Territorial 2.0 */}
      {isPolitico(userData) && gAtual && (
        <ViewForcaTerritorial
          gAtual={gAtual}
          gabinetes={gabinetes}
          eleitores={eleitores}
          usuarios={usuarios}
        />
      )}

      {/* PREFEITO / VEREADOR / ASSESSOR: visão hierárquica */}
      {(isPrefeito(userData) || isVereador(userData) || isAssessor(userData)) && gAtual && renderViewHierarquica(gAtual)}
    </div>
  );
}

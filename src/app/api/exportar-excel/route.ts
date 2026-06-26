import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { verifyToken, adminDb, adminAuth } from "@/lib/firebase-admin";
import { isRateLimited, getClientIp } from "@/lib/rate-limiter";

interface EleitorData {
  nomeCompleto: string;
  telefone?: string;
  tipoDocumento?: string;
  documento: string;
  estado: string;
  cidade: string;
  bairro?: string;
  grauApoio: string;
  voto?: string;
  colaboradorNome: string;
  coordenadorId?: string;
  coordenadorNome?: string;
  criadoEm?: any;
}

interface PartyColors {
  p: string; s: string; a: string; b: string; d: string; nome: string;
}

const PARTY_PRESETS: Record<string, PartyColors> = {
  "PT": { p: "CC2936", s: "8B1A24", a: "FEEBEE", b: "FFF5F5", d: "6B131C", nome: "PT" },
  "PL": { p: "1D4ED8", s: "1E3A8A", a: "DBEAFE", b: "EFF6FF", d: "172554", nome: "PL" },
  "MDB": { p: "059669", s: "065F46", a: "D1FAE5", b: "ECFDF5", d: "064E3B", nome: "MDB" },
  "PSDB": { p: "2563EB", s: "1D4ED8", a: "DBEAFE", b: "F0F5FF", d: "1E3A8A", nome: "PSDB" },
  "UNIÃO": { p: "B45309", s: "92400E", a: "FEF3C7", b: "FFFBEB", d: "78350F", nome: "União Brasil" },
  "PSD": { p: "0891B2", s: "0E7490", a: "CFFAFE", b: "ECFEFF", d: "164E63", nome: "PSD" },
  "PP": { p: "6B21A8", s: "581C87", a: "F3E8FF", b: "FAF5FF", d: "3B0764", nome: "PP" },
  "PDT": { p: "B91C1C", s: "991B1B", a: "FEE2E2", b: "FEF2F2", d: "7F1D1D", nome: "PDT" },
  "REPUBLICANOS": { p: "15803D", s: "166534", a: "DCFCE7", b: "F0FDF4", d: "14532D", nome: "Republicanos" },
  "PSOL": { p: "C0263D", s: "9F2238", a: "FCE7F3", b: "FDF2F8", d: "831843", nome: "PSOL" },
  "NOVO": { p: "0891B2", s: "0E7490", a: "CFFAFE", b: "ECFEFF", d: "164E63", nome: "NOVO" },
  "REDE": { p: "059669", s: "065F46", a: "D1FAE5", b: "ECFDF5", d: "064E3B", nome: "Rede" },
};

const DEFAULT: PartyColors = { p: "059669", s: "065F46", a: "D1FAE5", b: "ECFDF5", d: "064E3B", nome: "Gabinete" };

function getColors(party?: string): PartyColors {
  return PARTY_PRESETS[party?.toUpperCase() || ""] || DEFAULT;
}

function dataStr(e: EleitorData): string {
  if (!e.criadoEm) return "-";
  const d = e.criadoEm?.seconds ? new Date(e.criadoEm.seconds * 1000) : new Date(e.criadoEm);
  return d.toLocaleDateString("pt-BR");
}

function dateTs(e: EleitorData): number {
  if (!e.criadoEm) return 0;
  return e.criadoEm?.seconds ? e.criadoEm.seconds * 1000 : new Date(e.criadoEm).getTime();
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const COL = { ML: 1, LABEL: 2, V1: 3, V2: 4, V3: 5, V4: 6, MR: 7 } as const;

const fill = (argb: string): ExcelJS.Fill => ({
  type: "pattern", pattern: "solid", fgColor: { argb },
} as ExcelJS.Fill);

const thin = (argb = "FFE2E8F0") => ({ style: "thin" as const, color: { argb } });

function fillRow(ws: ExcelJS.Worksheet, row: number, argb: string) {
  for (let c = COL.ML; c <= COL.MR; c++) ws.getCell(row, c).fill = fill(argb);
}

function sectionHeader(ws: ExcelJS.Worksheet, row: number, text: string) {
  fillRow(ws, row, "FF1E3A5F");
  ws.mergeCells(row, COL.ML, row, COL.MR);
  const cell = ws.getCell(row, COL.ML);
  cell.value = "  " + text;
  cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  cell.alignment = { vertical: "middle" };
  ws.getRow(row).height = 22;
}

function tableHeader(ws: ExcelJS.Worksheet, row: number, cols: string[]) {
  fillRow(ws, row, "FF334155");
  cols.forEach((h, i) => {
    const cell = ws.getCell(row, COL.LABEL + i);
    cell.value = h;
    cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center", indent: i === 0 ? 1 : 0 };
    cell.border = { bottom: thin("FF1E293B") };
  });
  ws.getRow(row).height = 20;
}

function dataRow(ws: ExcelJS.Worksheet, row: number, vals: (string | number)[], isAlt: boolean) {
  const bg = isAlt ? "FFF8FAFC" : "FFFFFFFF";
  fillRow(ws, row, bg);
  vals.forEach((v, i) => {
    const cell = ws.getCell(row, COL.LABEL + i);
    cell.value = v;
    cell.fill = fill(bg);
    cell.font = { name: "Calibri", size: 9, color: { argb: "FF374151" } };
    cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center", indent: i === 0 ? 1 : 0 };
    cell.border = { bottom: thin() };
  });
  ws.getRow(row).height = 18;
}

// ─── Stats computation ────────────────────────────────────────────────────────

interface CoordStat { nome: string; total: number; fortes: number; indecisos: number; fracos: number; }
interface TerrStat  { label: string; total: number; indecisos: number; fracos: number; recentes: number; }

function computeStats(eleitores: EleitorData[]) {
  const agora30d = Date.now() - 30 * 86400e3;
  let fortes = 0, medios = 0, indecisos = 0, fracos = 0, recentes = 0;
  const coordMap = new Map<string, CoordStat>();
  const terrMap  = new Map<string, TerrStat>();

  for (const e of eleitores) {
    if (e.grauApoio === "forte")    fortes++;
    else if (e.grauApoio === "medio")   medios++;
    else if (e.grauApoio === "indeciso") indecisos++;
    else if (e.grauApoio === "fraco")   fracos++;
    const ts = dateTs(e);
    if (ts > agora30d) recentes++;

    const cid = e.coordenadorId || "";
    if (cid && e.coordenadorNome) {
      if (!coordMap.has(cid)) coordMap.set(cid, { nome: e.coordenadorNome, total: 0, fortes: 0, indecisos: 0, fracos: 0 });
      const c = coordMap.get(cid)!;
      c.total++;
      if (e.grauApoio === "forte")    c.fortes++;
      if (e.grauApoio === "indeciso") c.indecisos++;
      if (e.grauApoio === "fraco")    c.fracos++;
    }

    const key   = `${e.bairro || ""}||${e.cidade}`;
    const label = e.bairro ? `${e.bairro} · ${e.cidade}` : e.cidade;
    if (!terrMap.has(key)) terrMap.set(key, { label, total: 0, indecisos: 0, fracos: 0, recentes: 0 });
    const t = terrMap.get(key)!;
    t.total++;
    if (e.grauApoio === "indeciso") t.indecisos++;
    if (e.grauApoio === "fraco")    t.fracos++;
    if (ts > agora30d)              t.recentes++;
  }

  const coordList = Array.from(coordMap.values()).sort((a, b) => b.total - a.total);
  const terrList  = Array.from(terrMap.values()).sort((a, b) => b.total - a.total);

  return { fortes, medios, indecisos, fracos, recentes, coordList, terrList };
}

// ─── EXECUTIVO sheet ──────────────────────────────────────────────────────────

function buildExecutivoSheet(wb: ExcelJS.Workbook, eleitores: EleitorData[], gabineteNome: string) {
  const ws = wb.addWorksheet("EXECUTIVO", { views: [{ state: "frozen", ySplit: 2, showGridLines: false }] });
  ws.properties.tabColor = { argb: "FF1E293B" };
  ws.columns = [
    { width: 3 },  // A margin
    { width: 30 }, // B label/name
    { width: 13 }, // C v1
    { width: 12 }, // D v2
    { width: 12 }, // E v3
    { width: 11 }, // F v4/%
    { width: 3 },  // G margin
  ];

  const { fortes, medios, indecisos, fracos, recentes, coordList, terrList } = computeStats(eleitores);

  const crescList  = [...terrList].filter(t => t.recentes > 0).sort((a, b) => b.recentes - a.recentes);
  const indecList  = [...terrList].filter(t => t.total > 0).sort((a, b) => (b.indecisos / b.total) - (a.indecisos / a.total));
  const fracosList = [...terrList].filter(t => t.total > 0).sort((a, b) => (b.fracos / b.total) - (a.fracos / a.total));

  let r = 1;

  // ── Header ────────────────────────────────────────────────────────────────
  fillRow(ws, r, "FF1E293B");
  ws.mergeCells(r, COL.ML, r, COL.MR);
  const h1 = ws.getCell(r, COL.ML);
  h1.value = "  RELATÓRIO EXECUTIVO TERRITORIAL";
  h1.font  = { name: "Calibri", size: 20, bold: true, color: { argb: "FFFFFFFF" } };
  h1.alignment = { vertical: "middle" };
  ws.getRow(r).height = 44; r++;

  fillRow(ws, r, "FF334155");
  ws.mergeCells(r, COL.ML, r, COL.MR);
  const h2 = ws.getCell(r, COL.ML);
  h2.value = `  ${gabineteNome}  ·  ${new Date().toLocaleDateString("pt-BR")}  ·  Eleitores 2026`;
  h2.font  = { name: "Calibri", size: 10, color: { argb: "FFE2E8F0" } };
  h2.alignment = { vertical: "middle" };
  ws.getRow(r).height = 24; r++;

  fillRow(ws, r, "FFFFFFFF"); ws.getRow(r).height = 10; r++;

  // ── KPIs ──────────────────────────────────────────────────────────────────
  sectionHeader(ws, r, "INDICADORES DA BASE"); r++;

  const kpis: { label: string; value: string | number; bg: string; fg: string }[] = [
    { label: "Total de Eleitores",    value: eleitores.length, bg: "FFF8FAFC", fg: "FF1E293B" },
    { label: "Fortes",                value: fortes,           bg: "FFECFDF5", fg: "FF059669" },
    { label: "Médios",                value: medios,           bg: "FFFEFCE8", fg: "FFD97706" },
    { label: "Indecisos",             value: indecisos,        bg: "FFEFF6FF", fg: "FF3B82F6" },
    { label: "Fracos",                value: fracos,           bg: "FFFEF2F2", fg: "FFDC2626" },
    { label: "Crescimento (30 dias)", value: `+${recentes}`,   bg: "FFF5F3FF", fg: "FF7C3AED" },
    { label: "Coordenadores Ativos",  value: coordList.length, bg: "FFFFF7ED", fg: "FFF97316" },
    { label: "Territórios Cobertos",  value: terrList.length,  bg: "FFF0F9FF", fg: "FF0284C7" },
  ];

  for (const kpi of kpis) {
    fillRow(ws, r, "FFFFFFFF");
    const lc = ws.getCell(r, COL.LABEL);
    lc.value = kpi.label;
    lc.fill  = fill(kpi.bg);
    lc.font  = { name: "Calibri", size: 10, color: { argb: "FF6B7280" } };
    lc.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    lc.border = { bottom: thin(), left: thin(), top: thin() };

    const vc = ws.getCell(r, COL.V1);
    vc.value = kpi.value;
    vc.fill  = fill(kpi.bg);
    vc.font  = { name: "Calibri", size: 22, bold: true, color: { argb: kpi.fg } };
    vc.alignment = { vertical: "middle", horizontal: "right" };
    vc.border = { bottom: thin(), right: thin(), top: thin() };

    // fill unused cols D-F same bg
    for (let c = COL.V2; c <= COL.V4; c++) {
      ws.getCell(r, c).fill = fill(kpi.bg);
      ws.getCell(r, c).border = { bottom: thin(), top: thin() };
    }
    ws.getRow(r).height = 28; r++;
  }

  fillRow(ws, r, "FFFFFFFF"); ws.getRow(r).height = 12; r++;

  // ── Top Coordenadores ─────────────────────────────────────────────────────
  sectionHeader(ws, r, "TOP COORDENADORES"); r++;
  tableHeader(ws, r, ["Nome", "Total", "Fortes", "Indecisos", "% Fortes"]); r++;
  coordList.slice(0, 10).forEach((c, i) => {
    dataRow(ws, r, [c.nome, c.total, c.fortes, c.indecisos, c.total > 0 ? `${Math.round((c.fortes / c.total) * 100)}%` : "—"], i % 2 === 1); r++;
  });
  if (coordList.length === 0) { dataRow(ws, r, ["Nenhum coordenador com eleitores vinculados", "", "", "", ""], false); r++; }

  fillRow(ws, r, "FFFFFFFF"); ws.getRow(r).height = 10; r++;

  // ── Top Territórios ───────────────────────────────────────────────────────
  sectionHeader(ws, r, "TOP TERRITÓRIOS POR VOLUME"); r++;
  tableHeader(ws, r, ["Território", "Total", "Indecisos", "Fracos", "% da Base"]); r++;
  terrList.slice(0, 10).forEach((t, i) => {
    const pct = eleitores.length > 0 ? Math.round((t.total / eleitores.length) * 100) : 0;
    dataRow(ws, r, [t.label, t.total, t.indecisos, t.fracos, `${pct}%`], i % 2 === 1); r++;
  });

  fillRow(ws, r, "FFFFFFFF"); ws.getRow(r).height = 10; r++;

  // ── Maior Crescimento ─────────────────────────────────────────────────────
  sectionHeader(ws, r, "MAIOR CRESCIMENTO — ÚLTIMOS 30 DIAS"); r++;
  tableHeader(ws, r, ["Território", "Recentes", "Total", "% da Base", ""]); r++;
  if (crescList.length > 0) {
    crescList.slice(0, 8).forEach((t, i) => {
      const pct = eleitores.length > 0 ? Math.round((t.recentes / eleitores.length) * 100) : 0;
      dataRow(ws, r, [t.label, t.recentes, t.total, `${pct}%`, ""], i % 2 === 1); r++;
    });
  } else {
    dataRow(ws, r, ["Nenhuma atividade nos últimos 30 dias", "", "", "", ""], false); r++;
  }

  fillRow(ws, r, "FFFFFFFF"); ws.getRow(r).height = 10; r++;

  // ── Concentração de Indecisos ─────────────────────────────────────────────
  sectionHeader(ws, r, "CONCENTRAÇÃO DE INDECISOS — MAIOR POTENCIAL"); r++;
  tableHeader(ws, r, ["Território", "Indecisos", "Total", "% Indecisos", ""]); r++;
  const indecRows = indecList.filter(t => t.indecisos > 0);
  if (indecRows.length > 0) {
    indecRows.slice(0, 8).forEach((t, i) => {
      const pct = Math.round((t.indecisos / t.total) * 100);
      dataRow(ws, r, [t.label, t.indecisos, t.total, `${pct}%`, ""], i % 2 === 1); r++;
    });
  } else {
    dataRow(ws, r, ["Sem indecisos na base", "", "", "", ""], false); r++;
  }

  fillRow(ws, r, "FFFFFFFF"); ws.getRow(r).height = 10; r++;

  // ── Áreas de Rejeição ─────────────────────────────────────────────────────
  sectionHeader(ws, r, "ÁREAS DE REJEIÇÃO — CONCENTRAÇÃO DE FRACOS"); r++;
  tableHeader(ws, r, ["Território", "Fracos", "Total", "% Rejeição", ""]); r++;
  const fracosRows = fracosList.filter(t => t.fracos > 0);
  if (fracosRows.length > 0) {
    fracosRows.slice(0, 8).forEach((t, i) => {
      const pct = Math.round((t.fracos / t.total) * 100);
      dataRow(ws, r, [t.label, t.fracos, t.total, `${pct}%`, ""], i % 2 === 1); r++;
    });
  } else {
    dataRow(ws, r, ["Sem rejeição registrada", "", "", "", ""], false); r++;
  }

  r += 2;
  fillRow(ws, r, "FFF8FAFC");
  ws.mergeCells(r, COL.ML, r, COL.MR);
  const footer = ws.getCell(r, COL.ML);
  footer.value = `  Eleitores 2026 — Plataforma de Gestão Política  ·  Gerado em ${new Date().toLocaleString("pt-BR")}`;
  footer.font  = { name: "Calibri", size: 8, color: { argb: "FF9CA3AF" } };
  footer.alignment = { vertical: "middle" };
  ws.getRow(r).height = 18;
}

// ─── Resumo sheet ─────────────────────────────────────────────────────────────

function buildResumoSheet(wb: ExcelJS.Workbook, eleitores: EleitorData[], gabineteNome: string) {
  const ws = wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] });
  ws.properties.tabColor = { argb: "FF334155" };
  ws.columns = [{ width: 3 }, { width: 30 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 3 }];

  const { fortes, medios, indecisos, fracos, recentes, coordList, terrList } = computeStats(eleitores);
  const total = eleitores.length;

  let r = 1;
  fillRow(ws, r, "FF1E293B");
  ws.mergeCells(r, 1, r, 7);
  const h = ws.getCell(r, 1);
  h.value = "  RESUMO EXECUTIVO";
  h.font  = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  h.alignment = { vertical: "middle" };
  ws.getRow(r).height = 36; r++;

  fillRow(ws, r, "FF334155");
  ws.mergeCells(r, 1, r, 7);
  const sub = ws.getCell(r, 1);
  sub.value = `  ${gabineteNome}  ·  ${new Date().toLocaleDateString("pt-BR")}`;
  sub.font  = { name: "Calibri", size: 10, color: { argb: "FFE2E8F0" } };
  sub.alignment = { vertical: "middle" };
  ws.getRow(r).height = 22; r++;

  fillRow(ws, r, "FFFFFFFF"); ws.getRow(r).height = 10; r++;

  sectionHeader(ws, r, "INDICADORES"); r++;

  const rows: [string, string | number, string][] = [
    ["Total de Eleitores", total, ""],
    ["Fortes", fortes, total > 0 ? `${Math.round((fortes/total)*100)}%` : "—"],
    ["Médios", medios, total > 0 ? `${Math.round((medios/total)*100)}%` : "—"],
    ["Indecisos", indecisos, total > 0 ? `${Math.round((indecisos/total)*100)}%` : "—"],
    ["Fracos", fracos, total > 0 ? `${Math.round((fracos/total)*100)}%` : "—"],
    ["Crescimento últimos 30 dias", `+${recentes}`, total > 0 ? `${Math.round((recentes/total)*100)}%` : "—"],
    ["Coordenadores Ativos", coordList.length, ""],
    ["Territórios Cobertos", terrList.length, ""],
  ];

  rows.forEach(([label, val, pct], i) => {
    const bg = i % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC";
    fillRow(ws, r, bg);
    ws.getCell(r, 2).value = label;
    ws.getCell(r, 2).font  = { name: "Calibri", size: 10, color: { argb: "FF374151" } };
    ws.getCell(r, 2).alignment = { indent: 1 };
    ws.getCell(r, 3).value = val;
    ws.getCell(r, 3).font  = { name: "Calibri", size: 11, bold: true, color: { argb: "FF1E293B" } };
    ws.getCell(r, 3).alignment = { horizontal: "center" };
    if (pct) {
      ws.getCell(r, 4).value = pct;
      ws.getCell(r, 4).font  = { name: "Calibri", size: 9, color: { argb: "FF6B7280" } };
      ws.getCell(r, 4).alignment = { horizontal: "center" };
    }
    ws.getRow(r).height = 22; r++;
  });
}

// ─── Eleitores sheet ──────────────────────────────────────────────────────────

function buildEleitoresSheet(wb: ExcelJS.Workbook, eleitores: EleitorData[]) {
  const ws = wb.addWorksheet("Eleitores", { views: [{ showGridLines: false }] });
  ws.properties.tabColor = { argb: "FF1E3A5F" };
  ws.columns = [{ width: 28 }, { width: 16 }, { width: 8 }, { width: 18 }, { width: 14 }, { width: 12 }, { width: 20 }, { width: 20 }, { width: 13 }];

  const headers = ["Nome", "Telefone", "UF", "Cidade / Bairro", "Grau de Apoio", "Intenção", "Coordenador", "Mobilizador", "Cadastro"];
  headers.forEach((h, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.value = h;
    cell.fill  = fill("FF1E3A5F");
    cell.font  = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "medium" as const, color: { argb: "FF1E293B" } } };
  });
  ws.getRow(1).height = 22;

  const grauColor: Record<string, string> = {
    forte: "FF059669", medio: "FFD97706", indeciso: "FF3B82F6", fraco: "FFDC2626",
  };

  eleitores.forEach((e, i) => {
    const bg = i % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC";
    const r  = i + 2;
    const localidade = e.bairro ? `${e.bairro} · ${e.cidade}` : e.cidade;
    const vals = [e.nomeCompleto, e.telefone || "-", e.estado, localidade, e.grauApoio, e.voto || "-", e.coordenadorNome || "-", e.colaboradorNome, dataStr(e)];
    vals.forEach((v, j) => {
      const cell = ws.getCell(r, j + 1);
      cell.value = v;
      cell.fill  = fill(bg);
      cell.font  = { name: "Calibri", size: 9, color: { argb: j === 4 ? (grauColor[v as string] || "FF374151") : "FF374151" } };
      if (j === 4) cell.font = { ...cell.font, bold: true };
      cell.alignment = { vertical: "middle" };
      cell.border = { bottom: thin() };
    });
    ws.getRow(r).height = 17;
  });
}

// ─── Coordenadores sheet ──────────────────────────────────────────────────────

function buildCoordenadoresSheet(wb: ExcelJS.Workbook, eleitores: EleitorData[]) {
  const ws = wb.addWorksheet("Coordenadores", { views: [{ showGridLines: false }] });
  ws.properties.tabColor = { argb: "FF065F46" };
  ws.columns = [{ width: 28 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }];

  const { coordList } = computeStats(eleitores);

  const headers = ["Coordenador", "Total", "Fortes", "Médios", "Indecisos", "Fracos", "% Fortes"];
  headers.forEach((h, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.value = h;
    cell.fill  = fill("FF1E3A5F");
    cell.font  = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center" };
    cell.border = { bottom: { style: "medium" as const, color: { argb: "FF1E293B" } } };
  });
  ws.getRow(1).height = 22;

  // recompute with medios per coord
  const coordMapFull = new Map<string, CoordStat & { medios: number }>();
  for (const e of eleitores) {
    if (!e.coordenadorId || !e.coordenadorNome) continue;
    if (!coordMapFull.has(e.coordenadorId)) coordMapFull.set(e.coordenadorId, { nome: e.coordenadorNome, total: 0, fortes: 0, indecisos: 0, fracos: 0, medios: 0 });
    const c = coordMapFull.get(e.coordenadorId)!;
    c.total++;
    if (e.grauApoio === "forte")    c.fortes++;
    if (e.grauApoio === "medio")    c.medios++;
    if (e.grauApoio === "indeciso") c.indecisos++;
    if (e.grauApoio === "fraco")    c.fracos++;
  }
  const full = Array.from(coordMapFull.values()).sort((a, b) => b.total - a.total);

  full.forEach((c, i) => {
    const bg = i % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC";
    const r  = i + 2;
    [c.nome, c.total, c.fortes, c.medios, c.indecisos, c.fracos, c.total > 0 ? `${Math.round((c.fortes/c.total)*100)}%` : "—"].forEach((v, j) => {
      const cell = ws.getCell(r, j + 1);
      cell.value = v;
      cell.fill  = fill(bg);
      cell.font  = { name: "Calibri", size: 9, color: { argb: "FF374151" }, bold: j === 1 };
      cell.alignment = { vertical: "middle", horizontal: j === 0 ? "left" : "center" };
      cell.border = { bottom: thin() };
    });
    ws.getRow(r).height = 18;
  });
}

// ─── Territórios sheet ────────────────────────────────────────────────────────

function buildTerritoriosSheet(wb: ExcelJS.Workbook, eleitores: EleitorData[]) {
  const ws = wb.addWorksheet("Territórios", { views: [{ showGridLines: false }] });
  ws.properties.tabColor = { argb: "FF0E7490" };
  ws.columns = [{ width: 32 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }];

  const { terrList } = computeStats(eleitores);

  const headers = ["Território", "Total", "Fortes", "Indecisos", "Fracos", "Recentes"];
  headers.forEach((h, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.value = h;
    cell.fill  = fill("FF1E3A5F");
    cell.font  = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center" };
    cell.border = { bottom: { style: "medium" as const, color: { argb: "FF1E293B" } } };
  });
  ws.getRow(1).height = 22;

  terrList.forEach((t, i) => {
    const bg = i % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC";
    const r  = i + 2;
    [t.label, t.total, t.indecisos > 0 ? t.indecisos : "-", t.fracos > 0 ? t.fracos : "-", t.recentes > 0 ? `+${t.recentes}` : "-"].forEach((v, j) => {
      const cell = ws.getCell(r, j + 1);
      cell.value = v;
      cell.fill  = fill(bg);
      cell.font  = { name: "Calibri", size: 9, color: { argb: "FF374151" }, bold: j === 1 };
      cell.alignment = { vertical: "middle", horizontal: j === 0 ? "left" : "center" };
      cell.border = { bottom: thin() };
    });
    ws.getRow(r).height = 17;
  });
}

// ─── Filtered sheet (Oportunidades / Atenção) ────────────────────────────────

function buildFilteredSheet(wb: ExcelJS.Workbook, name: string, headerArgb: string, eleitores: EleitorData[], filter: (e: EleitorData) => boolean) {
  const ws = wb.addWorksheet(name, { views: [{ showGridLines: false }] });
  ws.properties.tabColor = { argb: name === "Oportunidades" ? "FF1E3A8A" : "FF7F1D1D" };
  ws.columns = [{ width: 28 }, { width: 16 }, { width: 18 }, { width: 14 }, { width: 20 }, { width: 20 }, { width: 13 }];

  const filtered = eleitores.filter(filter);

  const headers = ["Nome", "Telefone", "Cidade / Bairro", "Grau de Apoio", "Coordenador", "Mobilizador", "Cadastro"];
  headers.forEach((h, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.value = h;
    cell.fill  = fill(headerArgb);
    cell.font  = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center" };
    cell.border = { bottom: { style: "medium" as const, color: { argb: "FF1E293B" } } };
  });
  ws.getRow(1).height = 22;

  filtered.forEach((e, i) => {
    const bg = i % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC";
    const r  = i + 2;
    const localidade = e.bairro ? `${e.bairro} · ${e.cidade}` : e.cidade;
    [e.nomeCompleto, e.telefone || "-", localidade, e.grauApoio, e.coordenadorNome || "-", e.colaboradorNome, dataStr(e)].forEach((v, j) => {
      const cell = ws.getCell(r, j + 1);
      cell.value = v;
      cell.fill  = fill(bg);
      cell.font  = { name: "Calibri", size: 9, color: { argb: "FF374151" } };
      cell.alignment = { vertical: "middle", horizontal: j === 0 ? "left" : "center" };
      cell.border = { bottom: thin() };
    });
    ws.getRow(r).height = 17;
  });
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: "Serviço de exportação não disponível (configuração do servidor)." }, { status: 503 });
    }
    if (await isRateLimited(getClientIp(req), "exportar-excel", 3)) {
      return NextResponse.json({ error: "Muitas exportações. Aguarde um minuto." }, { status: 429 });
    }
    const uid = await verifyToken(req);
    if (!uid) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar campanha do usuário para escopo de autorização
    const userDoc = await adminDb.collection("usuarios").doc(uid).get();
    const userRole      = (userDoc.data()?.role ?? "") as string;
    const userCampanhaId = (userDoc.data()?.campanhaId || userDoc.data()?.gabineteId || "") as string;

    const body = await req.json();
    const { titulo, party, gabineteNome, tipo, campanhaId: requestedCampanhaId, filtros }: {
      titulo: string; party?: string; gabineteNome?: string; tipo?: string; campanhaId?: string;
      filtros?: {
        colaboradorId?: string; coordenadorId?: string; assessorId?: string;
        cidade?: string; estado?: string; bairro?: string;
        grauApoio?: string; search?: string; dataInicio?: string; dataFim?: string;
      };
    } = body;

    // Admins exportam qualquer campanha; demais usuários precisam de campanhaId válido
    if (!["super_admin", "admin_master"].includes(userRole)) {
      if (!userCampanhaId) {
        return NextResponse.json({ error: "Sem campanha associada" }, { status: 403 });
      }
      if (requestedCampanhaId && requestedCampanhaId !== userCampanhaId) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
    }

    // Determina a campanha efetiva e consulta Firestore server-side
    // O array do cliente é descartado — o servidor é a única fonte de verdade.
    const effectiveCampanhaId = ["super_admin", "admin_master"].includes(userRole)
      ? (requestedCampanhaId || userCampanhaId)
      : userCampanhaId;

    if (!effectiveCampanhaId) {
      return NextResponse.json({ error: "Campanha não identificada" }, { status: 400 });
    }

    // Aplica filtro indexado (apenas o mais específico, para usar o índice composto certo)
    const baseQ = adminDb.collection("eleitores").where("campanhaId", "==", effectiveCampanhaId);
    const indexedQ = filtros?.colaboradorId
      ? baseQ.where("colaboradorId",  "==", filtros.colaboradorId)
      : filtros?.coordenadorId
      ? baseQ.where("coordenadorId",  "==", filtros.coordenadorId)
      : filtros?.assessorId
      ? baseQ.where("assessorId",     "==", filtros.assessorId)
      : baseQ;
    // Timeout de 12s para não pendurar o serverless quando Firestore tiver cota esgotada
    const snap = await Promise.race([
      indexedQ.orderBy("criadoEm", "desc").get(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(Object.assign(new Error("query_timeout"), { code: "timeout" })), 12_000)
      ),
    ]);

    let eleitores: EleitorData[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        nomeCompleto:    (data.nomeCompleto || data.nome || "") as string,
        telefone:        data.telefone,
        tipoDocumento:   data.tipoDocumento,
        documento:       (data.documento || "") as string,
        estado:          (data.estado || "") as string,
        cidade:          (data.cidade || "") as string,
        bairro:          data.bairro,
        grauApoio:       (data.grauApoio || "indeciso") as string,
        voto:            data.voto,
        colaboradorNome: (data.colaboradorNome || "") as string,
        coordenadorId:   data.coordenadorId,
        coordenadorNome: data.coordenadorNome,
        criadoEm:        data.criadoEm,
      };
    });

    // Filtros in-memory (campos não indexados ou combinações)
    if (filtros?.cidade)    eleitores = eleitores.filter((e) => e.cidade    === filtros!.cidade);
    if (filtros?.estado)    eleitores = eleitores.filter((e) => e.estado    === filtros!.estado);
    if (filtros?.bairro)    eleitores = eleitores.filter((e) => e.bairro    === filtros!.bairro);
    if (filtros?.grauApoio) eleitores = eleitores.filter((e) => e.grauApoio === filtros!.grauApoio);
    if (filtros?.search) {
      const s = filtros.search.toLowerCase();
      eleitores = eleitores.filter((e) =>
        e.nomeCompleto.toLowerCase().includes(s) || e.cidade.toLowerCase().includes(s)
      );
    }
    if (filtros?.dataInicio) {
      const inicio = new Date(filtros.dataInicio);
      eleitores = eleitores.filter((e) => {
        const d: Date = e.criadoEm?.toDate?.() ?? new Date(e.criadoEm ?? 0);
        return d >= inicio;
      });
    }
    if (filtros?.dataFim) {
      const fim = new Date(filtros.dataFim);
      fim.setHours(23, 59, 59, 999);
      eleitores = eleitores.filter((e) => {
        const d: Date = e.criadoEm?.toDate?.() ?? new Date(e.criadoEm ?? 0);
        return d <= fim;
      });
    }

    // ── EXECUTIVO format ─────────────────────────────────────────────────────
    if (tipo === "executivo") {
      const wb = new ExcelJS.Workbook();
      wb.creator  = "Eleitores 2026";
      wb.created  = new Date();

      const nome = gabineteNome || titulo;
      buildExecutivoSheet(wb, eleitores, nome);
      buildResumoSheet(wb, eleitores, nome);
      buildEleitoresSheet(wb, eleitores);
      buildCoordenadoresSheet(wb, eleitores);
      buildTerritoriosSheet(wb, eleitores);
      buildFilteredSheet(wb, "Oportunidades", "FF1E3A8A", eleitores, (e) => e.grauApoio === "indeciso");
      buildFilteredSheet(wb, "Atenção", "FF7F1D1D", eleitores, (e) => e.grauApoio === "fraco");

      const buf = await wb.xlsx.writeBuffer();
      const date = new Date().toISOString().split("T")[0];
      return new NextResponse(Buffer.from(buf as ArrayBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="relatorio-executivo-${date}.xlsx"`,
        },
      });
    }

    // ── ORIGINAL format (unchanged) ──────────────────────────────────────────
    const c = getColors(party);
    const wb = new ExcelJS.Workbook();
    wb.creator = "Eleitores 2026";
    wb.created = new Date();

    const ws = wb.addWorksheet("Resumo Executivo", { views: [{ showGridLines: false }] });
    ws.columns = [{ width: 5 }, { width: 38 }, { width: 28 }, { width: 28 }, { width: 28 }, { width: 28 }];

    const verde = "059669"; const verdeEscuro = "065F46"; const branco = "FFFFFF";
    const cinzaTexto = "6B7280"; const textoPrincipal = "1F2937";

    for (let cc = 1; cc <= 6; cc++) {
      const cell = ws.getCell(1, cc);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.p } } as ExcelJS.Fill;
      cell.font = { name: "Calibri", size: 18, bold: true, color: { argb: branco } };
      cell.alignment = { vertical: "middle" };
      cell.border = { bottom: { style: "medium", color: { argb: c.s } } };
    }
    ws.mergeCells(1, 1, 1, 6);
    ws.getCell(1, 1).value = `  RELATÓRIO EXECUTIVO — ${c.nome.toUpperCase()}`;
    ws.getRow(1).height = 50;

    for (let cc = 1; cc <= 6; cc++) {
      const cell = ws.getCell(2, cc);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.s } } as ExcelJS.Fill;
      cell.font = { name: "Calibri", size: 10, color: { argb: branco } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    }
    ws.mergeCells(2, 1, 2, 6);
    ws.getCell(2, 1).value = `${titulo}  •  ${new Date().toLocaleString("pt-BR")}  •  ${c.nome}`;
    ws.getRow(2).height = 28;

    const fortes = eleitores.filter((e) => e.grauApoio === "forte").length;
    const medios = eleitores.filter((e) => e.grauApoio === "medio").length;
    const fracos = eleitores.filter((e) => e.grauApoio === "fraco").length;
    const indecisos = eleitores.filter((e) => e.grauApoio === "indeciso").length;

    const headers = ["Nome", "Telefone", "Documento", "UF", "Cidade", "Grau", "Voto", "Colaborador", "Data"];
    let tr = 5;
    headers.forEach((h, i) => {
      const cell = ws.getCell(tr, i + 1);
      cell.value = h;
      cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: branco } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.p } } as ExcelJS.Fill;
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    tr++;

    eleitores.forEach((e, i) => {
      const bg = i % 2 === 0 ? branco : c.b;
      const row = [e.nomeCompleto, e.telefone || "-", `${(e.tipoDocumento || "").toUpperCase()}: ${e.documento}`, e.estado, e.cidade, e.grauApoio, e.voto || "-", e.colaboradorNome, dataStr(e)];
      row.forEach((val, j) => {
        const cell = ws.getCell(tr, j + 1);
        cell.value = val;
        cell.font = { name: "Calibri", size: 9, color: { argb: textoPrincipal } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } } as ExcelJS.Fill;
        cell.border = { bottom: { style: "thin", color: { argb: "E5E7EB" } } };
      });
      tr++;
    });

    const ws2 = wb.addWorksheet("Estatísticas", { views: [{ showGridLines: false }] });
    ws2.columns = [{ width: 20 }, { width: 18 }, { width: 18 }];
    for (let cc = 1; cc <= 3; cc++) {
      const cell = ws2.getCell(1, cc);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.p } } as ExcelJS.Fill;
      cell.font = { name: "Calibri", size: 14, bold: true, color: { argb: branco } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    }
    ws2.mergeCells(1, 1, 1, 3);
    ws2.getCell(1, 1).value = `  ESTATÍSTICAS — ${c.nome.toUpperCase()}`;
    ws2.getRow(1).height = 40;
    ws2.getCell(4, 1).value = "DISTRIBUIÇÃO POR GRAU DE APOIO";
    ws2.getCell(4, 1).font = { name: "Calibri", size: 10, bold: true, color: { argb: c.p } };
    const total = eleitores.length || 1;
    [["Forte", fortes], ["Médio", medios], ["Fraco", fracos], ["Indeciso", indecisos]].forEach(([label, val], i) => {
      const r = 6 + i;
      ws2.getCell(r, 1).value = label; ws2.getCell(r, 1).font = { name: "Calibri", size: 9, bold: true, color: { argb: c.p } };
      ws2.getCell(r, 2).value = val;   ws2.getCell(r, 2).font = { name: "Calibri", size: 9, color: { argb: "1F2937" } }; ws2.getCell(r, 2).alignment = { horizontal: "center" };
      ws2.getCell(r, 3).value = `${Math.round(((val as number) / total) * 100)}%`; ws2.getCell(r, 3).font = { name: "Calibri", size: 9, color: { argb: cinzaTexto } }; ws2.getCell(r, 3).alignment = { horizontal: "center" };
    });

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buf as ArrayBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="relatorio-${c.nome.toLowerCase().replace(/\s/g, "-")}.xlsx"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota") || msg.includes("query_timeout")) {
      return NextResponse.json(
        { error: "Base de dados temporariamente indisponível. Tente novamente em alguns minutos." },
        { status: 503 }
      );
    }
    console.error("Erro ao gerar Excel:", error);
    return NextResponse.json({ error: `Erro ao gerar Excel: ${msg.slice(0, 300)}` }, { status: 500 });
  }
}

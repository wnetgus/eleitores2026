import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { Eleitor } from "@/types";

export interface PartyColors {
  p: string; s: string; a: string; b: string; d: string; nome: string;
}

export const PARTY_PRESETS: Record<string, PartyColors> = {
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
  "PV": { p: "16A34A", s: "15803D", a: "DCFCE7", b: "F0FDF4", d: "14532D", nome: "PV" },
  "CIDADANIA": { p: "0284C7", s: "0369A1", a: "E0F2FE", b: "F0F9FF", d: "0C4A6E", nome: "Cidadania" },
  "SOLIDARIEDADE": { p: "7C3AED", s: "6D28D9", a: "EDE9FE", b: "F5F3FF", d: "4C1D95", nome: "Solidariedade" },
  "PSC": { p: "0F766E", s: "115E59", a: "CCFBF1", b: "F0FDFA", d: "134E4A", nome: "PSC" },
  "PODE": { p: "7C2D12", s: "6C2A12", a: "FED7AA", b: "FFF7ED", d: "4A1D0F", nome: "Podemos" },
  "AVANTE": { p: "0D9488", s: "0F766E", a: "CCFBF1", b: "F0FDFA", d: "134E4A", nome: "Avante" },
  "PCB": { p: "991B1B", s: "7F1D1D", a: "FEE2E2", b: "FEF2F2", d: "450A0A", nome: "PCB" },
  "PCO": { p: "B91C1C", s: "991B1B", a: "FEE2E2", b: "FEF2F2", d: "7F1D1D", nome: "PCO" },
  "DC": { p: "1D4ED8", s: "1E3A8A", a: "DBEAFE", b: "EFF6FF", d: "172554", nome: "Democracia Cristã" },
  "NOVO": { p: "0891B2", s: "0E7490", a: "CFFAFE", b: "ECFEFF", d: "164E63", nome: "NOVO" },
  "PMN": { p: "D97706", s: "B45309", a: "FEF3C7", b: "FFFBEB", d: "78350F", nome: "PMN" },
  "PSB": { p: "C0263D", s: "9F2238", a: "FEE2E2", b: "FEF2F2", d: "7F1D1D", nome: "PSB" },
  "REDE": { p: "059669", s: "065F46", a: "D1FAE5", b: "ECFDF5", d: "064E3B", nome: "Rede" },
  "UP": { p: "B91C1C", s: "991B1B", a: "FEE2E2", b: "FEF2F2", d: "7F1D1D", nome: "Unidade Popular" },
};

const DEFAULT_COLORS: PartyColors = { p: "059669", s: "065F46", a: "D1FAE5", b: "ECFDF5", d: "064E3B", nome: "Gabinete" };

export function getPartyColors(party?: string): PartyColors {
  if (!party) return DEFAULT_COLORS;
  return PARTY_PRESETS[party.toUpperCase()] || DEFAULT_COLORS;
}

function hexToRgb(hex: string) {
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
}

function dataStr(e: Eleitor): string {
  if (!e.criadoEm) return "-";
  const d = (e.criadoEm as any).seconds ? new Date((e.criadoEm as any).seconds * 1000) : new Date(e.criadoEm);
  return d.toLocaleDateString("pt-BR");
}

// ==================== EXCEL (SheetJS com estrutura melhorada) ====================
export function exportExcelPremium(eleitores: Eleitor[], titulo: string, party?: string) {
  const c = getPartyColors(party);

  const header = [
    [`RELATÓRIO EXECUTIVO — ${c.nome.toUpperCase()}`],
    [`${titulo}  •  ${new Date().toLocaleString("pt-BR")}`],
    [],
    ["Nome", "Telefone", "Documento", "Estado", "Cidade", "Bairro", "Grau de Apoio", "Intenção de Voto", "Colaborador", "Data Cadastro"],
  ];

  const naoInfo = "Não informado";
  const rows = eleitores.map((e) => [
    e.nomeCompleto,
    e.telefone || naoInfo,
    e.documento ? `${e.tipoDocumento?.toUpperCase()}: ${e.documento}` : naoInfo,
    e.estado || naoInfo, e.cidade || naoInfo, e.bairro || naoInfo,
    e.grauApoio, e.voto || naoInfo, e.colaboradorNome, dataStr(e),
  ]);

  const fortes = eleitores.filter((e) => e.grauApoio === "forte").length;
  const medios = eleitores.filter((e) => e.grauApoio === "medio").length;
  const fracos = eleitores.filter((e) => e.grauApoio === "fraco").length;
  const indecisos = eleitores.filter((e) => e.grauApoio === "indeciso").length;

  const footer = [
    [],
    [`Total de registros: ${eleitores.length}`],
    [`Fortes: ${fortes}  |  Médios: ${medios}  |  Fracos: ${fracos}  |  Indecisos: ${indecisos}`],
    [""],
    ["Eleitores 2026 — Plataforma de Gestão Política"],
  ];

  const fullData = [...header, ...rows, ...footer];
  const ws = XLSX.utils.aoa_to_sheet(fullData);

  // Mesclar título
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
  ];

  ws["!cols"] = [
    { wch: 28 }, { wch: 18 }, { wch: 24 }, { wch: 8 }, { wch: 20 },
    { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 20 }, { wch: 16 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Eleitores");
  XLSX.writeFile(wb, `relatorio-${c.nome.toLowerCase().replace(/\s/g, "-")}.xlsx`);
}

// ==================== PDF (jsPDF com capa, cores e tabela) ====================
export function exportPDFPremium(eleitores: Eleitor[], titulo: string, party?: string, gabineteNome?: string, politicoNome?: string, cargo?: string) {
  const c = getPartyColors(party);
  const prim = hexToRgb(c.p);
  const drk = hexToRgb(c.d);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // CAPA
  doc.setFillColor(prim.r, prim.g, prim.b);
  doc.rect(0, 0, pw, 80, "F");
  doc.setFillColor(drk.r, drk.g, drk.b);
  doc.rect(0, 75, pw, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO EXECUTIVO", pw / 2, 35, { align: "center" });
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(c.nome, pw / 2, 48, { align: "center" });
  doc.setFontSize(11);
  doc.text(titulo, pw / 2, 62, { align: "center" });

  doc.setDrawColor(200, 200, 200);
  doc.line(30, 95, pw - 30, 95);
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(gabineteNome || titulo, pw / 2, 115, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (politicoNome) doc.text(politicoNome, pw / 2, 128, { align: "center" });
  if (cargo) doc.text(cargo, pw / 2, 138, { align: "center" });
  doc.text(`${eleitores.length} eleitores cadastrados`, pw / 2, politicoNome && cargo ? 148 : 138, { align: "center" });

  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pw / 2, 165, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text("Eleitores 2026 — Plataforma de Gestão Política", pw / 2, ph - 20, { align: "center" });

  // PÁGINA 2 — Tabela
  doc.addPage();
  doc.setFillColor(prim.r, prim.g, prim.b);
  doc.rect(0, 0, pw, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("RELAÇÃO DE ELEITORES", 14, 16);
  doc.setFontSize(9);
  doc.text(gabineteNome || titulo, 14, 26);
  doc.text(`Total: ${eleitores.length} registros`, pw - 14, 26, { align: "right" });

  let yt = 50;
  doc.setFillColor(prim.r, prim.g, prim.b);
  doc.rect(14, yt, pw - 28, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  ["Nome", "Telefone", "Documento", "Grau", "Voto", "Colab."].forEach((h, i) => doc.text(h, [14, 56, 88, 120, 146, 178][i] + 2, yt + 5.5));
  yt += 9;
  doc.setFont("helvetica", "normal");
  eleitores.forEach((e, i) => {
    if (yt > ph - 20) { doc.addPage(); yt = 20; }
    if (i % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(14, yt, pw - 28, 7, "F"); }
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(7);
    doc.text(e.nomeCompleto, 16, yt + 4.5);
    doc.text(e.telefone || "-", 58, yt + 4.5);
    doc.text(`${e.tipoDocumento?.toUpperCase()}: ${e.documento}`, 88, yt + 4.5);
    doc.text(e.grauApoio, 124, yt + 4.5, { align: "center" });
    doc.text(e.voto || "-", 150, yt + 4.5);
    doc.text(e.colaboradorNome, 180, yt + 4.5);
    yt += 7.5;
  });

  const ry = ph - 25;
  doc.setDrawColor(200, 200, 200);
  doc.line(14, ry, pw - 14, ry);
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.text("Eleitores 2026 — Plataforma de Gestão Política", 14, ry + 6);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pw - 14, ry + 6, { align: "right" });

  doc.save(`relatorio-${c.nome.toLowerCase().replace(/\s/g, "-")}.pdf`);
}

// ==================== RELATÓRIO EXECUTIVO 6 PÁGINAS ====================
export function exportRelatorioExecutivo(
  eleitores: Eleitor[],
  titulo: string,
  party?: string,
  gabineteNome?: string,
  politicoNome?: string,
  cargo?: string,
  crescimento?: string,
  topCidades?: { cidade: string; total: number }[],
  topColaboradores?: { nome: string; total: number }[],
  metaProgresso?: string,
) {
  const c = getPartyColors(party);
  const prim = hexToRgb(c.p);
  const drk = hexToRgb(c.d);

  // ── Compute all stats from eleitores ──────────────────────────────────────
  const agora30d = Date.now() - 30 * 86400e3;
  let fortes = 0, medios = 0, indecisos = 0, fracos = 0, recentes = 0;
  const coordMap = new Map<string, { nome: string; total: number; fortes: number; medios: number; indecisos: number; fracos: number; recentes: number }>();
  const terrMap  = new Map<string, { label: string; total: number; indecisos: number; fracos: number; recentes: number }>();

  for (const e of eleitores) {
    if (e.grauApoio === "forte")         fortes++;
    else if (e.grauApoio === "medio")    medios++;
    else if (e.grauApoio === "indeciso") indecisos++;
    else if (e.grauApoio === "fraco")    fracos++;
    const ts = (e.criadoEm as any)?.seconds ? (e.criadoEm as any).seconds * 1000 : e.criadoEm ? new Date(e.criadoEm).getTime() : 0;
    if (ts > agora30d) recentes++;
    const cid = e.coordenadorId || "";
    const cnome = e.coordenadorNome || "";
    if (cid && cnome) {
      if (!coordMap.has(cid)) coordMap.set(cid, { nome: cnome, total: 0, fortes: 0, medios: 0, indecisos: 0, fracos: 0, recentes: 0 });
      const ct = coordMap.get(cid)!;
      ct.total++;
      if (e.grauApoio === "forte")         ct.fortes++;
      else if (e.grauApoio === "medio")    ct.medios++;
      else if (e.grauApoio === "indeciso") ct.indecisos++;
      else if (e.grauApoio === "fraco")    ct.fracos++;
      if (ts > agora30d)                   ct.recentes++;
    }
    const key   = `${e.bairro}||${e.cidade}`;
    const label = e.bairro ? `${e.bairro} · ${e.cidade}` : e.cidade;
    if (!terrMap.has(key)) terrMap.set(key, { label, total: 0, indecisos: 0, fracos: 0, recentes: 0 });
    const t = terrMap.get(key)!;
    t.total++;
    if (e.grauApoio === "indeciso") t.indecisos++;
    if (e.grauApoio === "fraco")    t.fracos++;
    if (ts > agora30d)              t.recentes++;
  }

  const coordList  = Array.from(coordMap.values()).sort((a, b) => b.total - a.total);
  const terrList   = Array.from(terrMap.values()).sort((a, b) => b.total - a.total);
  const crescList  = [...terrList].filter(t => t.recentes > 0).sort((a, b) => b.recentes - a.recentes);
  const indecList  = [...terrList].filter(t => t.indecisos > 0).sort((a, b) => (b.indecisos / b.total) - (a.indecisos / a.total));
  const fracosList = [...terrList].filter(t => t.fracos > 0).sort((a, b) => (b.fracos / b.total) - (a.fracos / a.total));

  // ── jsPDF setup ───────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const gNome = gabineteNome || titulo;
  const total = eleitores.length;
  const dataGeracao = new Date().toLocaleString("pt-BR");
  const dataSimples = new Date().toLocaleDateString("pt-BR");

  function pageHeader(title: string, subtitle?: string) {
    doc.setFillColor(prim.r, prim.g, prim.b);
    doc.rect(0, 0, pw, 26, "F");
    doc.setFillColor(drk.r, drk.g, drk.b);
    doc.rect(0, 22, pw, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(title, 14, 15);
    if (subtitle) {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(subtitle, pw - 14, 15, { align: "right" });
    }
  }

  function pageFooter(pageNum: number) {
    const fy = ph - 9;
    doc.setDrawColor(215, 215, 215);
    doc.setLineWidth(0.2);
    doc.line(14, fy - 1, pw - 14, fy - 1);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(170, 170, 170);
    doc.text("Eleitores 2026 — Plataforma de Gestão Política", 14, fy + 4);
    doc.text(`${pageNum} / 6`, pw - 14, fy + 4, { align: "right" });
  }

  // ════════════════════════════════════════════
  // PAGE 1 — CAPA
  // ════════════════════════════════════════════

  // Derive dominant city & state for territory line
  const cidFreqC = new Map<string, number>();
  const estFreqC = new Map<string, number>();
  for (const e of eleitores) {
    cidFreqC.set(e.cidade, (cidFreqC.get(e.cidade) || 0) + 1);
    estFreqC.set(e.estado, (estFreqC.get(e.estado) || 0) + 1);
  }
  const capaCidade = eleitores.length > 0 ? ([...cidFreqC.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "").toUpperCase() : "";
  const capaEstado = eleitores.length > 0 ? ([...estFreqC.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "").toUpperCase() : "";
  const territorioLine = [capaCidade, capaEstado].filter(Boolean).join(" · ");

  const MESES_PT = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
  const capaMesAno = `${MESES_PT[new Date().getMonth()]} ${new Date().getFullYear()}`;

  const capaTop = Math.round(ph * 0.58);

  // Full colored background
  doc.setFillColor(prim.r, prim.g, prim.b);
  doc.rect(0, 0, pw, capaTop, "F");
  doc.setFillColor(drk.r, drk.g, drk.b);
  doc.rect(0, capaTop - 10, pw, 10, "F");

  // ── Header identifier: GABINETE [NOME] ────────────────────────────────────
  doc.setTextColor(255, 255, 255);
  const capaIdentif = politicoNome
    ? `GABINETE ${politicoNome.toUpperCase()}`
    : `GABINETE ${gNome.toUpperCase()}`;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(capaIdentif, pw / 2, 15, { align: "center" });
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.2);
  doc.line(pw / 2 - 35, 17.5, pw / 2 + 35, 17.5);

  // ── Main title ─────────────────────────────────────────────────────────────
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  const titleCapaLines = doc.splitTextToSize("RELATÓRIO EXECUTIVO TERRITORIAL", pw - 36) as string[];
  const titleCapaY = 35;
  doc.text(titleCapaLines, pw / 2, titleCapaY, { align: "center", lineHeightFactor: 1.3 });
  const afterTitleCapa = titleCapaY + titleCapaLines.length * 10;

  // ── Territory: CIDADE · ESTADO ─────────────────────────────────────────────
  if (territorioLine) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255);
    doc.text(territorioLine, pw / 2, afterTitleCapa + 10, { align: "center" });
  }

  // ── Month / Year ───────────────────────────────────────────────────────────
  const capaDateY = afterTitleCapa + (territorioLine ? 20 : 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(215, 222, 238);
  doc.text(capaMesAno, pw / 2, capaDateY, { align: "center" });

  // ── Thin divider ───────────────────────────────────────────────────────────
  const subDivY = capaDateY + 8;
  doc.setDrawColor(195, 208, 230);
  doc.setLineWidth(0.15);
  doc.line(pw / 2 - 48, subDivY, pw / 2 + 48, subDivY);

  // ── Frase executiva (italic) ───────────────────────────────────────────────
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(205, 218, 238);
  const subtitleText = "Panorama da base eleitoral, desempenho territorial e inteligência regional.";
  const subtitleLines = doc.splitTextToSize(subtitleText, pw - 50) as string[];
  doc.text(subtitleLines, pw / 2, subDivY + 8, { align: "center", lineHeightFactor: 1.4 });
  const afterSubtitle = subDivY + 8 + subtitleLines.length * 6.5;

  // ── Político & cargo ───────────────────────────────────────────────────────
  if (politicoNome) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255);
    doc.text(politicoNome, pw / 2, afterSubtitle + 10, { align: "center" });
  }
  if (cargo) {
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(198, 210, 230);
    doc.text(cargo, pw / 2, afterSubtitle + (politicoNome ? 18 : 10), { align: "center" });
  }

  // ── White section: total + stat cards ─────────────────────────────────────
  doc.setTextColor(75, 80, 90);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Total de eleitores cadastrados", pw / 2, capaTop + 13, { align: "center" });
  doc.setFontSize(40);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(prim.r, prim.g, prim.b);
  doc.text(total.toString(), pw / 2, capaTop + 30, { align: "center" });

  const qsItems = [
    { label: "Fortes",    val: `${fortes}`,    color: hexToRgb("059669") },
    { label: "Indecisos", val: `${indecisos}`, color: hexToRgb("3B82F6") },
    { label: "Fracos",    val: `${fracos}`,    color: hexToRgb("DC2626") },
    { label: "Recentes",  val: `+${recentes}`, color: hexToRgb("7C3AED") },
  ];
  const qsW = (pw - 28 - 9) / 4;
  const qsY = capaTop + 40;
  let qsX = 14;
  qsItems.forEach(q => {
    doc.setFillColor(247, 249, 252);
    doc.setDrawColor(215, 220, 228);
    doc.roundedRect(qsX, qsY, qsW, 20, 2, 2, "FD");
    doc.setTextColor(140, 145, 150);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(q.label, qsX + qsW / 2, qsY + 7, { align: "center" });
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(q.color.r, q.color.g, q.color.b);
    doc.text(q.val, qsX + qsW / 2, qsY + 15.5, { align: "center" });
    qsX += qsW + 3;
  });

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(170, 175, 180);
  doc.text(`Gerado em: ${dataGeracao}`, pw / 2, qsY + 28, { align: "center" });

  doc.setFillColor(prim.r, prim.g, prim.b);
  doc.rect(0, ph - 10, pw, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.text("Eleitores 2026 — Plataforma de Gestão Política", pw / 2, ph - 3, { align: "center" });

  // ════════════════════════════════════════════
  // PAGE 2 — RESUMO EXECUTIVO (8 KPI cards)
  // ════════════════════════════════════════════
  doc.addPage();
  pageHeader("RESUMO EXECUTIVO", `${gNome}  ·  ${dataSimples}`);

  const kpis = [
    { label: "Total de Eleitores", value: total,           sub: "base completa",         color: prim },
    { label: "Apoio Forte",        value: fortes,          sub: `${total > 0 ? Math.round((fortes/total)*100) : 0}% da base`,  color: hexToRgb("059669") },
    { label: "Apoio Médio",        value: medios,          sub: `${total > 0 ? Math.round((medios/total)*100) : 0}% da base`,  color: hexToRgb("D97706") },
    { label: "Indecisos",          value: indecisos,       sub: "potencial a converter", color: hexToRgb("3B82F6") },
    { label: "Rejeição",           value: fracos,          sub: `${total > 0 ? Math.round((fracos/total)*100) : 0}% da base`,  color: hexToRgb("DC2626") },
    { label: "Crescimento 30d",    value: recentes,        sub: "novos cadastros",       color: hexToRgb("7C3AED") },
    { label: "Coordenadores",      value: coordList.length,sub: "equipes ativas",        color: hexToRgb("F97316") },
    { label: "Territórios",        value: terrList.length, sub: "áreas cobertas",        color: hexToRgb("0284C7") },
  ];

  const cW = (pw - 28 - 3 * 5) / 4;
  const cH = 38;
  const cX0 = 14, cY0 = 36, cGX = 5, cGY = 8;

  kpis.forEach((kpi, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const cx = cX0 + col * (cW + cGX);
    const cy = cY0 + row * (cH + cGY);

    doc.setFillColor(247, 249, 252);
    doc.setDrawColor(210, 215, 225);
    doc.roundedRect(cx, cy, cW, cH, 2, 2, "FD");
    doc.setFillColor(kpi.color.r, kpi.color.g, kpi.color.b);
    doc.rect(cx, cy, 3.5, cH, "F");

    doc.setTextColor(140, 145, 150);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(kpi.label.toUpperCase(), cx + 7, cy + 10);

    doc.setTextColor(kpi.color.r, kpi.color.g, kpi.color.b);
    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    doc.text(kpi.value.toString(), cx + 7, cy + 29);

    doc.setTextColor(170, 175, 182);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text(kpi.sub, cx + 7, cy + 35);
  });

  pageFooter(2);

  // ════════════════════════════════════════════
  // PAGE 3 — DISTRIBUIÇÃO TERRITORIAL
  // ════════════════════════════════════════════
  doc.addPage();
  pageHeader("DISTRIBUIÇÃO TERRITORIAL", `${terrList.length} territórios · ${total} eleitores`);

  let y3 = 36;
  const barX3 = 116, barW3max = 62;
  const maxTotal3 = terrList.length > 0 ? terrList[0].total : 1;

  doc.setFillColor(232, 235, 242);
  doc.rect(14, y3, pw - 28, 8, "F");
  doc.setTextColor(75, 80, 92);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("Território", 16, y3 + 5.5);
  doc.text("Total", 109, y3 + 5.5, { align: "right" });
  doc.text("Volume", barX3 + barW3max / 2, y3 + 5.5, { align: "center" });
  doc.text("%", pw - 14, y3 + 5.5, { align: "right" });
  y3 += 9;

  terrList.slice(0, 22).forEach((t, i) => {
    if (y3 > ph - 22) return;
    if (i % 2 === 1) { doc.setFillColor(247, 248, 252); doc.rect(14, y3, pw - 28, 9, "F"); }
    const pctBar = Math.max(1, Math.round((t.total / maxTotal3) * barW3max));
    const pct3 = total > 0 ? Math.round((t.total / total) * 100) : 0;
    const hasCresc = t.recentes > 0;

    doc.setTextColor(48, 54, 68);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", hasCresc ? "bold" : "normal");
    doc.text(t.label, 16, y3 + 6.2);
    if (hasCresc) {
      doc.setFillColor(16, 185, 129);
      doc.rect(111, y3 + 3.2, 3, 3, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.text(t.total.toString(), 109, y3 + 6.2, { align: "right" });

    doc.setFillColor(210, 220, 235);
    doc.rect(barX3, y3 + 2, barW3max, 5, "F");
    doc.setFillColor(prim.r, prim.g, prim.b);
    doc.rect(barX3, y3 + 2, pctBar, 5, "F");

    doc.setTextColor(55, 60, 72);
    doc.text(`${pct3}%`, pw - 14, y3 + 6.2, { align: "right" });
    y3 += 9;
  });

  if (crescList.length > 0 && y3 < ph - 26) {
    y3 += 5;
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(160, 215, 190);
    doc.roundedRect(14, y3, pw - 28, 14, 2, 2, "FD");
    doc.setTextColor(6, 95, 70);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    const crescMsg = `+ Maior crescimento: ${crescList[0].label} — +${crescList[0].recentes} novos cadastros nos últimos 30 dias`;
    doc.text(doc.splitTextToSize(crescMsg, pw - 42), 18, y3 + 9);
  }

  pageFooter(3);

  // ════════════════════════════════════════════
  // PAGE 4 — RANKING DA EQUIPE
  // ════════════════════════════════════════════
  doc.addPage();
  const coordLabel = coordList.length !== 1 ? `${coordList.length} coordenadores` : "1 coordenador";
  pageHeader("RANKING DA EQUIPE", coordLabel);

  const CARD_H   = 22;
  const RANK_X   = 31;
  const RANK_BAR_MAX_W = pw - 44;
  const maxTotal4  = coordList.length > 0 ? coordList[0].total : 1;
  const green4     = hexToRgb("059669");
  const badgeColors4 = [hexToRgb("D97706"), hexToRgb("64748B"), hexToRgb("92400E")];

  // Pre-compute destaque so we know its height before the loop
  const top4 = coordList.length > 0 ? coordList[0] : null;
  const pctFTop4 = top4 && top4.total > 0 ? Math.round((top4.fortes / top4.total) * 100) : 0;
  const destaqueText4 = top4
    ? `${top4.nome} lidera a equipe com ${top4.total} eleitores cadastrados e ${pctFTop4}% de base forte.`
    : "";
  const destaqueLines4 = top4 ? (doc.splitTextToSize(destaqueText4, pw - 52) as string[]) : [] as string[];
  const destaqueH4 = Math.max(18, destaqueLines4.length * 5 + 14);

  let y4 = 34;
  let destaqueRendered = false;

  coordList.slice(0, 9).forEach((coord, i) => {
    // Insert destaque block inline after the 3rd card (before 4th)
    if (i === 3 && !destaqueRendered && top4 && y4 < ph - 50) {
      doc.setFillColor(drk.r, drk.g, drk.b);
      doc.rect(14, y4, pw - 28, 6, "F");
      doc.setFillColor(prim.r, prim.g, prim.b);
      doc.rect(14, y4 + 6, pw - 28, destaqueH4 - 6, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.text("COORDENADOR DESTAQUE", 20, y4 + 4.5);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(destaqueLines4, 20, y4 + 12);
      y4 += destaqueH4 + 4;
      destaqueRendered = true;
    }

    if (y4 + CARD_H > ph - 18) return;

    const isTop1 = i === 0;

    // Card background
    if (isTop1) {
      doc.setFillColor(255, 250, 240);
      doc.rect(14, y4, pw - 28, CARD_H, "F");
      doc.setDrawColor(251, 191, 36);
      doc.setLineWidth(0.4);
      doc.line(14, y4 + CARD_H, pw - 14, y4 + CARD_H);
      doc.setLineWidth(0.2);
    } else if (i % 2 === 1) {
      doc.setFillColor(248, 249, 252);
      doc.rect(14, y4, pw - 28, CARD_H, "F");
    }

    // Badge circle
    const bc = i < 3 ? badgeColors4[i] : hexToRgb("94A3B8");
    doc.setFillColor(bc.r, bc.g, bc.b);
    doc.circle(21, y4 + 8, 5.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text(`#${i + 1}`, 21, y4 + 10, { align: "center" });

    // Name
    doc.setFontSize(isTop1 ? 10 : 9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(isTop1 ? 120 : 35, isTop1 ? 53 : 40, isTop1 ? 15 : 55);
    doc.text(coord.nome, RANK_X, y4 + 9);

    // % forte — right side, color-coded
    const pctForte = coord.total > 0 ? Math.round((coord.fortes / coord.total) * 100) : 0;
    const pctColor = pctForte >= 50 ? green4 : pctForte >= 30 ? hexToRgb("D97706") : hexToRgb("DC2626");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(pctColor.r, pctColor.g, pctColor.b);
    doc.text(`${pctForte}% forte`, pw - 14, y4 + 9, { align: "right" });

    // Stats line
    const recentWord = coord.recentes === 1 ? "novo" : "novos";
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 115, 125);
    doc.text(`${coord.total} eleitores   ${coord.fortes} fortes   +${coord.recentes} ${recentWord}`, RANK_X, y4 + 15.5);

    // Bar: length = proportional to total, green = fortes portion
    const bwTotal = Math.max(2, Math.round((coord.total / maxTotal4) * RANK_BAR_MAX_W));
    const bwForte = coord.total > 0 ? Math.max(0, Math.round((coord.fortes / coord.total) * bwTotal)) : 0;

    doc.setFillColor(215, 225, 238);
    doc.rect(RANK_X, y4 + 19, RANK_BAR_MAX_W, 2.5, "F");
    doc.setFillColor(green4.r, green4.g, green4.b);
    doc.rect(RANK_X, y4 + 19, bwForte, 2.5, "F");
    doc.setFillColor(prim.r, prim.g, prim.b);
    doc.rect(RANK_X + bwForte, y4 + 19, Math.max(0, bwTotal - bwForte), 2.5, "F");

    y4 += CARD_H + 1;
  });

  // Fallback: render destaque after all cards if fewer than 3 coordinators
  if (!destaqueRendered && top4 && y4 < ph - 40) {
    y4 += 4;
    doc.setFillColor(drk.r, drk.g, drk.b);
    doc.rect(14, y4, pw - 28, 6, "F");
    doc.setFillColor(prim.r, prim.g, prim.b);
    doc.rect(14, y4 + 6, pw - 28, destaqueH4 - 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text("COORDENADOR DESTAQUE", 20, y4 + 4.5);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(destaqueLines4, 20, y4 + 12);
  }

  if (coordList.length === 0) {
    doc.setTextColor(160, 165, 175);
    doc.setFontSize(9);
    doc.text("Nenhum coordenador com eleitores vinculados.", 16, y4 + 10);
  }

  pageFooter(4);

  // ════════════════════════════════════════════
  // PAGE 5 — ANÁLISE ESTRATÉGICA
  // ════════════════════════════════════════════
  doc.addPage();
  pageHeader("ANÁLISE ESTRATÉGICA", "oportunidades · áreas de atenção");

  let y5 = 36;
  const iBarX = pw - 14 - 70 - 22;
  const iBarW = 70;

  // ── Oportunidades ─────────────────────────────────────────────────────────
  doc.setFillColor(hexToRgb("1D4ED8").r, hexToRgb("1D4ED8").g, hexToRgb("1D4ED8").b);
  doc.rect(14, y5, pw - 28, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(`OPORTUNIDADES — ${indecisos} INDECISOS A CONVERTER`, 18, y5 + 6);
  y5 += 10;

  if (indecList.length > 0) {
    const maxIndc = indecList[0].indecisos;
    indecList.slice(0, 8).forEach((t, i) => {
      if (y5 > ph / 2 - 4) return;
      if (i % 2 === 1) { doc.setFillColor(235, 241, 255); doc.rect(14, y5, pw - 28, 9, "F"); }
      const bw5 = Math.max(1, Math.round((t.indecisos / maxIndc) * iBarW));
      const pct5 = Math.round((t.indecisos / t.total) * 100);

      doc.setTextColor(25, 45, 85);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(t.label, 16, y5 + 6.2);

      doc.setFillColor(219, 234, 254);
      doc.rect(iBarX, y5 + 2, iBarW, 5, "F");
      doc.setFillColor(37, 99, 235);
      doc.rect(iBarX, y5 + 2, bw5, 5, "F");

      doc.setTextColor(30, 48, 90);
      doc.text(`${t.indecisos} (${pct5}%)`, pw - 14, y5 + 6.2, { align: "right" });
      y5 += 9;
    });
  } else {
    doc.setTextColor(160, 165, 175);
    doc.setFontSize(8);
    doc.text("Nenhum indeciso registrado na base.", 18, y5 + 8);
    y5 += 14;
  }

  // ── Atenção ───────────────────────────────────────────────────────────────
  y5 = Math.max(y5 + 8, Math.round(ph / 2) + 4);
  const fBarX = pw - 14 - 70 - 22;
  const fBarW = 70;

  doc.setFillColor(hexToRgb("991B1B").r, hexToRgb("991B1B").g, hexToRgb("991B1B").b);
  doc.rect(14, y5, pw - 28, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(`ATENÇÃO — ${fracos} ELEITORES COM REJEIÇÃO`, 18, y5 + 6);
  y5 += 10;

  if (fracosList.length > 0) {
    const maxFracos = fracosList[0].fracos;
    fracosList.slice(0, 8).forEach((t, i) => {
      if (y5 > ph - 18) return;
      if (i % 2 === 1) { doc.setFillColor(255, 238, 238); doc.rect(14, y5, pw - 28, 9, "F"); }
      const bw5 = Math.max(1, Math.round((t.fracos / maxFracos) * fBarW));
      const pct5 = Math.round((t.fracos / t.total) * 100);

      doc.setTextColor(80, 18, 18);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(t.label, 16, y5 + 6.2);

      doc.setFillColor(254, 226, 226);
      doc.rect(fBarX, y5 + 2, fBarW, 5, "F");
      doc.setFillColor(220, 38, 38);
      doc.rect(fBarX, y5 + 2, bw5, 5, "F");

      doc.setTextColor(80, 18, 18);
      doc.text(`${t.fracos} (${pct5}%)`, pw - 14, y5 + 6.2, { align: "right" });
      y5 += 9;
    });
  } else {
    doc.setTextColor(160, 165, 175);
    doc.setFontSize(8);
    doc.text("Nenhuma rejeição registrada na base.", 18, y5 + 8);
  }

  pageFooter(5);

  // ════════════════════════════════════════════
  // PAGE 6 — ANÁLISE NARRATIVA
  // ════════════════════════════════════════════
  doc.addPage();
  pageHeader("ANÁLISE NARRATIVA", "gerado automaticamente");

  const frases: string[] = [];
  if (total > 0) {
    const pctF6 = Math.round((fortes / total) * 100);
    frases.push(`A base eleitoral conta com ${total} eleitores cadastrados, dos quais ${pctF6}% (${fortes}) demonstram apoio forte à campanha.`);
  }
  if (crescList.length > 0) {
    frases.push(`${crescList[0].label} lidera o crescimento regional com +${crescList[0].recentes} novos apoiadores registrados nos últimos 30 dias.`);
  }
  if (recentes > 0 && total > 0) {
    const traction = recentes > total * 0.1 ? "forte" : "moderada";
    frases.push(`O crescimento total da base no período foi de +${recentes} eleitores, indicando ${traction} tração operacional.`);
  }
  if (coordList.length > 0 && total > 0) {
    const pctCoord = Math.round((coordList[0].total / total) * 100);
    frases.push(`${coordList[0].nome} lidera a equipe com ${coordList[0].total} cadastros (${pctCoord}% da base total).`);
  }
  if (indecList.length > 0) {
    const pctIndc = Math.round((indecList[0].indecisos / indecList[0].total) * 100);
    frases.push(`Principal oportunidade: ${indecList[0].label} com ${indecList[0].indecisos} indecisos (${pctIndc}% do território) a converter.`);
  }
  if (fracosList.length > 0 && (fracosList[0].fracos / fracosList[0].total) >= 0.2) {
    const pctRej = Math.round((fracosList[0].fracos / fracosList[0].total) * 100);
    frases.push(`${fracosList[0].label} requer atenção — índice de rejeição de ${pctRej}% indica necessidade de ação de campo.`);
  }
  if (terrList.length > 0 && total > 0) {
    const pctTerr = Math.round((terrList[0].total / total) * 100);
    frases.push(`Cobertura territorial: ${terrList.length} ${terrList.length === 1 ? "território" : "territórios"}, com maior concentração em ${terrList[0].label} (${terrList[0].total} eleitores — ${pctTerr}% da base).`);
  }

  let y6 = 38;
  frases.forEach((frase, i) => {
    const lines = doc.splitTextToSize(frase, pw - 50);
    const boxH = lines.length * 5.5 + 12;
    if (y6 + boxH > ph - 38) return;

    const bg6 = hexToRgb(i % 2 === 0 ? "F8FAFC" : "EEF2FF");
    doc.setFillColor(bg6.r, bg6.g, bg6.b);
    doc.setDrawColor(212, 217, 228);
    doc.roundedRect(14, y6, pw - 28, boxH, 2, 2, "FD");

    doc.setFillColor(prim.r, prim.g, prim.b);
    doc.circle(24, y6 + 7.5, 4.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text((i + 1).toString(), 24, y6 + 9.8, { align: "center" });

    doc.setTextColor(40, 50, 68);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(lines, 33, y6 + 9);
    y6 += boxH + 5;
  });

  if (frases.length === 0) {
    doc.setTextColor(165, 170, 180);
    doc.setFontSize(9);
    doc.text("Dados insuficientes para gerar análise narrativa.", 16, y6 + 10);
  }

  const sigY = ph - 30;
  doc.setFillColor(prim.r, prim.g, prim.b);
  doc.rect(14, sigY, pw - 28, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Eleitores 2026", 20, sigY + 9);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Plataforma de Gestão Política e Inteligência Eleitoral", 20, sigY + 16);
  doc.text(`Gerado em ${dataGeracao}`, pw - 18, sigY + 9, { align: "right" });
  doc.setFontSize(7.5);
  doc.text(gNome, pw - 18, sigY + 16, { align: "right" });

  pageFooter(6);

  doc.save(`executivo-${c.nome.toLowerCase().replace(/\s/g, "-")}.pdf`);
}

// ==================== EXCEL EXECUTIVO — MÚLTIPLAS ABAS ====================
export function exportExcelExecutivo(
  eleitores: Eleitor[],
  titulo: string,
  coordStats: { nome: string; total: number; fortes: number; indecisos: number; fracos: number }[],
  terrStats: { label: string; total: number }[],
) {
  const wb = XLSX.utils.book_new();

  const fortes    = eleitores.filter((e) => e.grauApoio === "forte").length;
  const indecisos = eleitores.filter((e) => e.grauApoio === "indeciso").length;
  const fracos    = eleitores.filter((e) => e.grauApoio === "fraco").length;
  const medios    = eleitores.filter((e) => e.grauApoio === "medio").length;

  // Aba 1 — Resumo
  const resumoData = [
    [`RESUMO EXECUTIVO — ${titulo}`],
    [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
    [],
    ["Indicador", "Valor"],
    ["Total de Eleitores", eleitores.length],
    ["Fortes", fortes],
    ["Médios", medios],
    ["Indecisos", indecisos],
    ["Fracos", fracos],
    ["% Fortes", eleitores.length > 0 ? `${Math.round((fortes / eleitores.length) * 100)}%` : "—"],
    ["% Indecisos", eleitores.length > 0 ? `${Math.round((indecisos / eleitores.length) * 100)}%` : "—"],
    ["Coordenadores ativos", coordStats.length],
    ["Territórios mapeados", terrStats.length],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  wsResumo["!cols"] = [{ wch: 28 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // Aba 2 — Eleitores
  const elHeader = ["Nome", "Telefone", "Estado", "Cidade", "Bairro", "Grau de Apoio", "Coordenador", "Colaborador", "Data Cadastro"];
  const elRows = eleitores.map((e) => [
    e.nomeCompleto, e.telefone || "-", e.estado, e.cidade, e.bairro || "-",
    e.grauApoio, e.coordenadorNome || "-", e.colaboradorNome, dataStr(e),
  ]);
  const wsEl = XLSX.utils.aoa_to_sheet([elHeader, ...elRows]);
  wsEl["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 8 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsEl, "Eleitores");

  // Aba 3 — Coordenadores
  const cHeader = ["Coordenador", "Total", "Fortes", "Indecisos", "Fracos", "% Fortes"];
  const cRows = coordStats.map((c) => [
    c.nome, c.total, c.fortes, c.indecisos, c.fracos,
    c.total > 0 ? `${Math.round((c.fortes / c.total) * 100)}%` : "—",
  ]);
  const wsCoord = XLSX.utils.aoa_to_sheet([cHeader, ...cRows]);
  wsCoord["!cols"] = [{ wch: 26 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsCoord, "Coordenadores");

  // Aba 4 — Territórios
  const tHeader = ["Território", "Total"];
  const tRows = terrStats.map((t) => [t.label, t.total]);
  const wsTerr = XLSX.utils.aoa_to_sheet([tHeader, ...tRows]);
  wsTerr["!cols"] = [{ wch: 30 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsTerr, "Territórios");

  XLSX.writeFile(wb, `base-territorial-${new Date().toISOString().split("T")[0]}.xlsx`);
}

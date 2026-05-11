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

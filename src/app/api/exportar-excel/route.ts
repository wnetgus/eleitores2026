import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

interface EleitorData {
  nomeCompleto: string;
  telefone?: string;
  tipoDocumento?: string;
  documento: string;
  estado: string;
  cidade: string;
  bairro: string;
  grauApoio: string;
  voto?: string;
  colaboradorNome: string;
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
  "PV": { p: "16A34A", s: "15803D", a: "DCFCE7", b: "F0FDF4", d: "14532D", nome: "PV" },
  "CIDADANIA": { p: "0284C7", s: "0369A1", a: "E0F2FE", b: "F0F9FF", d: "0C4A6E", nome: "Cidadania" },
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eleitores, titulo, party }: { eleitores: EleitorData[]; titulo: string; party?: string } = body;
    const c = getColors(party);

    const wb = new ExcelJS.Workbook();
    wb.creator = "Eleitores 2026";
    wb.created = new Date();

    // ==================== ABA: RESUMO ====================
    const ws = wb.addWorksheet("Resumo Executivo", { views: [{ showGridLines: false }] });
    ws.columns = [
      { width: 5 }, { width: 38 }, { width: 28 }, { width: 28 }, { width: 28 }, { width: 28 },
    ];

    const verde = "059669";
    const verdeEscuro = "065F46";
    const branco = "FFFFFF";
    const cinzaTexto = "6B7280";
    const textoPrincipal = "1F2937";
    const bgCard = "F0FDF4";

    // Faixa topo
    for (let cc = 1; cc <= 6; cc++) {
      const cell = ws.getCell(1, cc);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.p } };
      cell.font = { name: "Calibri", size: 18, bold: true, color: { argb: branco } };
      cell.alignment = { vertical: "middle" };
      cell.border = { bottom: { style: "medium", color: { argb: c.s } } };
    }
    ws.mergeCells(1, 1, 1, 6);
    ws.getCell(1, 1).value = `  RELATÓRIO EXECUTIVO — ${c.nome.toUpperCase()}`;
    ws.getRow(1).height = 50;

    // Subtítulo
    for (let cc = 1; cc <= 6; cc++) {
      const cell = ws.getCell(2, cc);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.s } };
      cell.font = { name: "Calibri", size: 10, color: { argb: branco } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    }
    ws.mergeCells(2, 1, 2, 6);
    ws.getCell(2, 1).value = `${titulo}  •  ${new Date().toLocaleString("pt-BR")}  •  ${c.nome}`;
    ws.getRow(2).height = 28;

    // Seção Gabinete
    ws.getCell(4, 1).value = "GABINETE";
    ws.getCell(4, 1).font = { name: "Calibri", size: 11, bold: true, color: { argb: c.p } };

    [["Título", titulo], ["Partido", c.nome]].forEach(([l, v], i) => {
      const r = 5 + i;
      ws.getCell(r, 2).value = l;
      ws.getCell(r, 2).font = { name: "Calibri", size: 10, bold: true, color: { argb: cinzaTexto } };
      ws.getCell(r, 3).value = v;
      ws.getCell(r, 3).font = { name: "Calibri", size: 10, color: { argb: textoPrincipal } };
      ws.mergeCells(r, 3, r, 4);
    });

    // Cards de indicadores
    const fortes = eleitores.filter((e) => e.grauApoio === "forte").length;
    const medios = eleitores.filter((e) => e.grauApoio === "medio").length;
    const fracos = eleitores.filter((e) => e.grauApoio === "fraco").length;
    const indecisos = eleitores.filter((e) => e.grauApoio === "indeciso").length;

    const cards = [
      { label: "Total de Eleitores", value: eleitores.length.toString() },
      { label: "Fortes", value: fortes.toString() },
      { label: "Médios", value: medios.toString() },
      { label: "Fracos", value: fracos.toString() },
      { label: "Indecisos", value: indecisos.toString() },
    ];

    let cr = 8;
    ws.getCell(cr, 1).value = "INDICADORES";
    ws.getCell(cr, 1).font = { name: "Calibri", size: 11, bold: true, color: { argb: c.p } };
    cr = 9;

    cards.forEach((card, i) => {
      const col = (i % 3) * 2 + 1;
      const r = cr + Math.floor(i / 3) * 4;

      for (let rr = r; rr < r + 3; rr++) {
        for (let cc = col; cc < col + 2; cc++) {
          ws.getCell(rr, cc).fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.b } };
          ws.getCell(rr, cc).border = {
            top: { style: "thin", color: { argb: "D1FAE5" } },
            bottom: { style: "thin", color: { argb: "D1FAE5" } },
            left: { style: "thin", color: { argb: "D1FAE5" } },
            right: { style: "thin", color: { argb: "D1FAE5" } },
          };
        }
      }
      ws.getCell(r, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.p } };
      ws.mergeCells(r, col + 1, r, col + 1);
      ws.getCell(r, col + 1).value = card.label;
      ws.getCell(r, col + 1).font = { name: "Calibri", size: 9, color: { argb: cinzaTexto } };
      ws.getCell(r, col + 1).alignment = { vertical: "bottom" };
      ws.mergeCells(r + 1, col + 1, r + 1, col + 1);
      ws.getCell(r + 1, col + 1).value = card.value;
      ws.getCell(r + 1, col + 1).font = { name: "Calibri", size: 22, bold: true, color: { argb: c.p } };
      ws.getCell(r + 1, col + 1).alignment = { vertical: "top" };
    });

    // Tabela de eleitores
    let tr = cr + 10;
    ws.getCell(tr++, 1).value = "ELEITORES";
    ws.getCell(tr - 1, 1).font = { name: "Calibri", size: 11, bold: true, color: { argb: c.p } };

    const headers = ["Nome", "Telefone", "Documento", "UF", "Cidade", "Grau", "Voto", "Colaborador", "Data"];
    headers.forEach((h, i) => {
      const cell = ws.getCell(tr, i + 1);
      cell.value = h;
      cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: branco } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.p } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: c.s } },
        bottom: { style: "thin", color: { argb: c.s } },
      };
    });
    tr++;

    eleitores.forEach((e, i) => {
      const bg = i % 2 === 0 ? branco : c.b;
      const row = [e.nomeCompleto, e.telefone || "-", `${(e.tipoDocumento || "").toUpperCase()}: ${e.documento}`, e.estado, e.cidade, e.grauApoio, e.voto || "-", e.colaboradorNome, dataStr(e)];
      row.forEach((val, j) => {
        const cell = ws.getCell(tr, j + 1);
        cell.value = val;
        cell.font = { name: "Calibri", size: 9, color: { argb: textoPrincipal } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.border = { bottom: { style: "thin", color: { argb: "E5E7EB" } } };
      });
      tr++;
    });

    // ==================== ABA: ESTATÍSTICAS ====================
    const ws2 = wb.addWorksheet("Estatísticas", { views: [{ showGridLines: false }] });
    ws2.columns = [{ width: 20 }, { width: 18 }, { width: 18 }];

    // Faixa topo
    for (let cc = 1; cc <= 3; cc++) {
      const cell = ws2.getCell(1, cc);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.p } };
      cell.font = { name: "Calibri", size: 14, bold: true, color: { argb: branco } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = { bottom: { style: "medium", color: { argb: c.s } } };
    }
    ws2.mergeCells(1, 1, 1, 3);
    ws2.getCell(1, 1).value = `  ESTATÍSTICAS — ${c.nome.toUpperCase()}`;
    ws2.getRow(1).height = 40;

    // Subtítulo
    for (let cc = 1; cc <= 3; cc++) {
      const cell = ws2.getCell(2, cc);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.s } };
      cell.font = { name: "Calibri", size: 9, color: { argb: branco } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    }
    ws2.mergeCells(2, 1, 2, 3);
    ws2.getCell(2, 1).value = `${new Date().toLocaleString("pt-BR")}  •  ${c.nome}`;
    ws2.getRow(2).height = 22;

    // Tabela de distribuição com barras visuais
    ws2.getCell(4, 1).value = "DISTRIBUIÇÃO POR GRAU DE APOIO";
    ws2.getCell(4, 1).font = { name: "Calibri", size: 10, bold: true, color: { argb: c.p } };

    ws2.getCell(5, 1).value = "Grau";
    ws2.getCell(5, 1).font = { name: "Calibri", size: 9, bold: true, color: { argb: branco } };
    ws2.getCell(5, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.p } };
    ws2.getCell(5, 2).value = "Qtd";
    ws2.getCell(5, 2).font = { name: "Calibri", size: 9, bold: true, color: { argb: branco } };
    ws2.getCell(5, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.p } };
    ws2.getCell(5, 2).alignment = { horizontal: "center" };
    ws2.getCell(5, 3).value = "%";
    ws2.getCell(5, 3).font = { name: "Calibri", size: 9, bold: true, color: { argb: branco } };
    ws2.getCell(5, 3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.p } };
    ws2.getCell(5, 3).alignment = { horizontal: "center" };

    const total = eleitores.length || 1;
    const grauRows = [
      ["Forte", fortes, Math.round((fortes / total) * 100)],
      ["Médio", medios, Math.round((medios / total) * 100)],
      ["Fraco", fracos, Math.round((fracos / total) * 100)],
      ["Indeciso", indecisos, Math.round((indecisos / total) * 100)],
    ];

    grauRows.forEach((row, i) => {
      const r = 6 + i;
      const label = row[0] as string;
      const val = row[1] as number;
      const pct = row[2] as number;
      ws2.getCell(r, 1).value = label;
      ws2.getCell(r, 1).font = { name: "Calibri", size: 9, bold: true, color: { argb: c.p } };
      ws2.getCell(r, 2).value = val;
      ws2.getCell(r, 2).font = { name: "Calibri", size: 9, color: { argb: "1F2937" } };
      ws2.getCell(r, 2).alignment = { horizontal: "center" };
      ws2.getCell(r, 3).value = `${pct}%`;
      ws2.getCell(r, 3).font = { name: "Calibri", size: 9, color: { argb: cinzaTexto } };
      ws2.getCell(r, 3).alignment = { horizontal: "center" };

    });

    // Cards de indicadores
    const statsCards = [
      { label: "Total", value: eleitores.length },
      { label: "Fortes", value: fortes },
      { label: "Médios", value: medios },
      { label: "Fracos", value: fracos },
      { label: "Indecisos", value: indecisos },
    ];

    let scr = 11;
    ws2.getCell(scr, 1).value = "INDICADORES";
    ws2.getCell(scr, 1).font = { name: "Calibri", size: 10, bold: true, color: { argb: c.p } };
    scr = 12;

    statsCards.forEach((s, i) => {
      const col = (i % 3) + 1;
      const r = scr + Math.floor(i / 3) * 3;

      for (let rr = r; rr < r + 2; rr++) {
        ws2.getCell(rr, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.b } };
        ws2.getCell(rr, col).border = {
          top: { style: "thin", color: { argb: "D1FAE5" } },
          bottom: { style: "thin", color: { argb: "D1FAE5" } },
          left: { style: "thin", color: { argb: "D1FAE5" } },
          right: { style: "thin", color: { argb: "D1FAE5" } },
        };
      }
      ws2.getCell(r, col).value = s.label;
      ws2.getCell(r, col).font = { name: "Calibri", size: 8, color: { argb: cinzaTexto } };
      ws2.getCell(r, col).alignment = { vertical: "bottom" };
      ws2.getCell(r + 1, col).value = s.value;
      ws2.getCell(r + 1, col).font = { name: "Calibri", size: 16, bold: true, color: { argb: c.p } };
      ws2.getCell(r + 1, col).alignment = { vertical: "top" };
    });

    // Rodapé
    const rodapeRow = scr + 10;
    ws2.getCell(rodapeRow, 1).value = "Eleitores 2026 — Plataforma de Gestão Política";
    ws2.getCell(rodapeRow, 1).font = { name: "Calibri", size: 8, color: { argb: "9CA3AF" } };
    ws2.mergeCells(rodapeRow, 1, rodapeRow, 3);

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="relatorio-${c.nome.toLowerCase().replace(/\s/g, "-")}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Erro ao gerar Excel:", error);
    return NextResponse.json({ error: "Erro ao gerar Excel" }, { status: 500 });
  }
}

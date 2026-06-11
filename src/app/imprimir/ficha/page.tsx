"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

const LINHAS = 20;

const PRINT_CSS = `
  html, body { background: white !important; color: #111 !important; }
  * { box-sizing: border-box; }
  .fw { font-family: Arial, Helvetica, sans-serif; background: white; color: #111; padding: 28px 32px; max-width: 820px; margin: 0 auto; }
  .fh { border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 14px; }
  .ft { font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .fm { display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: 11px; color: #444; }
  .fm strong { color: #111; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f0f0f0; border: 1px solid #bbb; padding: 5px 7px; font-size: 10px; font-weight: bold; text-align: left; text-transform: uppercase; letter-spacing: 0.3px; color: #333; }
  td { border: 1px solid #ccc; padding: 0 6px; height: 26px; font-size: 10px; color: #111; }
  td.n { text-align: center; color: #bbb; font-size: 9px; }
  td.g { font-size: 9px; color: #ccc; text-align: center; }
  .leg { margin-top: 10px; display: flex; gap: 16px; flex-wrap: wrap; font-size: 9px; color: #888; }
  .leg strong { color: #444; }
  .inst { margin-top: 5px; font-size: 9px; color: #bbb; }
  .bar { margin-top: 24px; padding: 14px 16px; background: #f8f8f8; border: 1px solid #ddd; border-radius: 6px; display: flex; gap: 10px; align-items: center; }
  .bar button { padding: 8px 18px; font-size: 13px; cursor: pointer; border-radius: 4px; border: 1px solid #aaa; background: white; }
  .bar button.p { background: #111; color: white; border-color: #111; font-weight: 600; }
  .bar span { font-size: 11px; color: #999; margin-left: 8px; }
  @media print {
    html, body { background: white !important; color: black !important; margin: 0; padding: 0; }
    .fw { padding: 8px 10px; max-width: none; }
    .bar { display: none !important; }
    tr { page-break-inside: avoid; }
  }
`;

function FichaContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const nome = params.get("nome") || "";
  const cargo = params.get("cargo") || "";
  const cidade = params.get("cidade") || "";
  const bairro = params.get("bairro") || "";
  const campanhaId = params.get("campanhaId") || "";

  const [gabineteNome, setGabineteNome] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    document.documentElement.style.background = "white";
    document.body.style.background = "white";
    document.body.style.color = "#111";
    return () => {
      document.documentElement.style.background = "";
      document.body.style.background = "";
      document.body.style.color = "";
    };
  }, []);

  useEffect(() => {
    async function fetch() {
      if (campanhaId) {
        try {
          const snap = await getDoc(doc(db, "campanhas", campanhaId));
          if (snap.exists()) setGabineteNome(snap.data().nome || "");
        } catch {}
      }
      setReady(true);
    }
    fetch();
  }, [campanhaId]);

  useEffect(() => {
    if (!ready || !user) return;
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, [ready, user]);

  if (authLoading || !user) return (
    <div style={{ padding: 40, fontFamily: "Arial", background: "white", color: "#444", minHeight: "100vh" }}>
      Verificando acesso...
    </div>
  );

  const cargoLabel =
    cargo === "coordenador" ? "Coordenador(a)" :
    cargo === "colaborador" ? "Mobilizador(a)" :
    cargo === "assessor"    ? "Assessor(a)"    : cargo;

  const hoje = new Date().toLocaleDateString("pt-BR");
  const territorio = [bairro, cidade].filter(Boolean).join(" / ") || "—";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="fw">
        <div className="fh">
          <div className="ft">Ficha de Campo — {gabineteNome || "Campanha 2026"}</div>
          <div className="fm">
            <span><strong>Responsável:</strong> {nome || "—"}</span>
            <span><strong>Função:</strong> {cargoLabel || "—"}</span>
            <span><strong>Território:</strong> {territorio}</span>
            <span><strong>Data:</strong> {hoje}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: 24 }}>Nº</th>
              <th>Nome Completo</th>
              <th style={{ width: 128 }}>Bairro</th>
              <th style={{ width: 88 }}>Apoio</th>
              <th style={{ width: 118 }}>Telefone</th>
              <th style={{ width: 150 }}>Observações</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: LINHAS }).map((_, i) => (
              <tr key={i}>
                <td className="n">{i + 1}</td>
                <td></td>
                <td></td>
                <td className="g">F · M · I · Fr</td>
                <td></td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="leg">
          <span><strong>F</strong> = Forte</span>
          <span><strong>M</strong> = Médio</span>
          <span><strong>I</strong> = Indeciso</span>
          <span><strong>Fr</strong> = Fraco</span>
        </div>
        <div className="inst">
          Após o trabalho de campo, cadastrar no sistema: <strong>Eleitores → Cadastro Rápido</strong>
        </div>

        <div className="bar">
          <button className="p" onClick={() => window.print()}>🖨️ Imprimir Ficha</button>
          <button onClick={() => window.close()}>Fechar</button>
          <span>Ficha em branco para preenchimento manual em campo. Não contém dados pessoais.</span>
        </div>
      </div>
    </>
  );
}

export default function ImprimirFichaPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 40, fontFamily: "Arial", background: "white", color: "#444", minHeight: "100vh" }}>
        Preparando ficha...
      </div>
    }>
      <FichaContent />
    </Suspense>
  );
}

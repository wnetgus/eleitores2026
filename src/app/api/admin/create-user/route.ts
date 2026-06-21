import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, verifyToken } from "@/lib/firebase-admin";
import { isRateLimited, getClientIp } from "@/lib/rate-limiter";
import { FieldValue } from "firebase-admin/firestore";

const ROLE_CAN_CREATE: Record<string, string[]> = {
  super_admin:        ["super_admin", "admin_master", "politico", "prefeito", "vereador", "assessor_executivo", "assessor", "coordenador", "colaborador"],
  admin_master:       ["politico", "prefeito", "vereador", "assessor_executivo", "assessor", "coordenador", "colaborador"],
  politico:           ["assessor_executivo", "assessor", "coordenador", "colaborador"],
  assessor_executivo: ["assessor", "coordenador", "colaborador"],
  assessor:           ["coordenador", "colaborador"],
};

export async function POST(req: NextRequest) {
  try {
    if (await isRateLimited(getClientIp(req), "admin:create-user", 20)) {
      return NextResponse.json({ error: "Muitas requisições. Aguarde um minuto." }, { status: 429 });
    }

    const callerUid = await verifyToken(req);
    if (!callerUid) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const callerDoc = await adminDb.doc(`usuarios/${callerUid}`).get();
    if (!callerDoc.exists) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 403 });
    const callerData = callerDoc.data()!;
    const callerRole: string = callerData.role ?? "";
    const callerCampanha: string = callerData.campanhaId ?? callerData.gabineteId ?? "";

    const body = await req.json();
    const { email, password, dados } = body as {
      email: string;
      password: string;
      dados: Record<string, any>;
    };

    if (!email || !password || !dados) {
      return NextResponse.json({ error: "email, password e dados são obrigatórios" }, { status: 400 });
    }

    const targetRole: string = dados.role ?? "";
    const isAdmin = ["super_admin", "admin_master"].includes(callerRole);
    const allowed = ROLE_CAN_CREATE[callerRole] ?? [];

    if (!isAdmin && !allowed.includes(targetRole)) {
      return NextResponse.json({ error: `Sem permissão para criar role '${targetRole}'` }, { status: 403 });
    }

    if (!isAdmin) {
      const targetCampanha: string = dados.campanhaId ?? dados.gabineteId ?? "";
      if (!targetCampanha || targetCampanha !== callerCampanha) {
        return NextResponse.json({ error: "Campanha inválida" }, { status: 403 });
      }
    }

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: dados.nome ?? "",
    });
    const uid = userRecord.uid;

    // Descarta sentinels do cliente (serverTimestamp vira {} em JSON) — servidor define criadoEm
    const { criadoEm: _, ...dadosSanitized } = dados;

    await adminDb.doc(`usuarios/${uid}`).set({
      ...dadosSanitized,
      uid,
      criadoEm: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ uid });
  } catch (error: any) {
    if (error.code === "auth/email-already-exists") {
      return NextResponse.json({ error: "E-mail já está em uso" }, { status: 409 });
    }
    console.error("create-user error:", error);
    return NextResponse.json({ error: error.message ?? "Erro interno" }, { status: 500 });
  }
}

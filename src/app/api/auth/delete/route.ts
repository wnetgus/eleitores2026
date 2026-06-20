import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, verifyToken } from "@/lib/firebase-admin";
import { isRateLimited, getClientIp } from "@/lib/rate-limiter";

export async function DELETE(req: NextRequest) {
  try {
    if (await isRateLimited(getClientIp(req), "auth:delete", 5)) {
      return NextResponse.json({ error: "Muitas requisições. Aguarde um minuto." }, { status: 429 });
    }
    const callerUid = await verifyToken(req);
    if (!callerUid) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const callerDoc = await adminDb.doc(`usuarios/${callerUid}`).get();
    const callerRole = callerDoc.data()?.role;
    if (!["super_admin", "admin_master"].includes(callerRole)) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");
    if (!uid) return NextResponse.json({ error: "uid obrigatório" }, { status: 400 });

    await adminDb.doc(`usuarios/${uid}`).delete();

    try {
      await adminAuth.deleteUser(uid);
    } catch {
      // usuário pode não existir no Auth (apenas Firestore)
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao excluir usuário:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");

    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

    await deleteDoc(doc(db, "usuarios", uid));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao excluir admin:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

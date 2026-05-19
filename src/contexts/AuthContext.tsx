"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AppUser } from "@/types";

function dbg(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  if (typeof window === "undefined") return;
  if (!(window as any).__dbg) (window as any).__dbg = [];
  (window as any).__dbg.push(line);
  if ((window as any).__dbg.length > 80) (window as any).__dbg.shift();
  try { localStorage.setItem("eleitores_debug", JSON.stringify((window as any).__dbg)); } catch {}
}

interface AuthContextType {
  user: User | null;
  userData: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      dbg("AUTH:state-change uid=" + (firebaseUser?.uid ?? "null") + " email=" + (firebaseUser?.email ?? "null"));
      setUser(firebaseUser);
      if (firebaseUser) {
        const loadDoc = async () => {
          dbg("AUTH:getDoc:attempt-1 uid=" + firebaseUser.uid);
          try {
            const snap = await getDoc(doc(db, "usuarios", firebaseUser.uid));
            dbg("AUTH:getDoc:attempt-1-ok exists=" + snap.exists());
            return snap;
          } catch (e: any) {
            dbg("AUTH:getDoc:attempt-1-FAIL code=" + (e?.code ?? "?") + " msg=" + String(e?.message ?? "").slice(0, 60));
            dbg("AUTH:getDoc:waiting-1000ms");
            await new Promise(r => setTimeout(r, 1000));
            dbg("AUTH:getDoc:attempt-2 uid=" + firebaseUser.uid);
            try {
              const snap2 = await getDoc(doc(db, "usuarios", firebaseUser.uid));
              dbg("AUTH:getDoc:attempt-2-ok exists=" + snap2.exists());
              return snap2;
            } catch (e2: any) {
              dbg("AUTH:getDoc:attempt-2-FAIL code=" + (e2?.code ?? "?") + " msg=" + String(e2?.message ?? "").slice(0, 60));
              throw e2;
            }
          }
        };

        let docSnap;
        try {
          docSnap = await loadDoc();
        } catch (e: any) {
          dbg("AUTH:SIGNOUT reason=getDoc-definitivo-fail code=" + (e?.code ?? "?"));
          signOut(auth);
          return;
        }

        dbg("AUTH:docSnap exists=" + docSnap.exists() + " email=" + firebaseUser.email);

        if (firebaseUser.email === "wnetgus@gmail.com") {
          dbg("AUTH:branch=super_admin");
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            nome: docSnap.exists() ? (docSnap.data().nome || "Super Admin") : "Super Admin",
            role: "super_admin",
            campanhaId: docSnap.exists() ? docSnap.data().campanhaId : undefined,
            criadoEm: new Date(),
            ativo: true,
          });
          setLoading(false);
        } else if (docSnap.exists()) {
          dbg("AUTH:branch=docExists role=" + docSnap.data().role);
          setUserData({ uid: firebaseUser.uid, ...docSnap.data(), ativo: docSnap.data().ativo ?? true } as AppUser);
          setLoading(false);
        } else {
          dbg("AUTH:SIGNOUT reason=no-firestore-profile uid=" + firebaseUser.uid + " email=" + firebaseUser.email);
          signOut(auth);
        }
      } else {
        dbg("AUTH:branch=signed-out");
        setUserData(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AppUser } from "@/types";

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
      setUser(firebaseUser);
      if (firebaseUser) {
        // Retry getDoc once to handle auth-token propagation race on mobile (Android/slow connections)
        const loadDoc = async () => {
          try {
            return await getDoc(doc(db, "usuarios", firebaseUser.uid));
          } catch (e: any) {
            console.error("getDoc tentativa 1:", e?.code || e?.message);
            await new Promise(r => setTimeout(r, 1000));
            return await getDoc(doc(db, "usuarios", firebaseUser.uid));
          }
        };

        let docSnap;
        try {
          docSnap = await loadDoc();
        } catch (e: any) {
          console.error("Erro definitivo ao carregar perfil:", e?.code || e?.message);
          signOut(auth);
          return;
        }

        if (firebaseUser.email === "wnetgus@gmail.com") {
          // Ensure Firestore document exists so security rules can evaluate isAdmin()
          if (!docSnap.exists()) {
            try {
              await setDoc(doc(db, "usuarios", firebaseUser.uid), {
                email: firebaseUser.email,
                nome: "Weyne Souza",
                role: "super_admin",
                ativo: true,
                criadoEm: serverTimestamp(),
              });
            } catch {}
          }
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            nome: docSnap.exists() ? (docSnap.data().nome || "Weyne Souza") : "Weyne Souza",
            role: "super_admin",
            campanhaId: docSnap.exists() ? docSnap.data().campanhaId : undefined,
            criadoEm: new Date(),
            ativo: true,
          });
          setLoading(false);
        } else if (docSnap.exists()) {
          setUserData({ uid: firebaseUser.uid, ...docSnap.data(), ativo: docSnap.data().ativo ?? true } as AppUser);
          setLoading(false);
        } else {
          // Authenticated but no Firestore profile
          signOut(auth);
        }
      } else {
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

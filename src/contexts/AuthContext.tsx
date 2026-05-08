"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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
        try {
          const docSnap = await getDoc(doc(db, "usuarios", firebaseUser.uid));
          if (docSnap.exists()) {
            setUserData({ uid: firebaseUser.uid, ...docSnap.data(), ativo: docSnap.data().ativo ?? true } as AppUser);
          } else if (firebaseUser.email === "wnetgus@gmail.com") {
            setUserData({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              nome: "Admin Master",
              role: "admin",
              criadoEm: new Date(),
              ativo: true,
            });
          }
        } catch (e) {
          console.error("Erro ao carregar dados do usuário:", e);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
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

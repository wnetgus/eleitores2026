import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  browserSessionPersistence,
  setPersistence,
  inMemoryPersistence,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

// Android Chrome treats http://192.168.x.x as a non-secure context (unlike localhost).
// Firebase Auth's default IndexedDB persistence fails silently on non-secure origins,
// preventing onAuthStateChanged from firing after sign-in.
// Override to sessionStorage persistence for HTTP local network access.
if (typeof window !== "undefined" &&
    window.location.protocol === "http:" &&
    window.location.hostname !== "localhost") {
  setPersistence(auth, browserSessionPersistence).catch(() => {});
}

// Creates a Firebase Auth account and writes the user document without switching the
// current session. Uses a secondary Firebase App with in-memory persistence so the
// main app's onAuthStateChanged is never triggered by the new account.
export async function createAuthUser(
  email: string,
  password: string,
  dados: Record<string, any>
): Promise<string> {
  const secondaryApp =
    getApps().find((a) => a.name === "secondary") ??
    initializeApp(firebaseConfig, "secondary");
  const secondaryAuth = getAuth(secondaryApp);
  const secondaryDb = getFirestore(secondaryApp);
  await setPersistence(secondaryAuth, inMemoryPersistence);
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  await setDoc(doc(secondaryDb, "usuarios", cred.user.uid), {
    ...dados,
    uid: cred.user.uid,
  });
  await secondaryAuth.signOut();
  return cred.user.uid;
}

export { app, auth, db };

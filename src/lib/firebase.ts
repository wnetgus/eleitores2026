import { initializeApp, getApps } from "firebase/app";
import { getAuth, browserSessionPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

export { app, auth, db };

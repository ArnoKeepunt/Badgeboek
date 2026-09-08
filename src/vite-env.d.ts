/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Welke persistentielaag de store gebruikt. Zie `src/lib/data/`. */
  readonly VITE_PERSISTENTIE?: "local" | "firebase";
  /** Firebase-projectconfig, alleen nodig bij `VITE_PERSISTENTIE=firebase`. Zie `.env.example`.
   *  Wordt bij `vite build` in de bundel gebakken — moet dus bij het bouwen gezet zijn. */
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_DATABASE_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Welke persistentielaag de store gebruikt. Zie `src/lib/data/`. */
  readonly VITE_PERSISTENTIE?: "local" | "firebase";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

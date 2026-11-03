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
  /** Leerling-login via Smartschool (OAuth). Zonder client id verschijnt de knop niet.
   *  Geen geheimen: het client secret staat enkel in de Cloud Function. */
  readonly VITE_SMARTSCHOOL_CLIENT_ID?: string;
  readonly VITE_SMARTSCHOOL_PLATFORM?: string;
  readonly VITE_SMARTSCHOOL_REDIRECT_URI?: string;
  /** Versie-id van deze build (gezet door `vite.config.ts`, enkel bij `vite build`). */
  readonly VITE_BADGEBOEK_VERSIE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

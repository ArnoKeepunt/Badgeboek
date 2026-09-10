import { defineConfig } from "vitest/config";

// De testsuite draait vandaag alleen de Firestore-regels (`test/firestore.rules.test.ts`) tegen
// de emulator. Start via `npm run test:rules` — dat wikkelt `firebase emulators:exec` errond zodat
// de emulator automatisch op- en afgaat. `npm test` verwacht een al draaiende emulator.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // De regels-tests delen één emulator; serieel draaien voorkomt dat parallelle bestanden
    // elkaars `clearFirestore()` in de wielen rijden.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});

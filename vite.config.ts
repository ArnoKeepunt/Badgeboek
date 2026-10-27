import react from '@vitejs/plugin-react'
import { type Plugin, defineConfig } from 'vite'

/**
 * Versiemelding: elke build krijgt een eigen versie-id, ingebakken in de code
 * (`import.meta.env.VITE_BADGEBOEK_VERSIE`) én als `versie.json` naast de app. Een open tabblad
 * vergelijkt die twee af en toe; verschillen ze, dan draait het een oude versie en vraagt het om
 * te herladen (`src/components/NieuweVersie.tsx`). Tijdens `vite dev` is er geen versie → uit.
 */
function badgeboekVersie(): Plugin {
  const versie = new Date().toISOString()
  return {
    name: 'badgeboek-versie',
    apply: 'build',
    config: () => ({
      define: { 'import.meta.env.VITE_BADGEBOEK_VERSIE': JSON.stringify(versie) },
    }),
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'versie.json', source: JSON.stringify({ versie }) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Relatieve asset-paden: de gebouwde dist-map werkt zowel op een domein-root als in een
  // submap (bv. https://voorbeeld.be/badgeboek/) zonder aanpassing.
  base: "./",
  plugins: [react(), badgeboekVersie()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  build: {
    // De app bundelt bewust de curriculum-/eindtermendata; gzip blijft ~140 kB.
    chunkSizeWarningLimit: 900,
  },
})

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relatieve asset-paden: de gebouwde dist-map werkt zowel op een domein-root als in een
  // submap (bv. https://voorbeeld.be/badgeboek/) zonder aanpassing.
  base: "./",
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  build: {
    // De app bundelt bewust de curriculum-/eindtermendata; gzip blijft ~140 kB.
    chunkSizeWarningLimit: 900,
  },
})

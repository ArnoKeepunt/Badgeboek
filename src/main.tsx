import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { NieuweVersie } from './components/NieuweVersie'
import { Toegangspoort } from './components/Toegangspoort'
import { router } from './router'
// Inter: het lettertype van het (geprinte) rapport — ingebed, zodat "Printen" en de pdf van de
// server (functions/index.js, zelfde lettertype) er op elk toestel hetzelfde uitzien.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-400-italic.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Toegangspoort>
      <RouterProvider router={router} />
    </Toegangspoort>
    <NieuweVersie />
  </StrictMode>,
)

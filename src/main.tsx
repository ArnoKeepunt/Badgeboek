import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Toegangspoort } from './components/Toegangspoort'
import { router } from './router'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Toegangspoort>
      <RouterProvider router={router} />
    </Toegangspoort>
  </StrictMode>,
)

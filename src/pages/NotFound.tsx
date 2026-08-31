import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <section>
      <h1>404</h1>
      <p style={{ color: 'var(--text-muted)' }}>Deze pagina bestaat niet.</p>
      <Link to="/">Naar het overzicht</Link>
    </section>
  )
}

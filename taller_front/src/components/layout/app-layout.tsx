import { ClipboardPlus, MapPin, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Los Fratelli, inicio">
          <span className="brand-mark">
            <Wrench size={21} />
          </span>
          <span>
            LOS <strong>FRATELLI</strong>
          </span>
        </a>

        <div className="topbar-context">
          <ClipboardPlus size={17} />
          <span>Recepción</span>
        </div>
      </header>

      <main>{children}</main>

      <footer className="footer">
        <span>LOS FRATELLI · Taller mecánico</span>
        <span>
          <MapPin size={14} /> La Paz, Bolivia
        </span>
      </footer>
    </div>
  )
}
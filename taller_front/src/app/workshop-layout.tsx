import { NavLink, Outlet } from 'react-router';
import { Car, FileText, Globe, RotateCcw, Wrench, ClipboardPlus } from 'lucide-react';

import { useWorkshop } from '../state/WorkshopContext';
import { useToast } from '../shared/components/ToastContext';

const NAV_ITEMS = [
  { to: '/recepcion', label: 'Recepción', icon: <ClipboardPlus className="w-4 h-4" /> },
  { to: '/taller', label: 'Jefe de Taller', icon: <Car className="w-4 h-4" /> },
  { to: '/mecanico', label: 'Mecánico', icon: <Wrench className="w-4 h-4" /> },
  { to: '/ots', label: 'Órdenes de Trabajo', icon: <FileText className="w-4 h-4" /> },
  { to: '/consulta', label: 'Portal Cliente', icon: <Globe className="w-4 h-4" /> },
];

export function WorkshopLayout() {
  const toast = useToast();
  const { resetData } = useWorkshop();

  const handleReset = () => {
    if (window.confirm('¿Desea restablecer todos los datos del taller al estado inicial con ejemplos?')) {
      resetData();
      toast.info('Datos Restablecidos', 'Se reiniciaron las órdenes, bahías e inventario.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-[#E0E2E6]">
      <header className="sticky top-0 z-40 bg-[#16191F]/95 backdrop-blur-md border-b border-[#2D3139]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <NavLink to="/taller" className="flex items-center gap-3 cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-[#F97316] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base sm:text-lg tracking-tight text-white">LOS FRATELLI</span>
                  <span className="text-[10px] font-semibold text-[#8E949F] hidden sm:inline">| Gestión de Taller</span>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#2D3139] rounded-full text-[10px] font-semibold text-[#22C55E]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                    4 BAHÍAS
                  </div>
                </div>
                <p className="text-[11px] text-[#8E949F] font-medium">Vehículos Livianos • HU-02</p>
              </div>
            </NavLink>

            <nav className="hidden md:flex items-center gap-1.5">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 min-h-[40px] whitespace-nowrap ${
                      isActive
                        ? 'bg-[#F97316] text-white shadow-xs shadow-orange-950/40'
                        : item.to === '/'
                          ? 'bg-[#22C55E15] text-[#22C55E] border border-[#22C55E30] hover:bg-[#22C55E25]'
                          : 'text-[#8E949F] hover:text-[#E0E2E6] hover:bg-[#2D3139]'
                    }`
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                title="Reiniciar datos de prueba"
                className="p-2 rounded-xl bg-[#1C2028] border border-[#2D3139] text-[#8E949F] hover:text-[#F97316] hover:border-[#F97316]/50 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="md:hidden border-t border-[#2D3139] bg-[#16191F] px-4 py-2 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 min-h-[38px] whitespace-nowrap ${
                    isActive ? 'bg-[#F97316] text-white' : 'text-[#8E949F] hover:text-[#E0E2E6] hover:bg-[#2D3139]'
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="mt-12 border-t border-[#2D3139] bg-[#16191F] py-5 text-xs text-[#8E949F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#F97316]" />
            <strong className="text-[#E0E2E6]">Taller Mecánico "Los Fratelli" S.R.L.</strong>
            <span>— Control de Bahías & OTs</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span>La Paz, Bolivia</span>
            <span>•</span>
            <span>Moneda: BOB</span>
            <div className="flex items-center gap-2 bg-[#22C55E15] px-3 py-1 rounded-lg border border-[#22C55E30]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              <span className="text-[11px] text-[#22C55E] font-bold">4 Bahías Operativas</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

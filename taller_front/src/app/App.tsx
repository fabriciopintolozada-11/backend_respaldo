import React, { useState } from 'react';
import {
  Wrench,
  Car,
  Layers,
  FileText,
  Package,
  FileCheck,
  DollarSign,
  Globe,
  Sun,
  Moon,
  Menu,
  X,
  RotateCcw,
} from 'lucide-react';

import { ToastProvider, useToast } from '../shared/components/ToastContext';
import { VehicleReceptionView } from '../features/reception/pages/VehicleReceptionView';
import { WorkshopHeadView } from '../features/workshop-head/pages/WorkshopHeadView';
import { MechanicConsoleView } from '../features/mechanic/pages/MechanicConsoleView';
import { WorkOrdersListView } from '../features/work-orders/pages/WorkOrdersListView';
import { WorkOrderDetailView } from '../features/work-orders/pages/WorkOrderDetailView';
import { InventoryManagerView } from '../features/inventory/pages/InventoryManagerView';
import { BudgetsAndApprovalsView } from '../features/budgets/pages/BudgetsAndApprovalsView';
import { WorkshopSettlementView } from '../features/billing/pages/WorkshopSettlementView';
import { ClientPublicPortalView } from '../features/client-portal/pages/ClientPublicPortalView';
import { resetStorageToSeed } from '../shared/api/mock-db';
import { isBackendMode } from '../shared/api/api-client';

type ActiveView =
  | 'reception'
  | 'workshop-head'
  | 'mechanic'
  | 'work-orders'
  | 'work-order-detail'
  | 'inventory'
  | 'budgets'
  | 'billing'
  | 'client-portal';

interface NavItem {
  id: ActiveView;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  badge?: string;
  isPublic?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'reception',
    label: '1. Recepción (HU-01)',
    shortLabel: 'Recepción',
    icon: <Car className="w-4 h-4" />,
  },
  {
    id: 'workshop-head',
    label: '2. Jefe de Taller',
    shortLabel: 'Jefe Taller',
    icon: <Layers className="w-4 h-4" />,
    badge: '4 Bahías',
  },
  {
    id: 'mechanic',
    label: '3. Consola Mecánico',
    shortLabel: 'Mecánico',
    icon: <Wrench className="w-4 h-4" />,
  },
  {
    id: 'work-orders',
    label: '4. Órdenes de Trabajo',
    shortLabel: 'OTs',
    icon: <FileText className="w-4 h-4" />,
  },
  {
    id: 'inventory',
    label: '5. Inventario',
    shortLabel: 'Inventario',
    icon: <Package className="w-4 h-4" />,
  },
  {
    id: 'budgets',
    label: '6. Presupuestos',
    shortLabel: 'Presupuestos',
    icon: <FileCheck className="w-4 h-4" />,
  },
  {
    id: 'billing',
    label: '7. Liquidación',
    shortLabel: 'Caja',
    icon: <DollarSign className="w-4 h-4" />,
  },
  {
    id: 'client-portal',
    label: '8. Portal Cliente',
    shortLabel: 'Portal Cliente',
    icon: <Globe className="w-4 h-4" />,
    isPublic: true,
  },
];

const MainAppContent: React.FC = () => {
  const toast = useToast();

  const [currentView, setCurrentView] =
    useState<ActiveView>('workshop-head');

  const [selectedOrderId, setSelectedOrderId] =
    useState<string | null>(null);

  const [isDarkMode, setIsDarkMode] =
    useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] =
    useState(false);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);

    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setCurrentView('work-order-detail');
    setIsMobileMenuOpen(false);
  };

  const handleResetData = () => {
    if (isBackendMode) {
      toast.info(
        'Datos administrados por backend',
        'El reinicio solo está disponible en modo mock.',
      );
      return;
    }

    if (
      window.confirm(
        '¿Desea restablecer datos iniciales del taller?',
      )
    ) {
      resetStorageToSeed();
      toast.info(
        'Datos restablecidos',
        'Se reiniciaron los datos del sistema.',
      );
      window.location.reload();
    }
  };

  return (
    <div
      className={`min-h-screen ${
        isDarkMode
          ? 'dark bg-[#0A0C0F]'
          : 'bg-[#0F1115]'
      } text-[#E0E2E6]`}
    >
      <header className="sticky top-0 z-40 bg-[#16191F] border-b border-[#2D3139]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">

            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => {
                setCurrentView('workshop-head');
                setSelectedOrderId(null);
              }}
            >
              <div className="w-10 h-10 rounded-xl bg-[#F97316] flex items-center justify-center">
                <Wrench className="w-5 h-5 text-white" />
              </div>

              <div>
                <strong className="text-white">
                  LOS FRATELLI
                </strong>

                <p className="text-xs text-[#8E949F]">
                  Gestión de Taller
                </p>
              </div>
            </div>


            <nav className="hidden xl:flex gap-2">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCurrentView(item.id);
                    setSelectedOrderId(null);
                  }}
                  className={`px-3 py-2 rounded-xl flex items-center gap-2 ${
                    currentView === item.id
                      ? 'bg-[#F97316] text-white'
                      : 'text-[#8E949F]'
                  }`}
                >
                  {item.icon}
                  {item.shortLabel}
                </button>
              ))}
            </nav>


            <div className="flex gap-2">

              <button
                type="button"
                onClick={handleResetData}
                className="p-2"
              >
                <RotateCcw />
              </button>


              <button
                type="button"
                onClick={toggleDarkMode}
                className="p-2"
              >
                {isDarkMode ? <Sun /> : <Moon />}
              </button>


              <button
                type="button"
                onClick={() =>
                  setIsMobileMenuOpen(!isMobileMenuOpen)
                }
                className="xl:hidden p-2"
              >
                {isMobileMenuOpen ? <X /> : <Menu />}
              </button>

            </div>

          </div>
        </div>
      </header>


      <main className="max-w-7xl mx-auto px-4 py-6">

        {currentView === 'reception' && (
          <VehicleReceptionView
            onOrderCreated={(orderId) => {
              setSelectedOrderId(orderId);
              setCurrentView('work-order-detail');
            }}
          />
        )}


        {currentView === 'workshop-head' && (
          <WorkshopHeadView
            onSelectOrder={handleSelectOrder}
          />
        )}


        {currentView === 'mechanic' && (
          <MechanicConsoleView />
        )}


        {currentView === 'work-orders' && (
          <WorkOrdersListView
            onSelectOrder={handleSelectOrder}
            onNewOrder={() =>
              setCurrentView('reception')
            }
          />
        )}


        {currentView === 'work-order-detail' &&
          selectedOrderId && (
            <WorkOrderDetailView
              orderId={selectedOrderId}
              onBack={() =>
                setCurrentView('work-orders')
              }
              onNavigateToBilling={(id) => {
                setSelectedOrderId(id);
                setCurrentView('billing');
              }}
              onNavigateToQuotation={(id) => {
                setSelectedOrderId(id);
                setCurrentView('budgets');
              }}
            />
          )}


        {currentView === 'inventory' && (
          <InventoryManagerView />
        )}

        {currentView === 'budgets' && (
          <BudgetsAndApprovalsView
            onSelectOrder={handleSelectOrder}
          />
        )}

        {currentView === 'billing' && (
          <WorkshopSettlementView
            initialOrderId={
              selectedOrderId ?? undefined
            }
            onSelectOrder={handleSelectOrder}
          />
        )}

        {currentView === 'client-portal' && (
          <ClientPublicPortalView />
        )}

      </main>
    </div>
  );
};


export default function App() {
  return (
    <ToastProvider>
      <MainAppContent />
    </ToastProvider>
  );
}
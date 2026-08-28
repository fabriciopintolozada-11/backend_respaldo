import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Search,
  Filter,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Car,
  User,
  ChevronRight,
  Printer,
  ArrowRight,
  Download,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../../../shared/components/Card';
import { Button } from '../../../shared/components/Button';
import { Badge, WorkOrderStatusBadge } from '../../../shared/components/Badge';
import { StatusPipeline } from '../../../shared/components/StatusPipeline';
import { LoadingSkeleton } from '../../../shared/components/LoadingSkeleton';
import { EmptyState } from '../../../shared/components/EmptyState';
import { workOrdersService } from '../api/work-orders-service';
import type { WorkOrder, WorkOrderStatus } from '../../../shared/types/openapi';

export interface WorkOrdersListViewProps {
  onSelectOrder: (orderId: string) => void;
  onNewOrder: () => void;
}

export const WorkOrdersListView: React.FC<WorkOrdersListViewProps> = ({ onSelectOrder, onNewOrder }) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [onlyAlertsFilter, setOnlyAlertsFilter] = useState(false);
  const ordersQuery = useQuery({ queryKey: ['work-orders'], queryFn: () => workOrdersService.getAll() });
  const orders: WorkOrder[] = ordersQuery.data?.data ?? [];
  const loadOrders = () => { void queryClient.invalidateQueries({ queryKey: ['work-orders'] }); };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.vehicleModel.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'TODOS' || o.status === statusFilter;
    const matchesAlerts = !onlyAlertsFilter || o.daysWithoutClientResponse >= 15 || o.isSuspendedForAdditionalWork;

    return matchesSearch && matchesStatus && matchesAlerts;
  });

  const rn06Count = orders.filter((o) => o.daysWithoutClientResponse >= 15 && o.status === 'PRESUPUESTADA').length;
  const rn03Count = orders.filter((o) => o.isSuspendedForAdditionalWork).length;

  if (ordersQuery.isPending) {
    return <LoadingSkeleton rows={6} />;
  }

  if (ordersQuery.isError) {
    return <EmptyState icon={<AlertTriangle className="w-8 h-8 text-[#EF4444]" />} title="No se pudieron cargar las órdenes" description="Verifique la sesión y la conexión con el backend." actionLabel="Reintentar" onAction={loadOrders} />;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F9731615] border border-[#F9731630] flex items-center justify-center text-[#F97316]">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Gestión de Órdenes de Trabajo (OTs)
            </h1>
          </div>
          <p className="text-xs text-[#8E949F] mt-1.5">
            Máquina de estados visual, bitácora de auditoría, control de alertas (RN-06) y suspensiones (RN-03).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" size="md" leftIcon={<PlusCircle className="w-4 h-4" />} onClick={onNewOrder}>
            Nueva Recepción (HU-01)
          </Button>
        </div>
      </div>

      {/* Quick Alert Counters Banner */}
      {(rn06Count > 0 || rn03Count > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rn06Count > 0 && (
            <div
              onClick={() => {
                setOnlyAlertsFilter(true);
                setStatusFilter('PRESUPUESTADA');
              }}
              className="p-3.5 rounded-2xl bg-[#EF444410] border border-[#EF444430] text-[#E0E2E6] flex items-center justify-between cursor-pointer hover:border-[#EF4444] transition-all"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0" />
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-white">{rn06Count} Orden(es) con Alerta RN-06</h4>
                  <p className="text-[11px] text-[#8E949F]">&gt;15 días sin respuesta tras presupuesto</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#EF4444]" />
            </div>
          )}

          {rn03Count > 0 && (
            <div
              onClick={() => setOnlyAlertsFilter(true)}
              className="p-3.5 rounded-2xl bg-[#F9731610] border border-[#F9731630] text-[#E0E2E6] flex items-center justify-between cursor-pointer hover:border-[#F97316] transition-all"
            >
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-[#F97316] shrink-0" />
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-white">{rn03Count} Orden(es) Suspendidas RN-03</h4>
                  <p className="text-[11px] text-[#8E949F]">Trabajos adicionales pendientes de aprobación</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#F97316]" />
            </div>
          )}
        </div>
      )}

      {/* Filter and Search Controls */}
      <Card variant="flat" padding="md">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E949F]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código de OT, placa, cliente o modelo..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#2D3139] bg-[#0F1115] text-white text-xs sm:text-sm min-h-[44px] focus:outline-none focus:border-[#F97316]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-[#2D3139] bg-[#0F1115] text-[#E0E2E6] px-3.5 py-2 text-xs min-h-[44px] font-medium focus:outline-none focus:border-[#F97316]"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="REGISTRADA">1. Registrada</option>
              <option value="DIAGNOSTICADA">2. Diagnosticada</option>
              <option value="PRESUPUESTADA">3. Presupuestada</option>
              <option value="APROBADA">4. Aprobada x Cliente</option>
              <option value="EN_PROGRESO">5. En Progreso</option>
              <option value="EN_ESPERA_REPUESTO">6. Espera Repuesto</option>
              <option value="FINALIZADA">7. Finalizada</option>
              <option value="ENTREGADA">8. Entregada / Cobrada</option>
            </select>

            <button
              type="button"
              onClick={() => setOnlyAlertsFilter(!onlyAlertsFilter)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all min-h-[44px] flex items-center gap-2 cursor-pointer ${
                onlyAlertsFilter
                  ? 'bg-[#F97316] text-white border-[#F97316]'
                  : 'bg-[#0F1115] border-[#2D3139] text-[#8E949F] hover:text-white hover:border-[#3D4149]'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Solo Alertas</span>
            </button>

            <Button variant="ghost" size="sm" onClick={loadOrders} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Refrescar
            </Button>
          </div>
        </div>
      </Card>

      {/* Orders List / Cards */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-8 h-8 text-[#8E949F]" />}
          title="No se encontraron órdenes de trabajo"
          description="Ajusta los filtros de búsqueda o registra un nuevo vehículo en el taller."
          actionLabel="Registrar Vehículo (HU-01)"
          onAction={onNewOrder}
        />
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((ot) => {
            const hasRN06 = ot.daysWithoutClientResponse >= 15 && ot.status === 'PRESUPUESTADA';
            const hasRN03 = ot.isSuspendedForAdditionalWork;

            return (
              <Card
                key={ot.id}
                variant={hasRN06 ? 'danger' : hasRN03 ? 'warning' : 'default'}
                padding="md"
                className="hover:border-[#F97316] cursor-pointer transition-all"
                onClick={() => onSelectOrder(ot.id)}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Code, Plate, Vehicle, Client */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-[#F97316] bg-[#F9731615] border border-[#F9731630] px-2.5 py-0.5 rounded-lg">
                        {ot.code}
                      </span>
                      <span className="font-mono font-extrabold text-base text-white">
                        {ot.vehiclePlate}
                      </span>
                      <span className="text-xs font-semibold text-[#8E949F]">
                        • {ot.vehicleBrand} {ot.vehicleModel} ({ot.vehicleYear})
                      </span>
                      <WorkOrderStatusBadge status={ot.status} />
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#8E949F] flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-[#8E949F]" />
                        Cliente: <strong className="text-white">{ot.clientName}</strong> ({ot.clientPhone})
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#8E949F]" />
                        Ingreso: {new Date(ot.entryDate).toLocaleDateString('es-BO')}
                      </span>
                      {ot.assignedBayId && (
                        <span className="font-mono text-[10px] font-bold text-[#22C55E] bg-[#22C55E15] px-2 py-0.5 rounded-md border border-[#22C55E30]">
                          Bahía #{ot.assignedBayId}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#8E949F] line-clamp-1 italic">
                      Motivo: "{ot.entryReason}"
                    </p>
                  </div>

                  {/* Right Column: Amount in BOB, Alert Flag, Action */}
                  <div className="flex items-center justify-between lg:justify-end gap-6 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#2D3139]">
                    <div className="text-left lg:text-right">
                      <span className="text-[10px] font-semibold text-[#8E949F] block uppercase tracking-wider">
                        Presupuesto Total
                      </span>
                      <span className="text-lg font-extrabold text-white font-mono">
                        {ot.totalGeneralBOB > 0 ? `${ot.totalGeneralBOB.toLocaleString('es-BO')} BOB` : 'Pendiente Diag.'}
                      </span>
                      {ot.laborItems.length > 0 && (
                        <span className="text-[10px] text-[#8E949F] block font-mono">
                          {ot.laborItems.length} tareas | {ot.partsItems.length} repuestos
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        rightIcon={<ChevronRight className="w-4 h-4" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectOrder(ot.id);
                        }}
                      >
                        Ver Detalle
                      </Button>
                    </div>
                  </div>
                </div>

                {/* State Machine Mini Tracker */}
                <div className="mt-3 pt-3 border-t border-[#2D3139]/60">
                  <StatusPipeline
                    currentStatus={ot.status}
                    isSuspendedForAdditionalWork={ot.isSuspendedForAdditionalWork}
                    daysWithoutClientResponse={ot.daysWithoutClientResponse}
                    interactive={false}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Layers,
  Wrench,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  TrendingUp,
  ShieldAlert,
  Calendar,
  Eye,
  RefreshCw,
  PlusCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { Card } from '../../../shared/components/Card';
import { Button } from '../../../shared/components/Button';
import { Badge, BayStatusBadge, WorkOrderStatusBadge } from '../../../shared/components/Badge';
import { MetricCard } from '../../../shared/components/MetricCard';
import { Modal } from '../../../shared/components/Modal';
import { LoadingSkeleton } from '../../../shared/components/LoadingSkeleton';
import { EmptyState } from '../../../shared/components/EmptyState';
import { useToast } from '../../../shared/components/ToastContext';
import { baysService, type WorkshopMetrics } from '../api/bays-service';
import { workOrdersService } from '../../work-orders/api/work-orders-service';
import { isBackendMode } from '../../../shared/api/api-client';
import type { Bay, WorkOrder, Mechanic, BayStatus } from '../../../shared/types/openapi';

export const WorkshopHeadView: React.FC<{
  onSelectOrder?: (orderId: string) => void;
}> = ({ onSelectOrder }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const baysQuery = useQuery({ queryKey: ['bays'], queryFn: () => baysService.getAll() });
  const mechanicsQuery = useQuery({ queryKey: ['mechanics'], queryFn: () => baysService.getMechanics() });
  const ordersQuery = useQuery({ queryKey: ['work-orders'], queryFn: () => workOrdersService.getAll() });
  const metricsQuery = useQuery({ queryKey: ['workshop-metrics'], queryFn: () => baysService.getMetrics() });
  const bays: Bay[] = baysQuery.data?.data ?? [];
  const mechanics: Mechanic[] = mechanicsQuery.data?.data ?? [];
  const workOrders: WorkOrder[] = ordersQuery.data?.data ?? [];
  const metrics: WorkshopMetrics | null = metricsQuery.data?.data ?? null;

  // Assignment Modal state (HU-04, RN-14)
  const [selectedBayForAssign, setSelectedBayForAssign] = useState<Bay | null>(null);
  const [selectedOtCode, setSelectedOtCode] = useState<string>('');
  const [selectedPrimaryMechanic, setSelectedPrimaryMechanic] = useState<string>('');
  const [selectedAssistantMechanic, setSelectedAssistantMechanic] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Status Change Modal for Bay
  const [bayToEditStatus, setBayToEditStatus] = useState<Bay | null>(null);
  const [newBayStatus, setNewBayStatus] = useState<BayStatus>('LIBRE');

  const loadData = () => {
    void queryClient.invalidateQueries({ queryKey: ['bays'] });
    void queryClient.invalidateQueries({ queryKey: ['mechanics'] });
    void queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    void queryClient.invalidateQueries({ queryKey: ['workshop-metrics'] });
  };

  // Filter unassigned approved orders or registered orders needing bay
  const unassignedOrders = workOrders.filter(
    (o) => (String(o.status) === 'RECIBIDO' || o.status === 'APROBADA' || o.status === 'REGISTRADA' || o.status === 'DIAGNOSTICADA') && !o.assignedBayId
  );

  // Filter RN-06 alert orders (15+ days without response)
  const rn06AlertOrders = workOrders.filter(
    (o) => o.daysWithoutClientResponse >= 15 && o.status === 'PRESUPUESTADA'
  );

  // Filter RN-03 suspended orders
  const rn03SuspendedOrders = workOrders.filter((o) => o.isSuspendedForAdditionalWork);

  const handleOpenAssignModal = (bay: Bay) => {
    setSelectedBayForAssign(bay);
    setSelectedOtCode(unassignedOrders[0]?.code || '');
    setSelectedPrimaryMechanic(mechanics[0]?.id || '');
    setSelectedAssistantMechanic('');
  };

  const handleConfirmAssignment = async () => {
    if (!selectedBayForAssign || !selectedOtCode || !selectedPrimaryMechanic) {
      toast.warning('Datos incompletos', 'Seleccione la OT y el mecánico principal.');
      return;
    }

    setIsAssigning(true);
    try {
      const targetOt = workOrders.find((o) => o.code === selectedOtCode);
      await workOrdersService.assignBayAndMechanic(
        targetOt?.id ?? selectedOtCode,
        selectedBayForAssign.id,
        selectedPrimaryMechanic,
        selectedAssistantMechanic || undefined
      );

      // Transition to EN_PROGRESO if already approved
      if (!isBackendMode && targetOt && targetOt.status === 'APROBADA') {
        await workOrdersService.updateStatus(
          targetOt.id,
          'EN_PROGRESO',
          'Jefe de Taller (Asignación de Bahía HU-04, RN-14)'
        );
      }

      toast.success(
        'OT Asignada con Éxito (HU-04, RN-14)',
        `Orden ${selectedOtCode} asignada a ${selectedBayForAssign.name}.`
      );
      setSelectedBayForAssign(null);
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error en la asignación';
      toast.danger('Fallo en Asignación', msg);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUpdateBayStatus = async () => {
    if (!bayToEditStatus) return;
    try {
      await baysService.updateBayStatus(bayToEditStatus.id, newBayStatus);
      toast.success(`Estado de ${bayToEditStatus.name} actualizado a ${newBayStatus}`);
      setBayToEditStatus(null);
      await loadData();
    } catch {
      toast.danger('No se pudo actualizar el estado de la bahía');
    }
  };

  if (baysQuery.isPending || mechanicsQuery.isPending || ordersQuery.isPending || metricsQuery.isPending) {
    return <LoadingSkeleton rows={5} />;
  }

  if (baysQuery.isError || mechanicsQuery.isError || ordersQuery.isError || metricsQuery.isError) {
    return <EmptyState icon={<AlertTriangle className="w-8 h-8 text-[#EF4444]" />} title="No se pudo cargar el tablero" description="Verifique la sesión del jefe de taller y la conexión con el backend." actionLabel="Reintentar" onAction={loadData} />;
  }

  return (
    <div className="space-y-6">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F9731615] border border-[#F9731630] flex items-center justify-center text-[#F97316]">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Panel del Jefe de Taller
            </h1>
          </div>
          <p className="text-xs text-[#8E949F] mt-1.5">
            Supervisión en tiempo real de las 4 bahías, asignación de mecánicos (HU-04, RN-14) y control de alertas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} leftIcon={<RefreshCw className="w-4 h-4" />}>
            Actualizar Tablero
          </Button>
        </div>
      </div>

      {/* Critical Business Alerts: RN-06 and RN-03 */}
      <div className="space-y-3">
        {rn06AlertOrders.map((alertOt) => (
          <div
            key={alertOt.id}
            className="p-4 rounded-2xl bg-[#EF444410] border border-[#EF444430] text-[#E0E2E6] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-10 bg-[#EF4444] rounded-full shrink-0 mt-0.5"></div>
              <div>
                <h4 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                  <span className="text-[#EF4444]">ALERTA RN-06:</span> Orden {alertOt.code} ({alertOt.vehiclePlate}) superó los 15 días sin respuesta
                </h4>
                <p className="text-xs text-[#8E949F] mt-0.5">
                  Presupuesto de <strong className="text-white">{alertOt.totalGeneralBOB} BOB</strong> enviado el {alertOt.lastClientContactDate}.
                  Días transcurridos: <strong className="text-[#EF4444]">{alertOt.daysWithoutClientResponse} días</strong>.
                </p>
              </div>
            </div>
            {onSelectOrder && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => onSelectOrder(alertOt.id)}
                className="whitespace-nowrap w-full sm:w-auto"
              >
                Ver OT & Contactar
              </Button>
            )}
          </div>
        ))}

        {rn03SuspendedOrders.map((suspOt) => (
          <div
            key={suspOt.id}
            className="p-4 rounded-2xl bg-[#F59E0B10] border border-[#F59E0B30] text-[#E0E2E6] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-10 bg-[#F59E0B] rounded-full shrink-0 mt-0.5"></div>
              <div>
                <h4 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                  <span className="text-[#F59E0B]">SUSPENSIÓN ACTIVA RN-03:</span> Orden {suspOt.code} ({suspOt.vehiclePlate})
                </h4>
                <p className="text-xs text-[#8E949F] mt-0.5">
                  Motivo: <em className="text-[#E0E2E6]">"{suspOt.additionalWorkDescription}"</em> (+{suspOt.additionalWorkCostBOB} BOB). Trabajo congelado hasta autorización.
                </p>
              </div>
            </div>
            {onSelectOrder && (
              <Button
                variant="warning"
                size="sm"
                onClick={() => onSelectOrder(suspOt.id)}
                className="whitespace-nowrap w-full sm:w-auto"
              >
                Revisar Presupuesto Extra
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* KPI Productivity Metrics (Major 2nd scale, no clutter) */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Ocupación de Bahías"
            value={`${metrics.bayOccupancyRatePercent}%`}
            subtitle={`${metrics.occupiedBays + metrics.waitingPartsBays} de 4 bahías activas`}
            icon={<Layers className="w-5 h-5" />}
          />
          <MetricCard
            title="Órdenes Activas"
            value={metrics.activeWorkOrdersCount}
            subtitle="En progreso o espera"
            icon={<Wrench className="w-5 h-5" />}
          />
          <MetricCard
            title="Mecánicos en Bahía"
            value={`${metrics.mechanicsActive} / ${metrics.totalMechanics}`}
            subtitle="Personal técnico asignado"
            icon={<Users className="w-5 h-5" />}
          />
          <MetricCard
            title="Tiempo Ciclo Promedio"
            value={`${metrics.averageCycleTimeHours} hrs`}
            subtitle="Ingreso a finalización"
            icon={<Clock className="w-5 h-5" />}
          />
        </div>
      )}

      {/* 4 Bahías de Trabajo Grid (Central requirement) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E949F] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#F97316]"></span>
            Estado de las 4 Bahías de Trabajo
          </h2>
          <span className="text-xs text-[#8E949F] font-mono">Capacidad: 4 puestos</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bays.map((bay) => {
            const primaryMech = mechanics.find((m) => m.id === bay.primaryMechanicId);
            const assistantMech = mechanics.find((m) => m.id === bay.assistantMechanicId);
            const currentOt = workOrders.find((o) => o.code === bay.currentWorkOrderId);

            const isFree = bay.status === 'LIBRE';
            const isWaitingParts = bay.status === 'ESPERA_REPUESTO';
            const isOccupied = bay.status === 'OCUPADA';

            return (
              <Card
                key={bay.id}
                variant={isOccupied ? 'accent' : isWaitingParts ? 'warning' : 'default'}
                padding="md"
                className="flex flex-col justify-between hover:border-[#2D3139] transition-all"
              >
                <div className="min-w-0">
                  {/* Bay Header */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#2D3139]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-[#F97316] bg-[#F9731615] px-2 py-0.5 rounded border border-[#F9731630]">
                          {bay.code}
                        </span>
                        <h3 className="font-extrabold text-base text-white break-words leading-tight">
                          {bay.name}
                        </h3>
                      </div>
                      <p className="text-xs text-[#8E949F] mt-1">{bay.type}</p>
                    </div>
                    <BayStatusBadge status={bay.status} />
                  </div>

                  {/* Bay Content */}
                  <div className="py-4 space-y-3">
                    {isFree ? (
                      <div className="py-6 text-center text-[#8E949F] bg-[#1C2028]/50 rounded-xl border border-[#2D3139]/50">
                        <p className="text-sm font-semibold text-[#E0E2E6]">Bahía disponible sin vehículo asignado</p>
                        <p className="text-xs mt-1 text-[#8E949F]">Listo para recibir órdenes aprobadas en espera.</p>
                      </div>
                    ) : (
                      <>
                        <div className="p-3.5 rounded-xl bg-[#1C2028] border border-[#2D3139] flex items-center justify-between">
                          <div className="min-w-0">
                            <span className="text-[10px] text-[#8E949F] uppercase font-bold tracking-wider">Vehículo en Bahía</span>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                              <span className="font-mono font-bold text-base text-white break-all">
                                {bay.currentVehiclePlate}
                              </span>
                              <span className="text-xs text-[#8E949F] break-words">
                                • {bay.currentVehicleModel}
                              </span>
                            </div>
                          </div>
                          {bay.currentWorkOrderId && (
                            <span className="font-mono text-xs font-bold text-[#F97316] bg-[#F9731615] border border-[#F9731630] px-2.5 py-1 rounded-lg">
                              {bay.currentWorkOrderId}
                            </span>
                          )}
                        </div>

                        {/* Mechanics Assigned (HU-04, RN-14) */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-3 rounded-xl bg-[#1C2028] border border-[#2D3139]">
                            <span className="text-[10px] text-[#8E949F] uppercase tracking-wider block font-bold">Mecánico Principal</span>
                              <span className="font-bold text-white block mt-0.5 break-words leading-tight">
                                {primaryMech ? primaryMech.name : 'Sin asignar'}
                              </span>
                            <span className="text-[10px] text-[#F97316] block mt-0.5">
                              {primaryMech?.specialty}
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-[#1C2028] border border-[#2D3139]">
                            <span className="text-[10px] text-[#8E949F] uppercase tracking-wider block font-bold">Ayudante Técnico</span>
                              <span className="font-bold text-white block mt-0.5 break-words leading-tight">
                                {assistantMech ? assistantMech.name : 'No asignado'}
                              </span>
                            <span className="text-[10px] text-[#8E949F] block mt-0.5">Apoyo secundario</span>
                          </div>
                        </div>

                        {bay.notes && (
                          <div className="text-xs text-[#8E949F] italic bg-[#1C2028]/60 p-2.5 rounded-lg border border-[#2D3139]">
                            <strong className="text-[#E0E2E6]">Notas:</strong> {bay.notes}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Bay Actions */}
                <div className="pt-3 border-t border-[#2D3139] flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBayToEditStatus(bay);
                      setNewBayStatus(bay.status);
                    }}
                  >
                    Cambiar Estado
                  </Button>

                  {isFree ? (
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<PlusCircle className="w-4 h-4" />}
                      onClick={() => handleOpenAssignModal(bay)}
                    >
                      Asignar OT a Bahía (HU-04)
                    </Button>
                  ) : (
                    currentOt && onSelectOrder && (
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Eye className="w-4 h-4" />}
                        onClick={() => onSelectOrder(currentOt.id)}
                      >
                        Ver Detalle OT
                      </Button>
                    )
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Mechanics Capacity List */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2D3139]">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#F97316]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8E949F]">
              Personal Técnico del Taller (Mecánicos Asignables)
            </h2>
          </div>
          <span className="text-xs text-[#8E949F] font-mono">{mechanics.length} técnicos</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {mechanics.map((mech) => (
            <div
              key={mech.id}
              className="p-3.5 rounded-xl border border-[#2D3139] bg-[#1C2028] flex items-center justify-between"
            >
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-white break-words leading-tight">{mech.name}</h4>
                <p className="text-xs text-[#F97316] font-medium">{mech.specialty}</p>
                <p className="text-[11px] text-[#8E949F] mt-1 font-mono break-all">Tel: {mech.phone}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-[#E0E2E6] block">
                  {mech.activeOtCount} OT{mech.activeOtCount !== 1 ? 's' : ''}
                </span>
                <span className="text-[10px] text-[#8E949F] font-mono">
                  {mech.currentBayId ? `Bahía ${mech.currentBayId}` : 'En espera'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Assignment Modal (HU-04, RN-14) */}
      <Modal
        isOpen={!!selectedBayForAssign}
        onClose={() => setSelectedBayForAssign(null)}
        title={`Asignar Orden de Trabajo a ${selectedBayForAssign?.name}`}
        subtitle="Regla RN-14: Asignación de mecánico principal y ayudante con estimación de tiempo"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Seleccionar Orden de Trabajo en Espera <span className="text-rose-500">*</span>
            </label>
            {unassignedOrders.length === 0 ? (
              <p className="text-xs text-[#8E949F] italic p-3 bg-[#1C2028] rounded-xl border border-[#2D3139]">
                No hay órdenes pendientes de asignación en este momento.
              </p>
            ) : (
              <select
                value={selectedOtCode}
                onChange={(e) => setSelectedOtCode(e.target.value)}
                className="w-full rounded-xl border border-[#2D3139] bg-[#0F1115] text-[#E0E2E6] px-3.5 py-2.5 text-sm font-semibold min-h-[44px] focus:outline-none focus:border-[#F97316]"
              >
                {unassignedOrders.map((o) => (
                    <option key={o.id} value={o.code}>
                      {o.code} - {o.vehiclePlate} ({o.vehicleBrand} {o.vehicleModel}) - {o.status}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#8E949F] uppercase tracking-wider mb-1.5">
                Mecánico Principal (RN-14) <span className="text-[#EF4444]">*</span>
              </label>
              <select
                value={selectedPrimaryMechanic}
                onChange={(e) => setSelectedPrimaryMechanic(e.target.value)}
                className="w-full rounded-xl border border-[#2D3139] bg-[#0F1115] text-[#E0E2E6] px-3.5 py-2.5 text-sm min-h-[44px] focus:outline-none focus:border-[#F97316]"
              >
                {mechanics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.specialty})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8E949F] uppercase tracking-wider mb-1.5">
                Ayudante Técnico (Opcional)
              </label>
              <select
                value={selectedAssistantMechanic}
                onChange={(e) => setSelectedAssistantMechanic(e.target.value)}
                className="w-full rounded-xl border border-[#2D3139] bg-[#0F1115] text-[#E0E2E6] px-3.5 py-2.5 text-sm min-h-[44px] focus:outline-none focus:border-[#F97316]"
              >
                <option value="">Sin ayudante adicional</option>
                {mechanics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.specialty})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2.5 border-t border-[#2D3139]">
            <Button variant="outline" onClick={() => setSelectedBayForAssign(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              isLoading={isAssigning}
              disabled={unassignedOrders.length === 0}
              onClick={handleConfirmAssignment}
            >
              Confirmar Asignación de Bahía
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bay Status Change Modal */}
      <Modal
        isOpen={!!bayToEditStatus}
        onClose={() => setBayToEditStatus(null)}
        title={`Cambiar Estado de ${bayToEditStatus?.name}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#8E949F] uppercase tracking-wider mb-1.5">Nuevo Estado Operativo:</label>
            <select
              value={newBayStatus}
              onChange={(e) => setNewBayStatus(e.target.value as BayStatus)}
              className="w-full rounded-xl border border-[#2D3139] bg-[#0F1115] text-[#E0E2E6] px-3.5 py-2.5 text-sm min-h-[44px] focus:outline-none focus:border-[#F97316]"
            >
              <option value="LIBRE">Libre (Disponible para recibir vehículos)</option>
              <option value="OCUPADA">Ocupada (Vehículo en elevador/fosa)</option>
              <option value="ESPERA_REPUESTO">En Espera de Repuesto (Trabajo en pausa)</option>
              <option value="MANTENIMIENTO">En Mantenimiento de Equipamiento Taller</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-2.5 border-t border-[#2D3139]">
            <Button variant="outline" onClick={() => setBayToEditStatus(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleUpdateBayStatus}>
              Guardar Estado
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

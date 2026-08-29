import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Package,
  PlusCircle,
  ShieldAlert,
  Play,
  CheckSquare,
  Square,
  Lock,
  User,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { Card } from '../../../shared/components/Card';
import { Button } from '../../../shared/components/Button';
import { Badge, WorkOrderStatusBadge } from '../../../shared/components/Badge';
import { Modal } from '../../../shared/components/Modal';
import { Input } from '../../../shared/components/Input';
import { LoadingSkeleton } from '../../../shared/components/LoadingSkeleton';
import { EmptyState } from '../../../shared/components/EmptyState';
import { useToast } from '../../../shared/components/ToastContext';
import { workOrdersService } from '../../work-orders/api/work-orders-service';
import type { WorkOrder } from '../../../shared/types/openapi';

export const MechanicConsoleView: React.FC = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const assignedOrdersQuery = useQuery({ queryKey: ['work-orders', 'assigned'], queryFn: () => workOrdersService.getAssigned() });
  const workOrders: WorkOrder[] = assignedOrdersQuery.data?.data ?? [];

  // Additional work reporting modal (RN-03)
  const [reportingOt, setReportingOt] = useState<WorkOrder | null>(null);
  const [additionalDesc, setAdditionalDesc] = useState('');
  const [additionalHours, setAdditionalHours] = useState(2);
  const [additionalPartDesc, setAdditionalPartDesc] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const loadData = () => { void queryClient.invalidateQueries({ queryKey: ['work-orders', 'assigned'] }); };

  // RN-04: the backend scopes this list to the authenticated mechanic.
  const assignedOrders = workOrders;

  const handleToggleLabor = async (orderId: string, laborId: string) => {
    try {
      await workOrdersService.toggleLaborCompletion(orderId, laborId);
      toast.success('Estado de tarea actualizado');
      await loadData();
    } catch {
      toast.danger('No se pudo actualizar la tarea');
    }
  };

  const handleConfirmPartInstalled = async (orderId: string, partItemId: string) => {
    try {
      await workOrdersService.confirmPartInstalled(orderId, partItemId);
      toast.success(
        'Repuesto Instalado (RN-07, RN-08)',
        'Stock descontado automáticamente del inventario.'
      );
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrar repuesto';
      toast.danger('Fallo de Repuesto', msg);
    }
  };

  const handleReportAdditionalWork = async () => {
    if (!reportingOt || !additionalDesc.trim()) {
      toast.warning('Ingrese la descripción del daño o trabajo adicional detectado.');
      return;
    }

    setIsSubmittingReport(true);
    try {
      // Automatic suspension RN-03
      await workOrdersService.reportAdditionalWork(
        reportingOt.id,
        additionalDesc,
        750, // Cost calculated by system/Jefe de Taller
        [
          {
            description: `[ADICIONAL RN-03] ${additionalDesc}`,
            estimatedHours: Number(additionalHours) || 2,
            hourlyRateBOB: 120,
            totalBOB: (Number(additionalHours) || 2) * 120,
            assignedMechanicId: undefined,
          },
        ],
        additionalPartDesc
          ? [
              {
                partId: 'REP-ADD-001',
                partCode: 'REP-ADD',
                description: `[ADICIONAL RN-03] ${additionalPartDesc}`,
                quantityRequired: 1,
                unitPriceBOB: 200,
                totalBOB: 200,
              },
            ]
          : []
      );

      toast.warning(
        'Trabajo Suspendido por RN-03',
        'Se notificó al Jefe de Taller y al cliente. La orden queda pausada hasta confirmación explícita.'
      );
      setReportingOt(null);
      setAdditionalDesc('');
      setAdditionalPartDesc('');
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al reportar daño';
      toast.danger('Fallo al reportar', msg);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  if (assignedOrdersQuery.isPending) {
    return <LoadingSkeleton rows={4} />;
  }

  if (assignedOrdersQuery.isError) {
    return <EmptyState icon={<AlertTriangle className="w-8 h-8 text-[#EF4444]" />} title="No se pudieron cargar tus órdenes" description="Verifique que la sesión corresponda a un mecánico." actionLabel="Reintentar" onAction={loadData} />;
  }

  return (
    <div className="space-y-6">
      {/* Top Header with Role Switcher & RN-16 Compliance Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F9731615] border border-[#F9731630] flex items-center justify-center text-[#F97316]">
              <Wrench className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Consola del Mecánico (HU-03, RN-04)
            </h1>
          </div>
          <p className="text-xs text-[#8E949F] mt-1.5">
            Panel táctil de tareas en bahía, registro de diagnóstico, instalación de repuestos y reporte de imprevistos.
          </p>
        </div>

        {/* RN-16 Privacy Notice */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#16191F] border border-[#2D3139] text-xs font-semibold text-[#8E949F]">
          <Lock className="w-3.5 h-3.5 text-[#F97316]" />
          <span>RN-16: Vista técnica sin costos</span>
        </div>
      </div>

      <Card variant="flat" padding="sm">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8E949F]">
          <User className="w-4 h-4 text-[#F97316]" />
          <span>Sesión del mecánico autenticado</span>
        </div>
      </Card>

      {/* Assigned Orders Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E949F] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#F97316]" />
            Órdenes Asignadas ({assignedOrders.length})
          </h2>
          <Button variant="ghost" size="sm" onClick={loadData} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refrescar
          </Button>
        </div>

        {assignedOrders.length === 0 ? (
          <EmptyState
            icon={<Wrench className="w-8 h-8 text-[#8E949F]" />}
            title="Sin órdenes asignadas actualmente"
            description="No tienes vehículos en cola para tu puesto de trabajo. El Jefe de Taller te asignará la próxima orden disponible."
          />
        ) : (
          assignedOrders.map((ot) => {
            const isSuspended = ot.isSuspendedForAdditionalWork;

            return (
              <Card
                key={ot.id}
                variant={isSuspended ? 'warning' : 'default'}
                padding="md"
                className="space-y-4"
              >
                {/* OT Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2D3139]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-[#F97316] bg-[#F9731615] border border-[#F9731630] px-2 py-0.5 rounded-lg">
                        {ot.code}
                      </span>
                      <span className="font-mono font-extrabold text-base text-white break-all">
                        {ot.vehiclePlate}
                      </span>
                      <span className="text-xs font-semibold text-[#8E949F] break-words">
                        • {ot.vehicleBrand} {ot.vehicleModel} ({ot.vehicleYear})
                      </span>
                      {ot.assignedBayId && (
                        <span className="text-[10px] font-bold text-[#22C55E] bg-[#22C55E15] border border-[#22C55E30] px-2 py-0.5 rounded-md font-mono">
                          Bahía #{ot.assignedBayId}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8E949F] mt-1">
                      Cliente: <strong className="text-white">{ot.clientName}</strong> | Tel: {ot.clientPhone}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <WorkOrderStatusBadge status={ot.status} />
                  </div>
                </div>

                {/* RN-03 Suspension Alert if active */}
                {isSuspended && (
                  <div className="p-3 rounded-xl bg-[#F9731610] border border-[#F9731630] text-[#E0E2E6] flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-[#F97316] shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-bold text-[#F97316]">ORDEN SUSPENDIDA POR DAÑO ADICIONAL (RN-03):</span>{' '}
                      {ot.additionalWorkDescription}. <em className="text-[#8E949F]">Pausado hasta autorización del cliente.</em>
                    </div>
                  </div>
                )}

                {/* Entry Reason & Diagnostic */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#1C2028] border border-[#2D3139]">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-[#8E949F] block mb-1">Motivo de Ingreso:</span>
                    <p className="text-[#E0E2E6]">{ot.entryReason}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#1C2028] border border-[#2D3139]">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-[#8E949F] block mb-1">Diagnóstico Técnico:</span>
                    <p className="text-[#E0E2E6]">
                      {ot.diagnosticReport || 'En proceso de evaluación en bahía.'}
                    </p>
                  </div>
                </div>

                {/* Labor Checklist (HU-03) - STRICTLY NO PRICES (RN-16) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8E949F] flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-[#F97316]" />
                      Operaciones de Mano de Obra
                    </h3>
                    <span className="text-[10px] text-[#8E949F]">Toque para completar</span>
                  </div>

                  {ot.laborItems.length === 0 ? (
                    <p className="text-xs text-[#8E949F] italic">No hay tareas de mano de obra registradas aún.</p>
                  ) : (
                    <div className="space-y-2">
                      {ot.laborItems.map((lab) => (
                        <div
                          key={lab.id}
                          onClick={() => handleToggleLabor(ot.id, lab.id)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all min-h-[44px] ${
                            lab.isCompleted
                              ? 'bg-[#22C55E10] border-[#22C55E30] text-[#22C55E]'
                              : 'bg-[#1C2028] border-[#2D3139] hover:border-[#3D4149] text-[#E0E2E6]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-[#F97316]">
                              {lab.isCompleted ? (
                                <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                              ) : (
                                <Square className="w-4 h-4 text-[#8E949F]" />
                              )}
                            </div>
                            <span
                              className={`text-xs font-medium ${
                                lab.isCompleted ? 'line-through opacity-70' : 'text-white'
                              }`}
                            >
                              {lab.description}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#0F1115] text-[#8E949F] border border-[#2D3139]">
                              ⏱️ {lab.estimatedHours}h est.
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Parts Requisition & Installation (RN-07, RN-08) - STRICTLY NO PRICES (RN-16) */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8E949F] flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-[#F97316]" />
                      Repuestos Requeridos
                    </h3>
                  </div>

                  {ot.partsItems.length === 0 ? (
                    <p className="text-xs text-[#8E949F] italic">No se solicitaron repuestos para esta orden.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ot.partsItems.map((part) => {
                        const isInstalled = part.status === 'INSTALADO';

                        return (
                          <div
                            key={part.id}
                            className="p-3 rounded-xl border border-[#2D3139] bg-[#1C2028] flex items-center justify-between gap-2"
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold text-[#F97316]">
                                  {part.partCode}
                                </span>
                                <span className="text-xs font-bold text-white">
                                  x{part.quantityRequired} un.
                                </span>
                              </div>
                              <p className="text-xs text-[#8E949F] line-clamp-1">
                                {part.description}
                              </p>
                            </div>

                            {isInstalled ? (
                              <Badge variant="success" size="sm">
                                Instalado ✓
                              </Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleConfirmPartInstalled(ot.id, part.id)}
                                className="text-xs min-h-[36px]"
                              >
                                Confirmar Uso (RN-08)
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Mechanic Actions Footer */}
                <div className="pt-3 border-t border-[#2D3139] flex flex-wrap items-center justify-between gap-3">
                  <Button
                    variant="warning"
                    size="sm"
                    leftIcon={<AlertTriangle className="w-4 h-4" />}
                    onClick={() => setReportingOt(ot)}
                  >
                    Reportar Daño Adicional (RN-03)
                  </Button>

                  {ot.status === 'EN_PROGRESO' && (
                    <Button
                      variant="success"
                      size="sm"
                      leftIcon={<CheckCircle2 className="w-4 h-4" />}
                      onClick={async () => {
                        try {
                          await workOrdersService.updateStatus(
                            ot.id,
                            'FINALIZADA',
                            'Mecánico autenticado (Trabajo completado)'
                          );
                          toast.success('OT Finalizada', 'Orden lista para control de calidad y liquidación.');
                          await loadData();
                        } catch (err) {
                          toast.danger('No se pudo finalizar la orden');
                        }
                      }}
                    >
                      Completar y Pasar a Control de Calidad
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Report Additional Work Modal (RN-03) */}
      <Modal
        isOpen={!!reportingOt}
        onClose={() => setReportingOt(null)}
        title={`Reportar Daño Oculto en ${reportingOt?.vehiclePlate} (RN-03)`}
        subtitle="Regla RN-03: Suspende automáticamente el avance en bahía y genera cotización adicional para el cliente"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E949F] mb-1.5">
              Descripción Técnica del Daño Oculto <span className="text-[#EF4444]">*</span>
            </label>
            <textarea
              rows={3}
              value={additionalDesc}
              onChange={(e) => setAdditionalDesc(e.target.value)}
              placeholder="Ej: Fuga activa en retén de bancada al retirar protector de cárter..."
              className="w-full rounded-xl border border-[#2D3139] bg-[#0F1115] p-3 text-xs text-[#E0E2E6] focus:border-[#F97316] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Horas Adicionales Estimadas"
                type="number"
                value={additionalHours}
                onChange={(e) => setAdditionalHours(Number(e.target.value))}
                min={1}
                max={20}
              />
            </div>

            <div>
              <Input
                label="Repuesto Adicional (Opcional)"
                value={additionalPartDesc}
                onChange={(e) => setAdditionalPartDesc(e.target.value)}
                placeholder="Ej: Retén trasero de cigüeñal OEM"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#F9731610] border border-[#F9731630] text-[#E0E2E6] text-xs">
            ⚠️ <strong className="text-white">Efecto Inmediato:</strong> La orden cambiará a estado <em className="text-[#F97316]">Suspendido por RN-03</em>. Se notificará al cliente para aprobación formal.
          </div>

          <div className="pt-4 flex justify-end gap-2.5 border-t border-[#2D3139]">
            <Button variant="outline" onClick={() => setReportingOt(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              isLoading={isSubmittingReport}
              onClick={handleReportAdditionalWork}
              leftIcon={<ShieldAlert className="w-4 h-4" />}
            >
              Aplicar Suspensión (RN-03)
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

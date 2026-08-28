import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  FileText,
  Car,
  User,
  Clock,
  Wrench,
  Package,
  CheckCircle2,
  AlertTriangle,
  Printer,
  ShieldAlert,
  Calendar,
  Layers,
  History,
  DollarSign,
  Send,
  PlusCircle,
  Share2,
} from 'lucide-react';
import { Card } from '../../../shared/components/Card';
import { Button } from '../../../shared/components/Button';
import { Badge, WorkOrderStatusBadge } from '../../../shared/components/Badge';
import { StatusPipeline } from '../../../shared/components/StatusPipeline';
import { Modal } from '../../../shared/components/Modal';
import { LoadingSkeleton } from '../../../shared/components/LoadingSkeleton';
import { useToast } from '../../../shared/components/ToastContext';
import { workOrdersService } from '../api/work-orders-service';
import type { WorkOrder, WorkOrderStatus } from '../../../shared/types/openapi';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface WorkOrderDetailViewProps {
  orderId: string;
  onBack: () => void;
  onNavigateToBilling?: (orderId: string) => void;
  onNavigateToQuotation?: (orderId: string) => void;
}

export const WorkOrderDetailView: React.FC<WorkOrderDetailViewProps> = ({
  orderId,
  onBack,
  onNavigateToBilling,
  onNavigateToQuotation,
}) => {
  const toast = useToast();
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Transition confirmation modal
  const [targetStatus, setTargetStatus] = useState<WorkOrderStatus | null>(null);
  const [transitionReason, setTransitionReason] = useState('');

  // Printable Report Mode
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const loadOrder = async () => {
    setIsLoading(true);
    try {
      const res = await workOrdersService.getById(orderId);
      setOrder(res.data);
    } catch {
      toast.danger('Error al cargar detalle de la orden');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const handleTriggerTransition = async (status: WorkOrderStatus) => {
    if (!order) return;
    setIsTransitioning(true);
    try {
      await workOrdersService.updateStatus(
        order.id,
        status,
        'Jefe de Taller / Administración',
        transitionReason || undefined
      );
      toast.success(
        'Transición de Estado Exitosa',
        `La orden ${order.code} avanzó a estado ${status}.`
      );
      setTargetStatus(null);
      setTransitionReason('');
      await loadOrder();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar estado';
      toast.danger('Transición Bloqueada', msg);
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleApproveAdditionalWork = async () => {
    if (!order) return;
    try {
      await workOrdersService.approveAdditionalWork(order.id, 'PORTAL_WEB');
      toast.success('Trabajo Adicional Aprobado (RN-02, RN-03)', 'Se levantó la suspensión en bahía.');
      await loadOrder();
    } catch {
      toast.danger('No se pudo aprobar el trabajo adicional');
    }
  };

  if (isLoading || !order) {
    return <LoadingSkeleton rows={6} />;
  }

  const isSuspended = order.isSuspendedForAdditionalWork;
  const isRN06Alert = order.daysWithoutClientResponse >= 15 && order.status === 'PRESUPUESTADA';

  return (
    <div className="space-y-6">
      {/* Back and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Volver a la Lista
          </Button>
          <span className="font-mono text-xs font-bold text-neutral-400">ID: {order.id}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={() => setIsPrintModalOpen(true)}
          >
            Generar Reporte Imprimible
          </Button>

          {onNavigateToQuotation && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Send className="w-4 h-4" />}
              onClick={() => onNavigateToQuotation(order.id)}
            >
              Presupuesto / Cotización
            </Button>
          )}

          {onNavigateToBilling && order.status === 'FINALIZADA' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<DollarSign className="w-4 h-4" />}
              onClick={() => onNavigateToBilling(order.id)}
            >
              Liquidar Cuenta en BOB (RN-21)
            </Button>
          )}
        </div>
      </div>

      {/* Main Order Header Card */}
      <Card variant={isSuspended ? 'warning' : isRN06Alert ? 'danger' : 'default'} padding="lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#2D3139]">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-xs font-bold text-[#F97316] bg-[#F9731615] border border-[#F9731630] px-3 py-1 rounded-xl">
                {order.code}
              </span>
              <h1 className="font-mono text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {order.vehiclePlate}
              </h1>
              <span className="text-sm font-semibold text-[#8E949F]">
                • {order.vehicleBrand} {order.vehicleModel} ({order.vehicleYear})
              </span>
              <WorkOrderStatusBadge status={order.status} size="lg" />
            </div>

            <div className="mt-2 flex items-center gap-3 text-xs text-[#8E949F] flex-wrap">
              <span>Cliente: <strong className="text-white">{order.clientName}</strong></span>
              <span>CI/NIT: <strong className="text-white">{order.clientDocument}</strong></span>
              <span>Tel: <strong className="text-white">{order.clientPhone}</strong></span>
              <span>Ingreso: <strong className="text-white">{new Date(order.entryDate).toLocaleDateString('es-BO')}</strong></span>
            </div>
          </div>

          <div className="text-left lg:text-right">
            <span className="text-[10px] font-semibold text-[#8E949F] block uppercase tracking-wider">Costo Total Estimado</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
              {order.totalGeneralBOB.toLocaleString('es-BO')} BOB
            </span>
            <span className="text-[11px] text-[#8E949F] block mt-0.5 font-mono">
              Mano de Obra: {order.totalLaborBOB} Bs. | Repuestos: {order.totalPartsBOB} Bs.
            </span>
          </div>
        </div>

        {/* State Machine Interactive Visualization */}
        <div className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8E949F]">
              Máquina de Estados Operativa
            </h3>
            <span className="text-[11px] text-[#8E949F]">Toque un paso adyacente para realizar la transición</span>
          </div>

          <StatusPipeline
            currentStatus={order.status}
            isSuspendedForAdditionalWork={order.isSuspendedForAdditionalWork}
            daysWithoutClientResponse={order.daysWithoutClientResponse}
            interactive={true}
            onSelectNextStatus={(status) => setTargetStatus(status)}
          />
        </div>
      </Card>

      {/* RN-03 Additional Work Action Banner */}
      {isSuspended && (
        <Card variant="warning" padding="md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-[#F97316] shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-white">
                  Suspensión Automática Activa por Trabajo Adicional (RN-03)
                </h4>
                <p className="text-xs text-[#8E949F] mt-1">
                  Motivo reportado: <strong className="text-white">"{order.additionalWorkDescription}"</strong> (+{order.additionalWorkCostBOB} BOB).
                  El avance en bahía está congelado hasta recibir la aprobación formal del cliente.
                </p>
              </div>
            </div>
            <Button
              variant="success"
              size="md"
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
              onClick={handleApproveAdditionalWork}
              className="whitespace-nowrap"
            >
              Registrar Aprobación Cliente (RN-02)
            </Button>
          </div>
        </Card>
      )}

      {/* Grid of Sections: Diagnosis, Labor Items, Parts Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Diagnostics & Entry Reason */}
        <div className="space-y-4">
          <Card padding="md">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#2D3139]">
              <FileText className="w-4 h-4 text-[#F97316]" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E949F]">
                Diagnóstico & Motivo de Ingreso
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#1C2028] border border-[#2D3139]">
                <span className="text-[10px] uppercase font-bold text-[#8E949F] block mb-1">Síntomas Reportados por Cliente:</span>
                <p className="text-[#E0E2E6]">{order.entryReason}</p>
              </div>

              <div className="p-3 rounded-xl bg-[#1C2028] border border-[#2D3139]">
                <span className="text-[10px] uppercase font-bold text-[#8E949F] block mb-1">Informe Técnico de Diagnóstico:</span>
                <p className="text-[#E0E2E6]">
                  {order.diagnosticReport || 'Diagnóstico preliminar pendiente de registro en bahía.'}
                </p>
              </div>

              {order.mechanicNotes && (
                <div className="p-3 rounded-xl bg-[#F9731610] border border-[#F9731630] text-[#E0E2E6]">
                  <span className="text-[10px] uppercase font-bold text-[#F97316] block mb-1">Notas Técnicas del Mecánico:</span>
                  <p className="text-xs">{order.mechanicNotes}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Audit Trail / Status History */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#2D3139]">
              <History className="w-4 h-4 text-[#F97316]" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E949F]">
                Bitácora de Auditoría de Estados
              </h2>
            </div>

            <div className="space-y-3">
              {order.statusHistory.map((hist, idx) => (
                <div key={idx} className="flex items-start gap-3 text-xs">
                  <div className="w-2 h-2 rounded-full bg-[#F97316] shrink-0 mt-1.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{hist.status}</span>
                      <span className="text-[#8E949F] font-mono text-[10px]">
                        {new Date(hist.timestamp).toLocaleString('es-BO')}
                      </span>
                    </div>
                    <p className="text-[#8E949F] mt-0.5">Por: {hist.changedBy}</p>
                    {hist.reason && <p className="text-[#8E949F] italic mt-0.5">"{hist.reason}"</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Labor & Parts Breakdown (BOB - RN-21, RN-22) */}
        <div className="space-y-4">
          {/* Labor Breakdown */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#2D3139]">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#F97316]" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E949F]">
                  Mano de Obra ({order.totalLaborBOB} BOB)
                </h2>
              </div>
              <span className="text-[10px] text-[#8E949F]">Tarifa: 120 Bs./h</span>
            </div>

            {order.laborItems.length === 0 ? (
              <p className="text-xs text-[#8E949F] italic">No hay ítems de mano de obra registrados.</p>
            ) : (
              <div className="space-y-2">
                {order.laborItems.map((lab) => (
                  <div
                    key={lab.id}
                    className="p-3 rounded-xl border border-[#2D3139] bg-[#1C2028] flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        {lab.isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                        ) : (
                          <Clock className="w-4 h-4 text-[#F97316]" />
                        )}
                        <span className="text-xs font-semibold text-white">
                          {lab.description}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#8E949F] ml-6 font-mono">
                        {lab.estimatedHours}h × {lab.hourlyRateBOB} Bs./h
                      </span>
                    </div>

                    <span className="text-xs font-mono font-bold text-[#F97316]">
                      {lab.totalBOB} BOB
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Parts Breakdown */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#2D3139]">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#F97316]" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E949F]">
                  Repuestos & Materiales ({order.totalPartsBOB} BOB)
                </h2>
              </div>
              <span className="text-[10px] text-[#8E949F]">{order.partsItems.length} ítems</span>
            </div>

            {order.partsItems.length === 0 ? (
              <p className="text-xs text-[#8E949F] italic">No se requirieron repuestos para esta orden.</p>
            ) : (
              <div className="space-y-2">
                {order.partsItems.map((part) => (
                  <div
                    key={part.id}
                    className="p-3 rounded-xl border border-[#2D3139] bg-[#1C2028] flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-[#F97316]">{part.partCode}</span>
                        <span className="text-xs font-semibold text-white">
                          {part.description}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#8E949F]">
                        x{part.quantityRequired} un. a {part.unitPriceBOB} Bs. | Estado: <strong className="text-white">{part.status}</strong>
                      </span>
                    </div>

                    <span className="text-xs font-mono font-bold text-[#F97316]">
                      {part.totalBOB} BOB
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Transition Confirmation Modal */}
      <Modal
        isOpen={!!targetStatus}
        onClose={() => setTargetStatus(null)}
        title={`Confirmar Cambio de Estado a "${targetStatus}"`}
        subtitle="Reglas del taller: Las transiciones registran fecha, hora y responsable en la bitácora"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#8E949F]">
            ¿Desea cambiar el estado de la orden <strong className="text-white">{order.code}</strong> de <strong className="text-[#F97316]">{order.status}</strong> a{' '}
            <strong className="text-[#22C55E]">{targetStatus}</strong>?
          </p>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E949F] mb-1.5">Motivo o Comentario (Opcional):</label>
            <input
              type="text"
              value={transitionReason}
              onChange={(e) => setTransitionReason(e.target.value)}
              placeholder="Ej: Aprobación telefónica, piezas recibidas en taller..."
              className="w-full rounded-xl border border-[#2D3139] bg-[#0F1115] p-2.5 text-xs text-white focus:outline-none focus:border-[#F97316]"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2.5 border-t border-[#2D3139]">
            <Button variant="outline" onClick={() => setTargetStatus(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              isLoading={isTransitioning}
              onClick={() => targetStatus && handleTriggerTransition(targetStatus)}
            >
              Confirmar Transición
            </Button>
          </div>
        </div>
      </Modal>

      {/* Official Printable Work Order Report Modal */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="Reporte Oficial de Orden de Trabajo"
        maxWidth="2xl"
      >
        <div className="space-y-4 text-[#E0E2E6]">
          {/* Official Letterhead Header */}
          <div className="p-4 rounded-2xl bg-[#1C2028] border border-[#2D3139] flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-base tracking-tight text-white">TALLER MECÁNICO "LOS FRATELLI"</h2>
              <p className="text-xs text-[#8E949F]">
                Especialistas en Vehículos Livianos • 4 Bahías de Servicio Certificadas
              </p>
              <p className="text-[10px] text-[#8E949F] mt-0.5">Av. Arce #2410, La Paz - Bolivia • Tel: +591 2 2441920</p>
            </div>
            <div className="text-right">
              <span className="font-mono text-sm font-bold text-[#F97316]">{order.code}</span>
              <p className="text-[10px] text-[#8E949F]">{new Date().toLocaleDateString('es-BO')}</p>
            </div>
          </div>

          {/* Vehicle & Client Summary */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-[#2D3139] bg-[#1C2028] space-y-1">
              <span className="font-bold text-[10px] uppercase text-[#8E949F]">Datos del Cliente:</span>
              <p className="font-bold text-white text-xs">{order.clientName}</p>
              <p className="text-[#8E949F]">CI/NIT: {order.clientDocument}</p>
              <p className="text-[#8E949F]">Teléfono: {order.clientPhone}</p>
            </div>

            <div className="p-3 rounded-xl border border-[#2D3139] bg-[#1C2028] space-y-1">
              <span className="font-bold text-[10px] uppercase text-[#8E949F]">Datos del Vehículo:</span>
              <p className="font-bold text-white text-xs">{order.vehicleBrand} {order.vehicleModel} ({order.vehicleYear})</p>
              <p className="font-mono font-bold text-[#F97316]">Placa: {order.vehiclePlate}</p>
              <p className="text-[#8E949F]">Estado OT: {order.status}</p>
            </div>
          </div>

          {/* Financial Detail in BOB */}
          <div className="space-y-2 text-xs">
            <h4 className="font-bold uppercase text-[10px] text-[#8E949F]">Desglose de Liquidación Proforma (BOB):</h4>
            <Table className="border border-[#2D3139] rounded-xl overflow-hidden text-left">
              <TableHeader className="bg-[#1C2028] text-[#8E949F] text-[10px] uppercase font-bold">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-auto p-2.5">Concepto</TableHead>
                  <TableHead className="h-auto p-2.5">Cant / Horas</TableHead>
                  <TableHead className="h-auto p-2.5 text-right">Monto (BOB)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-[#2D3139] text-xs">
                {order.laborItems.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="p-2.5 text-white">Mano de Obra: {l.description}</TableCell>
                    <TableCell className="p-2.5 text-[#8E949F] font-mono">{l.estimatedHours} hrs</TableCell>
                    <TableCell className="p-2.5 text-right font-mono text-[#F97316]">{l.totalBOB} Bs.</TableCell>
                  </TableRow>
                ))}
                {order.partsItems.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="p-2.5 text-white">Repuesto: {p.partCode} - {p.description}</TableCell>
                    <TableCell className="p-2.5 text-[#8E949F] font-mono">x{p.quantityRequired}</TableCell>
                    <TableCell className="p-2.5 text-right font-mono text-[#F97316]">{p.totalBOB} Bs.</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="bg-[#1C2028] font-bold border-t border-[#2D3139] hover:bg-[#1C2028]">
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={2} className="p-2.5 text-right text-xs uppercase text-[#8E949F]">TOTAL GENERAL:</TableCell>
                  <TableCell className="p-2.5 text-right font-mono text-sm text-[#F97316]">{order.totalGeneralBOB} BOB</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          <div className="pt-4 grid grid-cols-2 gap-6 text-center text-xs">
            <div className="border-t border-[#2D3139] pt-2">
              <p className="font-semibold text-white">Firma Jefe de Taller</p>
              <p className="text-[10px] text-[#8E949F]">Taller Mecánico Los Fratelli</p>
            </div>
            <div className="border-t border-[#2D3139] pt-2">
              <p className="font-semibold text-white">Firma / Conformidad Cliente</p>
              <p className="text-[10px] text-[#8E949F]">{order.clientName}</p>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2.5 border-t border-[#2D3139]">
            <Button variant="outline" onClick={() => setIsPrintModalOpen(false)}>
              Cerrar
            </Button>
            <Button
              variant="primary"
              leftIcon={<Printer className="w-4 h-4" />}
              onClick={() => {
                window.print();
                toast.info('Diálogo de impresión enviado');
              }}
            >
              Imprimir Reporte
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

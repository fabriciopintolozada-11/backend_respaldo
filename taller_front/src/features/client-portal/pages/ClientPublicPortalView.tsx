import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Car,
  Search,
  CheckCircle2,
  Clock,
  Wrench,
  Package,
  ShieldAlert,
  AlertTriangle,
  Phone,
  MapPin,
  Calendar,
  Layers,
  FileText,
  ThumbsUp,
  ExternalLink,
} from 'lucide-react';
import { Card } from '../../../shared/components/Card';
import { Button } from '../../../shared/components/Button';
import { Badge, WorkOrderStatusBadge } from '../../../shared/components/Badge';
import { StatusPipeline } from '../../../shared/components/StatusPipeline';
import { Input } from '../../../shared/components/Input';
import { useToast } from '../../../shared/components/ToastContext';
import { workOrdersService } from '../../work-orders/api/work-orders-service';
import type { WorkOrder } from '../../../shared/types/openapi';

export const ClientPublicPortalView: React.FC = () => {
  const toast = useToast();
  const [searchPlate, setSearchPlate] = useState('3849-ABC');
  const [searchDocument, setSearchDocument] = useState('');
  const [foundOrder, setFoundOrder] = useState<WorkOrder | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const publicStatusQuery = useQuery({
    queryKey: ['public-vehicle-status', searchPlate, searchDocument],
    queryFn: () => workOrdersService.searchPublic({ plate: searchPlate.trim(), identification: searchDocument.trim() }),
    enabled: false,
  });

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchPlate.trim() || !searchDocument.trim()) {
      toast.warning('Ingrese la placa y el documento del propietario');
      return;
    }

    setHasSearched(true);
    const result = await publicStatusQuery.refetch();
    if (result.data?.data.length) {
      setFoundOrder(result.data.data[0]);
    } else {
      setFoundOrder(null);
    }
    if (result.isError) {
      toast.danger('No se pudo realizar la consulta');
      setFoundOrder(null);
    }
  };

  const handleClientApproveFromPortal = async () => {
    if (!foundOrder) return;
    try {
      if (foundOrder.isSuspendedForAdditionalWork) {
        await workOrdersService.approveAdditionalWork(foundOrder.id, 'PORTAL_WEB');
        toast.success(
          'Trabajo Adicional Aprobado',
          '¡Gracias! Notificamos al equipo mecánico para reanudar el trabajo en bahía.'
        );
      } else if (foundOrder.status === 'PRESUPUESTADA') {
        await workOrdersService.updateStatus(
          foundOrder.id,
          'APROBADA',
          `Cliente (Portal Web RN-17: ${foundOrder.clientName})`
        );
        toast.success(
          'Presupuesto Aprobado (RN-02)',
          'Su vehículo fue programado para asignación en bahía de trabajo.'
        );
      }
      // Refresh order
      const updated = await workOrdersService.getById(foundOrder.id);
      setFoundOrder(updated.data);
    } catch {
      toast.danger('Error al enviar la aprobación');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Client Portal Header */}
      <div className="text-center space-y-2 py-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F9731615] border border-[#F9731630] text-[#F97316] text-xs font-bold uppercase tracking-wider">
          Portal Público de Consulta (RN-17)
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Seguimiento en Vivo de su Vehículo
        </h1>
        <p className="text-xs sm:text-sm text-[#8E949F] max-w-lg mx-auto">
          Taller Mecánico <strong className="text-white">"Los Fratelli"</strong> — Consulte el estado de diagnóstico, avance en bahía y
          presupuesto de su orden en tiempo real sin contraseñas.
        </p>
      </div>

      {/* Search Consultation Form (RN-17) */}
      <Card variant="flat" padding="lg">
      <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Placa de su Vehículo"
                value={searchPlate}
                onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
                placeholder="Ej: 3849-ABC"
                icon={<Car className="w-4 h-4 text-[#F97316]" />}
                required
              />
            </div>

            <div>
              <Input
                label="Documento de identidad del propietario"
                value={searchDocument}
                onChange={(e) => setSearchDocument(e.target.value.toUpperCase())}
                placeholder="Ej: 4892019 LP"
                icon={<FileText className="w-4 h-4 text-[#F97316]" />}
              />
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
               isLoading={publicStatusQuery.isFetching}
              leftIcon={<Search className="w-4 h-4" />}
              className="w-full sm:w-auto px-8"
            >
              Consultar Estado de Mi Vehículo
            </Button>
          </div>
        </form>
      </Card>

      {/* Search Result */}
      {hasSearched && !publicStatusQuery.isFetching && !foundOrder && (
        <Card padding="lg" className="text-center py-10 space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#1C2028] border border-[#2D3139] flex items-center justify-center mx-auto text-[#8E949F]">
            <Car className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">
            No se encontró ninguna orden activa para la placa {searchPlate}
          </h3>
          <p className="text-xs text-[#8E949F] max-w-md mx-auto">
            Verifique que la placa esté escrita correctamente o comuníquese directamente con recepción al{' '}
            <strong className="text-white">+591 2 2441920</strong>.
          </p>
        </Card>
      )}

      {foundOrder && (
        <div className="space-y-4">
          {/* Main Status Display */}
          <Card
            variant={
              foundOrder.isSuspendedForAdditionalWork
                ? 'warning'
                : foundOrder.status === 'FINALIZADA'
                ? 'success'
                : 'default'
            }
            padding="lg"
            className="space-y-5"
          >
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2D3139]">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-xs font-bold text-[#F97316] bg-[#F9731615] border border-[#F9731630] px-2.5 py-1 rounded-lg">
                    {foundOrder.code}
                  </span>
                  <span className="font-mono font-extrabold text-xl text-white">
                    {foundOrder.vehiclePlate}
                  </span>
                  <span className="text-xs font-semibold text-[#8E949F]">
                    • {foundOrder.vehicleBrand} {foundOrder.vehicleModel} ({foundOrder.vehicleYear})
                  </span>
                </div>
                <p className="text-xs text-[#8E949F] mt-1">
                  Titular: <strong className="text-white">{foundOrder.clientName}</strong> | Ingreso:{' '}
                  {new Date(foundOrder.entryDate).toLocaleDateString('es-BO')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <WorkOrderStatusBadge status={foundOrder.status} size="lg" />
              </div>
            </div>

            {/* Live Visual Pipeline */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E949F]">
                Progreso del Trabajo en el Taller:
              </h3>
              <StatusPipeline
                currentStatus={foundOrder.status}
                isSuspendedForAdditionalWork={foundOrder.isSuspendedForAdditionalWork}
                daysWithoutClientResponse={foundOrder.daysWithoutClientResponse}
                interactive={false}
              />
            </div>

            {/* RN-03 Suspension Alert (Actionable for client) */}
            {foundOrder.isSuspendedForAdditionalWork && (
              <div className="p-3.5 rounded-2xl bg-[#F9731615] border border-[#F9731630] text-[#E0E2E6] space-y-3">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-[#F97316] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-white">
                      Atención: Trabajo Adicional Detectado en Bahía (RN-03)
                    </h4>
                    <p className="text-xs text-[#8E949F] mt-1">
                      Nuestros mecánicos encontraron una falla imprevista durante la inspección:{' '}
                      <strong className="text-white">"{foundOrder.additionalWorkDescription}"</strong>.
                    </p>
                    <p className="text-xs mt-1 text-[#8E949F]">
                      Costo adicional estimado: <strong className="text-[#F97316]">+{foundOrder.additionalWorkCostBOB} BOB</strong>. Por seguridad y
                      transparencia, el trabajo está pausado hasta su consentimiento formal.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    variant="success"
                    size="sm"
                    leftIcon={<ThumbsUp className="w-3.5 h-3.5" />}
                    onClick={handleClientApproveFromPortal}
                  >
                    Autorizar Trabajo Adicional (+{foundOrder.additionalWorkCostBOB} Bs.)
                  </Button>
                </div>
              </div>
            )}

            {/* Direct Budget Approval for PRESUPUESTADA status */}
            {foundOrder.status === 'PRESUPUESTADA' && (
              <div className="p-3.5 rounded-2xl bg-[#3B82F615] border border-[#3B82F630] text-[#E0E2E6] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-sm text-white">Presupuesto Listo para su Aprobación (RN-02)</h4>
                  <p className="text-xs text-[#8E949F] mt-0.5">
                    Monto total estimado:{' '}
                    <strong className="font-mono text-white text-sm">{foundOrder.totalGeneralBOB} BOB</strong>. Toque el botón
                    para autorizar el inicio inmediato de reparaciones.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<ThumbsUp className="w-3.5 h-3.5" />}
                  onClick={handleClientApproveFromPortal}
                  className="whitespace-nowrap"
                >
                  Aprobar Presupuesto ({foundOrder.totalGeneralBOB} Bs.)
                </Button>
              </div>
            )}

            {/* Ready for Pickup Alert */}
            {foundOrder.status === 'FINALIZADA' && (
              <div className="p-3.5 rounded-2xl bg-[#22C55E15] border border-[#22C55E30] text-[#E0E2E6] flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#22C55E] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-white">¡Su vehículo está listo para ser retirado!</h4>
                  <p className="text-xs text-[#8E949F] mt-1">
                    El equipo técnico completó todas las tareas y pasó el control de calidad. Puede pasar por nuestras
                    instalaciones en horario de atención (08:00 a 18:30) para la liquidación y entrega.
                  </p>
                </div>
              </div>
            )}

            {/* Financial Summary & Technical Report */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#1C2028] border border-[#2D3139] space-y-1.5">
                <span className="font-bold text-[#8E949F] block uppercase text-[10px]">Diagnóstico Reportado:</span>
                <p className="text-white">
                  {foundOrder.diagnosticReport || 'En proceso de evaluación por el equipo técnico.'}
                </p>
                <p className="text-[11px] text-[#8E949F] italic mt-1">Motivo de ingreso: "{foundOrder.entryReason}"</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#1C2028] border border-[#2D3139] space-y-1.5">
                <span className="font-bold text-[#8E949F] block uppercase text-[10px]">Resumen Económico (BOB):</span>
                <div className="flex justify-between text-xs text-[#8E949F]">
                  <span>Mano de Obra:</span>
                  <span className="font-mono font-semibold text-white">{foundOrder.totalLaborBOB} Bs.</span>
                </div>
                <div className="flex justify-between text-xs text-[#8E949F]">
                  <span>Repuestos Requeridos:</span>
                  <span className="font-mono font-semibold text-white">{foundOrder.totalPartsBOB} Bs.</span>
                </div>
                <div className="pt-2 border-t border-[#2D3139] flex justify-between font-bold text-xs">
                  <span className="text-white">Total Proforma:</span>
                  <span className="font-mono text-sm text-[#F97316]">{foundOrder.totalGeneralBOB} BOB</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Workshop Location & Contact Card */}
      <Card variant="flat" padding="md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#8E949F]">
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-[#F97316] shrink-0" />
            <div>
              <span className="font-bold text-white block">Ubicación del Taller:</span>
              <span>Av. Arce #2410, La Paz - Bolivia</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-[#F97316] shrink-0" />
            <div>
              <span className="font-bold text-white block">Teléfonos de Contacto:</span>
              <span>+591 2 2441920 / +591 76543210</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-[#F97316] shrink-0" />
            <div>
              <span className="font-bold text-white block">Horario de Atención:</span>
              <span>Lun a Vie: 08:00 - 18:30 | Sáb: 08:30 - 13:00</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

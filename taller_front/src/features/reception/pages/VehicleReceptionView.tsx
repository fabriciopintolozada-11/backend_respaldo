import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Car,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
  ShieldCheck,
  Fuel,
  Wrench,
  Sparkles,
  ClipboardList,
  Ban,
  Clock,
  Check,
} from 'lucide-react';
import { Card } from '../../../shared/components/Card';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';
import { FuelTypeBadge, Badge } from '../../../shared/components/Badge';
import { useToast } from '../../../shared/components/ToastContext';
import { vehiclesService } from '../api/vehicles-service';
import { workOrdersService } from '../../work-orders/api/work-orders-service';
import type { Vehicle, FuelType } from '../../../shared/types/openapi';

const receptionSchema = z.object({
  plate: z
    .string()
    .min(5, 'La placa debe tener al menos 5 caracteres')
    .max(10, 'Placa demasiado larga')
    .regex(/^[0-9A-Za-z-]+$/, 'Formato de placa inválido (ej: 4589-KXA)'),
  brand: z.string().min(2, 'Ingrese la marca'),
  model: z.string().min(2, 'Ingrese el modelo'),
  year: z.number().min(1980, 'Año mínimo 1980').max(new Date().getFullYear() + 1, 'Año no válido'),
  fuelType: z.enum(['GASOLINA', 'DIESEL', 'HIBRIDO', 'ELECTRICO'] as const),
  color: z.string().min(2, 'Ingrese el color'),
  mileage: z.number().min(0, 'Kilometraje no puede ser negativo'),
  vin: z.string().optional(),
  clientName: z.string().min(3, 'Nombre del cliente requerido'),
  clientDocument: z.string().min(5, 'Cédula de Identidad o NIT requerido'),
  clientPhone: z.string().min(7, 'Teléfono requerido'),
  clientEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  entryReason: z.string().min(10, 'Describa los síntomas o motivo de ingreso (mínimo 10 caracteres)'),
  fuelLevel: z.enum(['VACIO', '1/4', '1/2', '3/4', 'LLENO'] as const),
  spareTire: z.boolean(),
  jackAndTools: z.boolean(),
  documentsInCar: z.boolean(),
  valuableBelongings: z.string().optional(),
  scratchesOrDents: z.string().optional(),
});

type ReceptionFormData = z.infer<typeof receptionSchema>;

export const VehicleReceptionView: React.FC<{
  onOrderCreated?: (orderId: string) => void;
}> = ({ onOrderCreated }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchPlateInput, setSearchPlateInput] = useState('');
  const [existingVehicle, setExistingVehicle] = useState<Vehicle | null>(null);
  const [isSearchingPlate, setIsSearchingPlate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrderCode, setCreatedOrderCode] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<ReceptionFormData>({
    resolver: zodResolver(receptionSchema),
    defaultValues: {
      plate: '',
      brand: '',
      model: '',
      year: new Date().getFullYear(),
      fuelType: 'GASOLINA',
      color: '',
      mileage: 0,
      vin: '',
      clientName: '',
      clientDocument: '',
      clientPhone: '',
      clientEmail: '',
      entryReason: '',
      fuelLevel: '1/2',
      spareTire: true,
      jackAndTools: true,
      documentsInCar: true,
      valuableBelongings: '',
      scratchesOrDents: '',
    },
  });

  const selectedFuel = watch('fuelType');
  const enteredPlate = watch('plate');

  // Check RN-18 restriction in real-time
  const isElectricBlocked = selectedFuel === 'ELECTRICO';

  // Handle autocompletion of vehicle history (RN-19, RN-20)
  const handleSearchPlate = async (plateToSearch: string) => {
    if (!plateToSearch || plateToSearch.length < 3) return;
    setIsSearchingPlate(true);
    try {
      const res = await vehiclesService.getByPlate(plateToSearch);
      if (res.data) {
        const v = res.data;
        setExistingVehicle(v);
        setValue('plate', v.plate);
        setValue('brand', v.brand);
        setValue('model', v.model);
        setValue('year', v.year);
        setValue('fuelType', v.fuelType);
        setValue('color', v.color);
        setValue('vin', v.vin || '');
        setValue('clientName', v.clientName);
        setValue('clientDocument', v.clientDocument);
        setValue('clientPhone', v.clientPhone);
        setValue('clientEmail', v.clientEmail || '');
        setValue('mileage', v.mileage);
        if (v.inspectionChecklist) {
          setValue('fuelLevel', v.inspectionChecklist.fuelLevel);
          setValue('spareTire', v.inspectionChecklist.spareTire);
          setValue('jackAndTools', v.inspectionChecklist.jackAndTools);
          setValue('documentsInCar', v.inspectionChecklist.documentsInCar);
          setValue('valuableBelongings', v.inspectionChecklist.valuableBelongings || '');
        }
        toast.info(
          `Historial Encontrado: ${v.plate}`,
          `Cliente ${v.clientName} (${v.totalPreviousVisits} visitas previas registradas). Datos autocompletados.`
        );
      } else {
        setExistingVehicle(null);
        toast.info('Vehículo Nuevo', `La placa "${plateToSearch}" no tiene ingresos previos. Complete los datos.`);
      }
    } catch {
      toast.danger('Error al buscar historial por placa');
    } finally {
      setIsSearchingPlate(false);
    }
  };

  const onSubmit = async (data: ReceptionFormData) => {
    // Enforcement of RN-18
    if (data.fuelType === 'ELECTRICO') {
      toast.danger(
        'Bloqueo RN-18 Activo',
        'No se puede recepcionar vehículos 100% eléctricos en Taller Los Fratelli. Especializados solo en combustión e híbridos livianos.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // RN-01: the backend creates customer, vehicle and work order atomically.
      const orderRes = await workOrdersService.createVehicleEntry({
        plate: data.plate,
        customer: { identification: data.clientDocument, name: data.clientName, phone: data.clientPhone },
        vehicle: {
          brand: data.brand,
          model: data.model,
          year: data.year,
          isFullyElectric: false,
        },
        initialComplaint: data.entryReason,
      });
      await queryClient.invalidateQueries({ queryKey: ['work-orders'] });

      setCreatedOrderCode(orderRes.data.code);
      toast.success(
        `Orden ${orderRes.data.code} Registrada`,
        `Vehículo ${data.plate.toUpperCase()} ingresó al taller en estado RECIBIDO.`
      );

      if (onOrderCreated) {
        onOrderCreated(orderRes.data.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo registrar el ingreso';
      toast.danger('Error en Recepción', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    reset();
    setExistingVehicle(null);
    setCreatedOrderCode(null);
    setSearchPlateInput('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F9731615] border border-[#F9731630] flex items-center justify-center text-[#F97316]">
              <ClipboardList className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Recepción de Vehículos (HU-01)
            </h1>
          </div>
          <p className="text-xs text-[#8E949F] mt-1.5">
            Formulario de ingreso, búsqueda rápida por placa, autocompletado de historial y verificación de combustible.
          </p>
        </div>
      </div>

      {/* Quick Search Plate Bar (RN-19, RN-20) */}
      <Card variant="flat" padding="md">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E949F]" />
            <input
              type="text"
              value={searchPlateInput}
              onChange={(e) => setSearchPlateInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearchPlate(searchPlateInput);
                }
              }}
              placeholder="Buscar placa existente (Ej: 4589-KXA, 3042-XYZ, 2190-LPN)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#2D3139] bg-[#0F1115] text-white uppercase font-mono font-bold text-sm focus:outline-none focus:border-[#F97316] min-h-[44px]"
            />
          </div>
          <Button
            type="button"
            onClick={() => handleSearchPlate(searchPlateInput)}
            isLoading={isSearchingPlate}
            leftIcon={<Search className="w-4 h-4" />}
            variant="secondary"
          >
            Autocompletar Historial (RN-19)
          </Button>
        </div>

        {existingVehicle && (
          <div className="mt-4 p-3.5 rounded-xl bg-[#F9731610] border border-[#F9731630] flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#F97316] shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-white">
                Historial cargado para {existingVehicle.brand} {existingVehicle.model} ({existingVehicle.plate}):
              </span>{' '}
              <span className="text-[#8E949F]">Cliente frecuente:</span> <span className="font-semibold text-white">{existingVehicle.clientName}</span> |{' '}
              <span className="font-mono text-[#F97316]">{existingVehicle.totalPreviousVisits} visitas</span> | Último servicio:{' '}
              <span className="font-mono text-[#E0E2E6]">{existingVehicle.lastServiceDate || 'N/A'}</span>.
            </div>
          </div>
        )}
      </Card>

      {/* RN-18 Electric Vehicle Prohibition Warning Banner */}
      {isElectricBlocked && (
        <div className="p-4 rounded-2xl bg-[#EF444410] border border-[#EF444430] text-[#E0E2E6] flex items-start gap-3.5 shadow-xs">
          <div className="w-1.5 h-12 bg-[#EF4444] rounded-full shrink-0 mt-0.5"></div>
          <div>
            <h4 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
              <span className="text-[#EF4444]">BLOQUEO RN-18:</span> VEHÍCULO 100% ELÉCTRICO DETECTADO
            </h4>
            <p className="text-xs text-[#8E949F] mt-1 leading-relaxed">
              El Taller Mecánico Los Fratelli opera bajo normas de seguridad exclusivas para vehículos livianos a combustión e
              híbridos. Por política interna y falta de certificación en alto voltaje,{' '}
              <strong className="text-white">está prohibido registrar vehículos 100% eléctricos</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Success Notification after creation */}
      {createdOrderCode && (
        <Card variant="accent" padding="lg">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#22C55E15] border border-[#22C55E30] text-[#22C55E] flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  ¡Orden {createdOrderCode} Generada con Éxito!
                </h3>
                <p className="text-xs text-[#8E949F]">
                  El vehículo fue registrado en la cola de diagnóstico inicial para el Jefe de Taller.
                </p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <Button variant="outline" size="sm" onClick={resetForm}>
                Registrar Nuevo Vehículo
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Main Reception Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Section 1: Vehicle Technical Details */}
          <Card padding="md">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#2D3139]">
              <Car className="w-4 h-4 text-[#F97316]" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E949F]">
                1. Ficha Técnica del Vehículo
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Placa de Control"
                  {...register('plate')}
                  error={errors.plate?.message}
                  placeholder="Ej: 4589-KXA"
                  className="uppercase font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E949F] mb-1.5">
                  Tipo de Combustible / Motor <span className="text-[#EF4444]">*</span>
                </label>
                <select
                  {...register('fuelType')}
                  className="block w-full rounded-xl border border-[#2D3139] bg-[#0F1115] px-3.5 py-2.5 text-sm text-[#E0E2E6] min-h-[44px] focus:border-[#F97316] focus:outline-none"
                >
                  <option value="GASOLINA">Gasolina (Convencional)</option>
                  <option value="DIESEL">Diésel (Turbodiésel / Common Rail)</option>
                  <option value="HIBRIDO">Híbrido Liviano (HEV / MHEV)</option>
                  <option value="ELECTRICO">100% Eléctrico (EV - Bloqueado RN-18)</option>
                </select>
              </div>

              <div>
                <Input
                  label="Marca"
                  {...register('brand')}
                  error={errors.brand?.message}
                  placeholder="Ej: Toyota, Suzuki, Nissan"
                  required
                />
              </div>

              <div>
                <Input
                  label="Modelo"
                  {...register('model')}
                  error={errors.model?.message}
                  placeholder="Ej: Hilux 2.8 TD, Grand Vitara"
                  required
                />
              </div>

              <div>
                <Input
                  label="Año de Fabricación"
                  type="number"
                  {...register('year')}
                  error={errors.year?.message}
                  required
                />
              </div>

              <div>
                <Input
                  label="Color"
                  {...register('color')}
                  error={errors.color?.message}
                  placeholder="Ej: Blanco Perla, Gris"
                  required
                />
              </div>

              <div>
                <Input
                  label="Kilometraje Actual (km)"
                  type="number"
                  {...register('mileage')}
                  error={errors.mileage?.message}
                  placeholder="Ej: 64200"
                  required
                />
              </div>

              <div>
                <Input
                  label="Número de Chasis (VIN) - Opcional"
                  {...register('vin')}
                  error={errors.vin?.message}
                  placeholder="17 dígitos VIN"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </Card>

          {/* Section 2: Client Information */}
          <Card padding="md">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#2D3139]">
              <User className="w-4 h-4 text-[#F97316]" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E949F]">
                2. Propietario / Cliente
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <Input
                  label="Nombre Completo o Razón Social"
                  {...register('clientName')}
                  error={errors.clientName?.message}
                  placeholder="Ej: Alejandro Valenzuela Morales"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Cédula de Identidad / NIT"
                    {...register('clientDocument')}
                    error={errors.clientDocument?.message}
                    placeholder="Ej: 4892019 LP"
                    helperText="Para consulta de estado RN-17 y facturación"
                    required
                  />
                </div>

                <div>
                  <Input
                    label="Teléfono / Celular (WhatsApp)"
                    {...register('clientPhone')}
                    error={errors.clientPhone?.message}
                    placeholder="Ej: +591 70192834"
                    helperText="Para envío de presupuestos y alertas"
                    required
                  />
                </div>
              </div>

              <div>
                <Input
                  label="Correo Electrónico (Opcional)"
                  type="email"
                  {...register('clientEmail')}
                  error={errors.clientEmail?.message}
                  placeholder="cliente@ejemplo.com"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Section 3: Diagnosis & Inventory Inspection Checklist */}
        <Card padding="md">
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#2D3139]">
            <ClipboardList className="w-4 h-4 text-[#F97316]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E949F]">
              3. Motivo de Ingreso & Checklist de Recepción
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E949F] mb-1.5">
                Síntomas Reportados por el Cliente / Motivo de Ingreso <span className="text-[#EF4444]">*</span>
              </label>
              <textarea
                {...register('entryReason')}
                rows={3}
                placeholder="Describa ruidos, fallas, fugas, mantenimientos solicitados o incidentes reportados por el cliente..."
                className="w-full rounded-xl border border-[#2D3139] bg-[#0F1115] px-3.5 py-2.5 text-sm text-[#E0E2E6] focus:border-[#F97316] focus:outline-none"
              />
              {errors.entryReason && (
                <p className="mt-1 text-xs text-[#EF4444]">{errors.entryReason.message}</p>
              )}
            </div>

            {/* Tactile Checklist for Tablet */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-[#8E949F] mb-1.5">
                  Nivel de Combustible
                </label>
                <select
                  {...register('fuelLevel')}
                  className="w-full rounded-xl border border-[#2D3139] bg-[#0F1115] text-[#E0E2E6] px-3 py-2.5 text-xs min-h-[44px] focus:outline-none focus:border-[#F97316]"
                >
                  <option value="VACIO">Reserva / Vacío</option>
                  <option value="1/4">1/4 de Tanque</option>
                  <option value="1/2">1/2 Tanque</option>
                  <option value="3/4">3/4 de Tanque</option>
                  <option value="LLENO">Tanque Lleno</option>
                </select>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl border border-[#2D3139] bg-[#1C2028]">
                <input
                  type="checkbox"
                  id="spareTire"
                  {...register('spareTire')}
                  className="w-4 h-4 accent-[#F97316] rounded"
                />
                <label htmlFor="spareTire" className="text-xs font-semibold text-[#E0E2E6] cursor-pointer select-none">
                  Rueda de Auxilio Presente
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl border border-[#2D3139] bg-[#1C2028]">
                <input
                  type="checkbox"
                  id="jackAndTools"
                  {...register('jackAndTools')}
                  className="w-4 h-4 accent-[#F97316] rounded"
                />
                <label htmlFor="jackAndTools" className="text-xs font-semibold text-[#E0E2E6] cursor-pointer select-none">
                  Gata y Herramientas
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl border border-[#2D3139] bg-[#1C2028]">
                <input
                  type="checkbox"
                  id="documentsInCar"
                  {...register('documentsInCar')}
                  className="w-4 h-4 accent-[#F97316] rounded"
                />
                <label htmlFor="documentsInCar" className="text-xs font-semibold text-[#E0E2E6] cursor-pointer select-none">
                  Documentos en Guantera
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <Input
                  label="Objetos de Valor en el Vehículo"
                  {...register('valuableBelongings')}
                  placeholder="Ej: Gafas de sol, control portón, cables USB..."
                  helperText="Inventariado para custodia durante el servicio"
                />
              </div>

              <div>
                <Input
                  label="Rayones / Abolladuras Previas"
                  {...register('scratchesOrDents')}
                  placeholder="Ej: Rayón en parachoques trasero..."
                  helperText="Constancia de estado exterior al ingresar"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={resetForm} className="w-full sm:w-auto">
            Limpiar Formulario
          </Button>
          <Button
            type="submit"
            variant={isElectricBlocked ? 'danger' : 'primary'}
            size="lg"
            isLoading={isSubmitting}
            disabled={isElectricBlocked}
            leftIcon={isElectricBlocked ? <Ban className="w-5 h-5" /> : <Check className="w-5 h-5" />}
            className="w-full sm:w-auto"
          >
            {isElectricBlocked
              ? 'Bloqueado por RN-18 (No Eléctricos)'
              : 'Registrar Ingreso y Generar Orden (HU-01)'}
          </Button>
        </div>
      </form>
    </div>
  );
};

import {
  AlertTriangle,
  BatteryWarning,
  CarFront,
  ChevronRight,
  CircleUserRound,
  ClipboardPlus,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { FormField, TextAreaField } from '../../components/ui/form-field'
import { ApiError } from '../../shared/api/http-client'
import { useCreateWorkOrder, useVehicleHistory } from './api/reception-api'
import type {
  CreatedWorkOrderResponse,
  LookupState,
  VehicleEntryFormValues,
} from './reception.types'
import { normalizePlate, PLATE_PATTERN, toRegisterRequest } from './reception.validation'
import { VehicleHistoryPanel } from './components/vehicle-history-panel'
import { WorkOrderSuccess } from './components/work-order-success'

const defaultValues: VehicleEntryFormValues = {
  plate: '',
  customerIdentification: '',
  customerName: '',
  customerPhone: '',
  brand: '',
  model: '',
  year: '',
  isFullyElectric: false,
  initialComplaint: '',
}

export function VehicleReceptionPage() {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<VehicleEntryFormValues>({ defaultValues, mode: 'onBlur' })
  const plate = useWatch({ control, name: 'plate' })
  const isFullyElectric = useWatch({ control, name: 'isFullyElectric' })
  const [searchedPlate, setSearchedPlate] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [createdOrder, setCreatedOrder] = useState<CreatedWorkOrderResponse | null>(null)
  const autoCompletedValues = useRef<Partial<VehicleEntryFormValues>>({})
  const historyQuery = useVehicleHistory(searchedPlate)
  const createWorkOrder = useCreateWorkOrder()
  const normalizedPlate = normalizePlate(plate)
  const lookup: LookupState = !PLATE_PATTERN.test(normalizedPlate)
    ? { status: 'idle' }
    : searchedPlate !== normalizedPlate || historyQuery.isPending || historyQuery.isFetching
      ? { status: 'loading' }
      : historyQuery.isError
        ? { status: 'error', message: errorMessage(historyQuery.error) }
        : historyQuery.data
          ? { status: 'found', data: historyQuery.data }
          : { status: 'new' }
  const isPersistedElectric = lookup.status === 'found' && lookup.data.is_fully_electric
  const isElectricBlocked = isFullyElectric || isPersistedElectric

  useEffect(() => {
    setSubmitError('')

    for (const [field, value] of Object.entries(autoCompletedValues.current)) {
      const fieldName = field as keyof VehicleEntryFormValues
      if (getValues(fieldName) === value) {
        setValue(fieldName, defaultValues[fieldName])
      }
    }
    autoCompletedValues.current = {}

    if (!PLATE_PATTERN.test(normalizedPlate)) {
      setSearchedPlate('')
      return
    }

    const timeout = window.setTimeout(() => setSearchedPlate(normalizedPlate), 350)

    return () => window.clearTimeout(timeout)
  }, [getValues, normalizedPlate, setValue])

  useEffect(() => {
    const data = historyQuery.data
    if (!data || data.plate !== searchedPlate) return

    const values: Partial<VehicleEntryFormValues> = {
      customerIdentification: data.customer_identification,
      customerName: data.customer_name,
      customerPhone: data.customer_phone ?? '',
      brand: data.brand,
      model: data.model,
      year: String(data.year),
      isFullyElectric: data.is_fully_electric,
    }

    for (const [field, value] of Object.entries(values)) {
      setValue(field as keyof VehicleEntryFormValues, value, { shouldValidate: true })
    }
    autoCompletedValues.current = values
  }, [historyQuery.data, searchedPlate, setValue])

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError('')
    if (values.isFullyElectric || isPersistedElectric) {
      setSubmitError('Los vehículos 100% eléctricos no pueden ser recibidos por el taller.')
      return
    }

    try {
      const order = await createWorkOrder.mutateAsync(toRegisterRequest(values))
      setCreatedOrder(order)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      if (error instanceof ApiError && Array.isArray(error.body?.message)) {
        setSubmitError(error.body.message.join(' '))
      } else {
        setSubmitError(errorMessage(error))
      }
    }
  })

  function startNewEntry() {
    reset(defaultValues)
    setSearchedPlate('')
    setCreatedOrder(null)
    setSubmitError('')
    createWorkOrder.reset()
    autoCompletedValues.current = {}
  }

  if (createdOrder) {
    return (
      <div className="page-container compact-page">
        <WorkOrderSuccess order={createdOrder} onNew={startNewEntry} />
      </div>
    )
  }

  return (
    <div className="page-container">
      <section className="page-heading">
        <div>
          <span className="eyebrow">HU-01 · Recepción de taller</span>
          <h1>Registrar ingreso</h1>
          <p>Consulta el expediente y crea una Orden de Trabajo para iniciar la atención.</p>
        </div>
        <div className="step-indicator" aria-label="Paso actual">
          <span>01</span><div><strong>Ingreso</strong><small>Datos y reclamo</small></div>
        </div>
      </section>

      <form onSubmit={onSubmit} noValidate>
        <div className="reception-layout">
          <div className="form-column">
            <section className="card plate-card">
              <div className="section-title">
                <span className="section-icon"><Search size={19} /></span>
                <div><h2>Consulta por placa</h2><p>La búsqueda inicia al completar una placa válida.</p></div>
              </div>
              <FormField
                id="plate"
                label="Placa del vehículo *"
                className="plate-input"
                placeholder="ABC123"
                maxLength={10}
                autoComplete="off"
                error={errors.plate?.message}
                hint="3 a 10 caracteres: letras, números o guion."
                {...register('plate', {
                  required: 'La placa es obligatoria.',
                  validate: (value) => PLATE_PATTERN.test(normalizePlate(value)) || 'Ingresa una placa válida.',
                  onBlur: (event) => setValue('plate', normalizePlate(event.target.value), { shouldValidate: true }),
                })}
              />
            </section>

            <section className="card">
              <div className="section-title">
                <span className="section-icon"><CarFront size={19} /></span>
                <div><h2>Datos del vehículo</h2><p>Información necesaria para abrir la orden.</p></div>
              </div>
              <div className="field-grid">
                <FormField id="brand" label="Marca *" placeholder="Toyota" error={errors.brand?.message}
                  {...register('brand', { validate: (value) => Boolean(value.trim()) || 'La marca es obligatoria.' })} />
                <FormField id="model" label="Modelo *" placeholder="Corolla" error={errors.model?.message}
                  {...register('model', { validate: (value) => Boolean(value.trim()) || 'El modelo es obligatorio.' })} />
                <FormField id="year" label="Año *" inputMode="numeric" placeholder="2022" maxLength={4} error={errors.year?.message}
                  {...register('year', {
                    validate: (value) => {
                      const year = Number(value)
                      if (!value.trim()) return 'El año es obligatorio.'
                      if (!Number.isInteger(year) || year < 1900 || year > 2100) return 'El año debe estar entre 1900 y 2100.'
                      return true
                    },
                  })} />
              </div>
              <label className={`electric-check ${isElectricBlocked ? 'is-active' : ''}`}>
                <input type="checkbox" disabled={isPersistedElectric} {...register('isFullyElectric')} />
                <span className="check-box"><BatteryWarning size={18} /></span>
                <span><strong>Vehículo 100% eléctrico</strong><small>Estos vehículos no son admitidos por el taller.</small></span>
              </label>
              {isElectricBlocked && (
                <div className="electric-alert" role="alert">
                  <BatteryWarning size={22} />
                  <div><strong>Recepción bloqueada</strong><p>No se puede crear una Orden de Trabajo para un vehículo 100% eléctrico.</p></div>
                </div>
              )}
            </section>

            <section className="card">
              <div className="section-title">
                <span className="section-icon"><CircleUserRound size={19} /></span>
                <div><h2>Datos del cliente</h2><p>Responsable asociado a la Orden de Trabajo.</p></div>
              </div>
              {lookup.status === 'found' && (
                <div className="autocomplete-note"><ShieldCheck size={17} /> Nombre autocompletado desde el expediente.</div>
              )}
              <div className="field-grid">
                <FormField id="customerIdentification" label="Identificación *" placeholder="CI o NIT" error={errors.customerIdentification?.message}
                  {...register('customerIdentification', { validate: (value) => Boolean(value.trim()) || 'La identificación es obligatoria.' })} />
                <FormField id="customerName" label="Nombre completo *" placeholder="Nombre del cliente" error={errors.customerName?.message}
                  {...register('customerName', { validate: (value) => Boolean(value.trim()) || 'El nombre es obligatorio.' })} />
                <FormField id="customerPhone" label="Teléfono" type="tel" placeholder="+591 70000000" error={errors.customerPhone?.message}
                  {...register('customerPhone')} />
              </div>
            </section>

            <section className="card">
              <div className="section-title">
                <span className="section-icon"><ClipboardPlus size={19} /></span>
                <div><h2>Reclamo inicial</h2><p>Describe el motivo principal del ingreso.</p></div>
              </div>
              <TextAreaField
                id="initialComplaint"
                label="Síntomas o solicitud del cliente *"
                rows={5}
                placeholder="Ej.: Se escucha un ruido al frenar en velocidades bajas..."
                error={errors.initialComplaint?.message}
                {...register('initialComplaint', { validate: (value) => Boolean(value.trim()) || 'El reclamo inicial es obligatorio.' })}
              />
            </section>
          </div>

          <aside className="side-column">
            <section className="card history-card">
              <VehicleHistoryPanel lookup={lookup} />
            </section>
            <section className="process-note">
              <ShieldCheck size={19} />
              <div><strong>Registro transaccional</strong><p>Cliente, vehículo y Orden de Trabajo se envían en una sola operación al backend.</p></div>
            </section>
          </aside>
        </div>

        {submitError && <div className="global-alert is-error submit-alert" role="alert"><AlertTriangle size={20} /><p>{submitError}</p></div>}

        <div className="submit-bar">
          <div><strong>Crear Orden de Trabajo</strong><span>Estado inicial asignado por el backend: OPEN</span></div>
          <button className="button button-primary" type="submit" disabled={isSubmitting || isElectricBlocked || lookup.status === 'loading'}>
            {isSubmitting ? <><span className="button-spinner" /> Registrando...</> : <>Registrar ingreso <ChevronRight size={19} /></>}
          </button>
        </div>
      </form>
    </div>
  )
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
}

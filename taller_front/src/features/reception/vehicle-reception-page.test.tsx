import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '../../app/providers/AppProviders'
import type { VehicleHistoryResponse } from './reception.types'
import { VehicleReceptionPage } from './vehicle-reception-page'

describe('VehicleReceptionPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  })

  it('validates every required work-order field', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /Registrar ingreso/ }))

    expect(await screen.findByText('La placa es obligatoria.')).toBeInTheDocument()
    expect(screen.getByText('La marca es obligatoria.')).toBeInTheDocument()
    expect(screen.getByText('El modelo es obligatorio.')).toBeInTheDocument()
    expect(screen.getByText('El año es obligatorio.')).toBeInTheDocument()
    expect(screen.getByText('La identificación es obligatoria.')).toBeInTheDocument()
    expect(screen.getByText('El nombre es obligatorio.')).toBeInTheDocument()
    expect(screen.getByText('El reclamo inicial es obligatorio.')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('searches, autocompletes vehicle and customer data, and shows history', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(existingVehicle()))
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Placa del vehículo *'), 'abc123')

    expect(await screen.findByText('Cambio de pastillas')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre completo *')).toHaveValue('María Flores')
    expect(screen.getByLabelText('Identificación *')).toHaveValue('7845123')
    expect(screen.getByLabelText('Marca *')).toHaveValue('Toyota')
    expect(screen.getByLabelText('Modelo *')).toHaveValue('Corolla')
    expect(screen.getByLabelText('Año *')).toHaveValue('2022')
    expect(screen.getByText('Recepción permitida')).toBeInTheDocument()
  })

  it('blocks an existing fully electric vehicle', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      ...existingVehicle(),
      id: 'vehicle-electric',
      plate: 'ELE123',
      is_fully_electric: true,
    }))
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Placa del vehículo *'), 'ELE123')

    expect(await screen.findByText('Recepción bloqueada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Registrar ingreso/ })).toBeDisabled()
  })

  it('detects a new vehicle and sends one registration request', async () => {
    vi.mocked(fetch).mockImplementation(async (_url, options) => {
      if (!options?.method) return jsonResponse({}, 404)
      return jsonResponse({
        id: 'work-order-1',
        vehicle_id: 'vehicle-1',
        customer_id: 'customer-1',
        status: 'OPEN',
        initial_complaint: 'Ruido al frenar',
        created_at: '2026-08-19T12:00:00.000Z',
      }, 201)
    })
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Placa del vehículo *'), 'NEW123')
    expect(await screen.findByText('Vehículo nuevo')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Identificación *'), '123456')
    await user.type(screen.getByLabelText('Nombre completo *'), 'Ana Pérez')
    await user.type(screen.getByLabelText('Marca *'), 'Toyota')
    await user.type(screen.getByLabelText('Modelo *'), 'Corolla')
    await user.type(screen.getByLabelText('Año *'), '2022')
    await user.type(screen.getByLabelText('Síntomas o solicitud del cliente *'), 'Ruido al frenar')
    await user.click(screen.getByRole('button', { name: /Registrar ingreso/ }))

    expect(await screen.findByText('Orden de Trabajo creada')).toBeInTheDocument()
    expect(screen.getByText('OPEN')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/work-orders', expect.objectContaining({
      method: 'POST',
    }))
  })
})

function renderPage() {
  return render(
    <AppProviders>
      <VehicleReceptionPage />
    </AppProviders>,
  )
}

function existingVehicle(): VehicleHistoryResponse {
  return {
    id: 'vehicle-1',
    plate: 'ABC123',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2022,
    is_fully_electric: false,
    customer_id: 'customer-1',
    customer_identification: '7845123',
    customer_name: 'María Flores',
    customer_phone: '+591 71234567',
    history: [{
      id: 'history-1',
      description: 'Cambio de pastillas',
      createdAt: '2026-08-18T10:00:00.000Z',
    }],
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkOrder, getVehicleHistory } from './api/reception-api'
import type { RegisterVehicleEntryRequest } from './reception.types'

const request: RegisterVehicleEntryRequest = {
  plate: 'ABC123',
  customer: { identification: '123', name: 'Ana' },
  vehicle: { brand: 'Toyota', model: 'Corolla', year: 2022, isFullyElectric: false },
  initialComplaint: 'Ruido al frenar',
}

describe('reception API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('searches a normalized plate using the vehicle history endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 404))

    await expect(getVehicleHistory(' ab-123 ')).resolves.toBeNull()

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/vehicles/AB-123/history', {
      headers: { Accept: 'application/json' },
      signal: undefined,
    })
  })

  it('sends the complete registration DTO in one backend operation', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      id: 'work-order-1',
      vehicle_id: 'vehicle-1',
      customer_id: 'customer-1',
      status: 'OPEN',
      initial_complaint: request.initialComplaint,
      created_at: '2026-08-19T12:00:00.000Z',
    }, 201))

    const order = await createWorkOrder(request)

    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/work-orders', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(request),
    }))
    expect(order).toMatchObject({
      vehicle_id: 'vehicle-1',
      customer_id: 'customer-1',
      status: 'OPEN',
      initial_complaint: 'Ruido al frenar',
    })
  })

  it('blocks fully electric vehicles before calling the backend', async () => {
    await expect(createWorkOrder({
      ...request,
      vehicle: { ...request.vehicle, isFullyElectric: true },
    })).rejects.toMatchObject({ statusCode: 422 })

    expect(fetch).not.toHaveBeenCalled()
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

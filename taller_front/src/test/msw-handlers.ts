import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';

import type { components } from '../shared/api/schema.gen';

export type VehicleStatusResponse = components['schemas']['VehicleStatusResponseDto'];

const notFoundBody = {
  statusCode: 404,
  message: 'No valid work order found for the provided data',
  path: '/api/v1/public/vehicle-status',
  timestamp: '2026-08-19T00:00:00.000Z',
};

export function statusResponse(overrides: Partial<VehicleStatusResponse> = {}): VehicleStatusResponse {
  return {
    workOrderId: 'work-order-1',
    plate: 'ABC123',
    vehicle: { brand: 'Toyota', model: 'Corolla', year: 2019 },
    customerName: 'Ana García',
    initialComplaint: 'Ruido en la suspensión delantera',
    createdAt: '2026-08-10T12:00:00.000Z',
    status: 'EN_REPARACION',
    stage: 'En reparación',
    readyForPickup: false,
    ...overrides,
  };
}

export const handlers = [
  http.get('/api/v1/public/vehicle-status', async ({ request }) => {
    const url = new URL(request.url);
    const plate = url.searchParams.get('plate');

    if (plate === 'SLOW') {
      await delay(600);
      return HttpResponse.json(statusResponse());
    }

    if (plate === 'ZZ9999') {
      return HttpResponse.json(notFoundBody, { status: 404 });
    }

    if (plate === 'ERROR500') {
      return HttpResponse.json(
        { statusCode: 500, message: 'Internal server error', path: '/api/v1/public/vehicle-status' },
        { status: 500 },
      );
    }

    if (plate === 'FINISHED') {
      return HttpResponse.json(
        statusResponse({ status: 'FINALIZADO', stage: 'Finalizado', readyForPickup: true }),
      );
    }

    if (plate === 'EX0001') {
      return HttpResponse.json(
        statusResponse({ plate: 'EX0001', status: 'ASIGNADA', stage: 'ASIGNADA' }),
      );
    }

    return HttpResponse.json(statusResponse());
  }),
];

export const server = setupServer(...handlers);
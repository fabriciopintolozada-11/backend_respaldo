import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { TrackingPublicPage } from './pages/TrackingPublicPage';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <TrackingPublicPage />
    </QueryClientProvider>,
  );
}

async function submitLookup(plate: string, identification = 'SEED-001') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/placa del vehículo/i), plate);
  await user.type(screen.getByLabelText(/documento de identidad/i), identification);
  await user.click(screen.getByRole('button', { name: /consultar estado/i }));
}

describe('HU-02 Consultar estado del vehículo (RN-17)', () => {
  it('shows a public lookup form that only requests plate and identification', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /consulta el estado de tu vehículo/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/placa del vehículo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/documento de identidad/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /consultar estado/i })).toBeInTheDocument();
  });

  it('validates required fields and plate format before querying', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /consultar estado/i }));
    expect(await screen.findAllByRole('alert')).toHaveLength(2);

    await user.type(screen.getByLabelText(/placa del vehículo/i), 'AB');
    await user.type(screen.getByLabelText(/documento de identidad/i), 'SEED-001');
    await user.click(screen.getByRole('button', { name: /consultar estado/i }));
    expect(await screen.findByText(/debe tener entre 3 y 10 caracteres/i)).toBeInTheDocument();
  });

  it('allows customer tracking lookup using only license plate and id number (RN-17)', async () => {
    renderPage();
    await submitLookup('EX0001');
    expect(await screen.findByText('EX0001')).toBeInTheDocument();
    expect(screen.getByText(/Toyota Corolla/)).toBeInTheDocument();
    expect(screen.getByText(/etapa actual de atención/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/etapas de la orden de trabajo/i)).toBeInTheDocument();
  });

  it('shows a loading state while the public lookup is in flight', async () => {
    renderPage();
    await submitLookup('SLOW');
    expect(await screen.findByText(/cargando/i)).toBeInTheDocument();
    expect(await screen.findAllByText(/en reparación/i)).not.toHaveLength(0);
  });

  it('shows a prominent ready-for-pickup message when the order is finished', async () => {
    renderPage();
    await submitLookup('FINISHED');
    expect(await screen.findByText(/listo para ser retirado/i)).toBeInTheDocument();
    expect(screen.getAllByText(/finalizado/i).length).toBeGreaterThan(0);
  });

  it('shows a generic message when no work order is found for the provided data', async () => {
    renderPage();
    await submitLookup('ZZ9999');
    expect(await screen.findByText(/no encontramos una orden de trabajo vigente/i)).toBeInTheDocument();
  });

  it('offers a retry action when the backend returns a server error', async () => {
    renderPage();
    await submitLookup('ERROR500');
    expect(
      await screen.findByText(/no se pudo completar la consulta/i, {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});
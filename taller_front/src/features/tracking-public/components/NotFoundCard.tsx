export function NotFoundCard() {
  return (
    <div className="notice-card" role="status">
      <h2>No encontramos una orden de trabajo vigente</h2>
      <p>
        Verifica que la placa y el documento de identidad sean los del titular del vehículo e
        inténtalo nuevamente. Si el problema persiste, comunícate con el taller.
      </p>
    </div>
  );
}
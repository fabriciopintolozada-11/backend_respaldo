# Épica E4 — Seguimiento y Comunicación

Permite a la Recepcionista y al personal de atención consultar de manera inmediata el avance y estado de cualquier vehículo en el taller, evitando interrupciones a los mecánicos en las bahías y agilizando las respuestas a llamadas o consultas presenciales de los clientes.

## Origen

Reglas de negocio de atención al cliente y seguimiento operativo (RN-05, RN-20) sobre búsqueda rápida por placa, visualización de motivos de detención en bahía y reducción de tiempos de respuesta en recepción.

## Prioridad de la épica

**Should** — optimiza radicalmente la atención al cliente y evita cuellos de botella e interrupciones en la zona de trabajo técnico.

## Historias de usuario

| ID | Título | Prioridad | Puntos |
| --- | --- | --- | --- |
| US-05 | Informar estado al cliente | Should | 3 |

## US-05: Informar estado al cliente

**Como** Recepcionista, **quiero** consultar de manera rápida y centralizada el estado actualizado, bahía asignada, tareas completadas y tiempos de permanencia del vehículo, **para** brindar información certera y en tiempo real al cliente cuando llama o consulta presencialmente sobre su reparación.

| Prioridad | Puntos | Rol | Depende de |
| --- | --- | --- | --- |
| Should | 3 | Recepcionista, Jefe de Taller, Administrador | E2 (Presupuestos), E3 (Inventario) |

### Criterios de aceptación

```gherkin
Escenario: Consulta rápida del estado mediante la placa del vehículo
  Dado que la Recepcionista se encuentra en el módulo de recepción o tablero principal
  Cuando ingresa o digita la placa del vehículo (RN-20)
  Entonces el sistema despliega de inmediato el estado actual de la OT ("recibido", "en_diagnostico", "presupuesto_enviado", "aprobado", "en_reparacion", "en_espera_de_repuesto", "listo", "entregado")
  Y muestra la bahía ocupada (1 a 4), el mecánico asignado y los días que lleva el vehículo en el taller

Escenario: Visualización del motivo de detención cuando el vehículo está en espera
  Dado que la OT consultada está en estado "en_espera_de_repuesto" o "presupuesto_enviado"
  Cuando la Recepcionista visualiza la ficha de estado
  Entonces el sistema muestra explícitamente la causa de la espera (nombre del repuesto faltante o días transcurridos esperando aprobación del cliente)

Escenario: Búsqueda con debounce sin recargar la página (RN-20)
  Dado que la Recepcionista escribe en el campo de búsqueda de placa
  Cuando se detiene de escribir durante al menos 300ms
  Entonces el sistema ejecuta la consulta y despliega la información sin requerir que presione la tecla Enter ni recargar la pantalla
```

### Reglas de negocio y consideraciones técnicas asociadas

- **RN-20:** búsqueda ágil y reactiva por placa para respuesta en tiempo real al cliente sin recargas completas.
- **RN-05:** visibilidad clara de órdenes pausadas con detalle de causales (espera de repuestos o autorizaciones).
- **Backend:** endpoint `GET /api/v1/work-orders/tracking-summary` con filtros por `licensePlate`, `status` y `workBayId` (`JwtAuthGuard`), DTO `WorkOrderTrackingResponseDto` e índices en BD (`vehicles.license_plate`, `work_orders.status`) con latencia menor a 100 ms.
- **Frontend:** componente `VehicleStatusQuickSearch.tsx` con debounce (300 ms a 400 ms), tarjeta visual `WorkOrderTrackingCard.tsx` con código de colores por estado, hook `useWorkOrderTracking` con React Query y manejo de estados con Skeletons/Empty State.

### Desglose de tareas técnicas

**Backend (`modules/work-orders`, `modules/vehicles`):**

- **BE-T05.1:** endpoint `GET /api/v1/work-orders/tracking-summary` con filtros por `licensePlate`, `status` y `workBayId`, protegido con `JwtAuthGuard` (BE-22).
- **BE-T05.2:** `WorkOrderTrackingResponseDto` con OT, estado, ingreso, permanencia, bahía, mecánico y motivo de pausa (BE-12).
- **BE-T05.3:** índices en `vehicles.license_plate` y `work_orders.status` para latencia menor a 100 ms (BE-21).

**Frontend (`features/work-orders`, `features/vehicles`):**

- **FE-T05.1:** componente `VehicleStatusQuickSearch.tsx` con debounce de 300 ms a 400 ms (FE-15).
- **FE-T05.2:** tarjeta `WorkOrderTrackingCard.tsx` con colores por estado.
- **FE-T05.3:** hook `useWorkOrderTracking` con `@tanstack/react-query` y `staleTime` corto (FE-08).
- **FE-T05.4:** Skeletons y estado vacío explicativo cuando no existe una OT activa (FE-13).

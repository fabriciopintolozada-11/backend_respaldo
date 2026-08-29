# Épica E3 — Gestión de Inventario y Almacén

Gestiona el flujo de control de repuestos en almacén, garantizando la consistencia del stock físico frente a las reservas, el descuento transaccional al momento de la instalación y la gestión de detenciones por quiebre de stock.

## Origen

Reglas de negocio de almacén e inventario (RN-01, RN-02, RN-04, RN-05, RN-07, RN-08, RN-09, RN-16, RN-19, RN-21) sobre prevención de saldos negativos, trazabilidad física/lógica, control de precios por rol y auditoría inmutable de movimientos.

## Prioridad de la épica

**Must** — sin control de inventario transaccional y sincronización de stock, se generan desfases de existencias, detenciones imprevistas y pérdida de trazabilidad en las reparaciones.

## Historias de usuario

| ID | Título | Prioridad | Puntos |
| --- | --- | --- | --- |
| US-07 | Confirmar uso e instalación de repuestos | Must | 5 |
| US-13 | Gestionar espera de repuesto | Must | 3 |

## US-07: Confirmar uso e instalación de repuestos

**Como** Mecánico, **quiero** confirmar la instalación y uso efectivo de un repuesto reservado en la Orden de Trabajo, **para** que el sistema descuente de manera inmediata y atómica las existencias físicas reales del almacén.

| Prioridad | Puntos | Rol | Depende de |
| --- | --- | --- | --- |
| Must | 5 | Mecánico, Jefe de Taller | US-09 (Presupuesto aprobado) |

### Criterios de aceptación

```gherkin
Escenario: Confirmación exitosa de instalación y descuento físico de stock (RN-08)
  Dado que la OT está en estado "en_reparacion" y asignada al mecánico autenticado (RN-04)
  Y los repuestos figuran en estado "Reservado" tras la aprobación previa del presupuesto (RN-02, RN-07)
  Cuando el mecánico presiona "Confirmar Uso" para un repuesto específico
  Entonces el sistema cambia el estado del repuesto en la OT a "Instalado" / "Consumido"
  Y descuenta inmediatamente la cantidad de las existencias físicas reales del almacén (RN-08)
  Y registra el movimiento con fecha, ID del mecánico y OT en el kardex inmutable (RN-19)

Escenario: Intento de consumo sin presupuesto aprobado (RN-09)
  Dado que una OT se encuentra en estado "recibido" o "en_diagnostico" (sin presupuesto aprobado)
  Cuando se intenta registrar una salida física o informática de repuestos para dicha OT
  Entonces el sistema bloquea la acción arrojando un error 422 (Unprocessable Entity)
  Y no altera los saldos de inventario en base de datos

Escenario: Interfaz de mecánico sin exposición de precios (RN-16)
  Dado que el usuario autenticado tiene el rol "MECHANIC"
  Cuando visualiza la lista de repuestos reservados e instalados en su tablet
  Entonces puede ver código, nombre y cantidad de piezas
  Y el sistema oculta estrictamente el costo unitario, precio de venta y totales monetarios
```

### Reglas de negocio y consideraciones técnicas asociadas

- **RN-01 / RN-08:** bloqueo estricto de stock negativo; el descuento físico ocurre únicamente tras la confirmación de instalación en bahía.
- **RN-16 / RN-21:** ocultamiento total de costos e importes en BOB en las vistas asignadas a mecánicos.
- **Backend:** `ConsumeSparePartDto`, endpoint `POST /api/v1/work-orders/:id/consume-part` bajo `@Roles(Role.MECHANIC, Role.WORKSHOP_LEAD)`, ejecutado en una transacción atómica para mutar `spare_parts` e insertar en `stock_movements` (kardex).
- **Frontend:** panel táctil `ReservedPartsPanel.tsx` con botones de acción grandes (`>= 44px`) y hook reactivo `useConsumeSparePart` con React Query.

### Desglose de tareas técnicas

**Backend (`modules/inventory`, `modules/work-orders`):**

- **BE-T07.1:** endpoint `POST /api/v1/work-orders/:id/consume-part` protegido con `@Roles(Role.MECHANIC, Role.WORKSHOP_LEAD)`.
- **BE-T07.2:** DTO `ConsumeSparePartDto` (`workOrderPartId`, `quantity`, `notes`).
- **BE-T07.3:** transacción atómica para validar estado, reserva, stock no negativo e insertar el kardex (BE-16, BE-17, BE-19).
- **BE-T07.4:** `WorkOrderPartResponseDto` omitiendo precios para `MECHANIC` (RN-16, BE-12).

**Frontend (`features/work-orders`, `features/inventory`):**

- **FE-T07.1:** componente táctil `ReservedPartsPanel.tsx` con botones `[ Confirmar Uso ]` de al menos 44 px (FE-14).
- **FE-T07.2:** hook `useConsumeSparePart` con React Query e invalidación de caché (FE-08, FE-09).
- **FE-T07.3:** no renderizar precios ni importes en BOB para mecánicos (RN-16, RN-21).

## US-13: Gestionar espera de repuesto

**Como** Mecánico, **quiero** cambiar una Orden de Trabajo al estado "En Espera de Repuesto" cuando una pieza requerida no esté disponible físicamente en almacén, **para** pausar formalmente la orden, notificar a recepción y quedar liberado para atender otro trabajo asignado.

| Prioridad | Puntos | Rol | Depende de |
| --- | --- | --- | --- |
| Must | 3 | Mecánico, Jefe de Taller | US-07, E2 (OT en reparación) |

### Criterios de aceptación

```gherkin
Escenario: Cambio exitoso a "En Espera de Repuesto" por falta de stock físico (RN-05)
  Dado que el mecánico está trabajando en una OT en estado "en_reparacion"
  Cuando constata que el repuesto requerido no se encuentra en el estante físico
  Y selecciona la opción "En Espera de Repuesto" indicando la pieza faltante y un motivo
  Entonces la OT cambia su estado a "en_espera_de_repuesto"
  Y la bahía de trabajo refleja el estado de espera en el tablero principal
  Y el mecánico queda habilitado y libre para iniciar o continuar otra OT asignada (RN-05)

Escenario: Notificación visual no intrusiva a Recepción y Jefatura
  Dado que una OT pasa al estado "en_espera_de_repuesto"
  Cuando el recepcionista o el jefe de taller abren el panel de seguimiento
  Entonces visualizan una tarjeta/badge informativo indicando la pieza faltante y los días de espera
  Y no se bloquea la navegación con alertas modales intrusivas (FE-16)

Escenario: Registro de inconsistencia de inventario para ajuste posterior
  Dado que el sistema marcaba stock teórico pero el estante estaba vacío
  Cuando se confirma la transición a "en_espera_de_repuesto"
  Entonces el sistema genera un registro de inconsistencia de inventario pendiente de ajuste por el responsable
```

### Reglas de negocio y consideraciones técnicas asociadas

- **RN-05:** desacoplamiento de la asignación del mecánico para evitar tiempos muertos en bahía ante quiebres de stock.
- **RN-19:** trazabilidad inmutable de la causa de la detención en el historial de la OT.
- **Backend:** `SetAwaitingPartDto`, endpoint `POST /api/v1/work-orders/:id/awaiting-part`, transición en máquina de estados y log de auditoría.
- **Frontend:** modal táctil `AwaitingPartModal.tsx`, hook `useSetAwaitingPart`, invalidación del grid de bahías y badge visual ámbar/naranja `[ En Espera de Repuesto ]` (FE-16).

### Desglose de tareas técnicas

**Backend (`modules/work-orders`, `modules/inventory`):**

- **BE-T13.1:** DTO `SetAwaitingPartDto` (`missingPartId`, `reason`).
- **BE-T13.2:** endpoint `POST /api/v1/work-orders/:id/awaiting-part` validando permisos del mecánico asignado (RN-04).
- **BE-T13.3:** transición a `EN_ESPERA_DE_REPUESTO` dentro del servicio de estados.
- **BE-T13.4:** persistir el motivo en el historial de cambios de estado (RN-19, BE-17).

**Frontend (`features/work-orders`, `features/inventory`):**

- **FE-T13.1:** diálogo táctil `AwaitingPartModal.tsx` para pieza faltante y justificación.
- **FE-T13.2:** hook `useSetAwaitingPart` invalidando OT, tareas del mecánico y grid de las cuatro bahías (FE-09).
- **FE-T13.3:** badge ámbar/naranja `[ En Espera de Repuesto ]` para tablero y tarjetas de bahía.

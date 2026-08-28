# Registro de supuestos — Taller Mecánico Los Fratelli

> **Un supuesto es un riesgo con otro nombre.**
>
> Todo lo que el análisis y el backlog inicial dan por cierto sin estar explícitamente cerrado en la ficha técnica reside aquí. Cada supuesto se vincula con el banco de preguntas de [preguntas-cliente.md](preguntas-cliente.md) y se contrasta contra el [registro-respuestas-cliente.md](registro-respuestas-cliente.md) y las reglas confirmadas (`RN-01` a `RN-22`).

**Estado de cada supuesto:** `Confirmado` / `Refutado` / `Sin confirmar`

| Riesgo | Significado |
|---|---|
| 🔴 Alto | Si se refuta, cambia el modelo de datos relacional, la máquina de estados o el alcance arquitectónico. |
| 🟡 Medio | Si se refuta, exige reescribir flujos de trabajo o permisos pero la base arquitectónica se mantiene. |
| 🟢 Bajo | Si se refuta, representa un ajuste localizado en una funcionalidad o interfaz específica. |

### SUP-01
**Asumimos que** el taller opera en una única sede física con 4 bahías de trabajo numeradas y no contempla sucursales adicionales en el alcance inicial.

| Riesgo | Estado | Épicas / Módulos afectados | Pregunta vinculada |
|---|---|---|---|
| 🟡 Medio | **Confirmado** (2026-08-18) | E1 / `work-orders`, `WorkBay` | [P-01](preguntas-cliente.md#p-01) |

> **Evidencia:** El cliente aclaró que operan en un solo local de la zona sur con 4 bahías fijas y que la prioridad operativa se concentra en la rotación de esas bahías.

### SUP-02
**Asumimos que** el inventario de repuestos se gestiona en un almacén centralizado único sin sub-depósitos entre bahías.

| Riesgo | Estado | Épicas / Módulos afectados | Pregunta vinculada |
|---|---|---|---|
| 🔴 Alto | **Confirmado** (2026-08-18) | E1 / `inventory`, `WorkOrderPart` | [P-05](preguntas-cliente.md#p-05), [P-06](preguntas-cliente.md#p-06) |

> **Evidencia:** Se confirmó que existe un único almacén con aproximadamente 300 repuestos donde las piezas se reservan con el presupuesto aprobado (`RN-07`) y se descuentan físicamente al confirmar su instalación (`RN-08`, `RN-09`).

### SUP-03
**Asumimos que** la aprobación de presupuestos adicionales por fallas imprevistas suspende de inmediato la orden y detiene el trabajo del mecánico.

| Riesgo | Estado | Épicas / Módulos afectados | Pregunta vinculada |
|---|---|---|---|
| 🔴 Alto | **Confirmado** (2026-08-18) | E1 / `quotes`, `work-orders` | [P-08](preguntas-cliente.md#p-08), [P-09](preguntas-cliente.md#p-09) |

> **Evidencia:** El cliente ratificó que no existe monto mínimo exento y que cualquier trabajo imprevisto requiere nueva aprobación, deteniendo la reparación.

### SUP-04
**Asumimos que** la falta de stock físico de un repuesto reservado cambia el estado de la OT a *En Espera de Repuesto*, liberando al mecánico para atender otras órdenes.

| Riesgo | Estado | Épicas / Módulos afectados | Pregunta vinculada |
|---|---|---|---|
| 🔴 Alto | **Confirmado** (2026-08-18) | E1 / `work-orders`, `inventory` | [P-13](preguntas-cliente.md#p-13) |

> **Evidencia:** Ante descuadre de stock o piezas faltantes la orden pasa a espera y se genera un ajuste de inventario con motivo.

### SUP-05
**Asumimos que** la garantía por servicio tiene una vigencia estricta de 30 días calendario contados desde la entrega del vehículo, cubriendo 100% de mano de obra y repuestos.

| Riesgo | Estado | Épicas / Módulos afectados | Pregunta vinculada |
|---|---|---|---|
| 🔴 Alto | **Confirmado** (2026-08-18) | E1 / `warranties`, `settlements` | [P-10](preguntas-cliente.md#p-10), [P-14](preguntas-cliente.md#p-14) |

> **Evidencia:** El cliente confirmó una garantía de 30 días y que los reingresos por el mismo problema dentro de ese plazo no generan cobro de mano de obra ni repuestos.

### SUP-06
**Asumimos que** el sistema no interactúa con sistemas de facturación tributaria ni emite facturas fiscales, limitándose a generar la Cuenta de Taller no fiscal en Bolivianos (BOB).

| Riesgo | Estado | Épicas / Módulos afectados | Pregunta vinculada |
|---|---|---|---|
| 🔴 Alto | **Confirmado** (2026-08-18) | E1 / `settlements` | [P-07](preguntas-cliente.md#p-07), [P-20](preguntas-cliente.md#p-20) |

> **Evidencia:** La facturación formal se maneja por canales externos y el sistema solo liquida el detalle de insumos, mano de obra y total.

### SUP-07
**Asumimos que** los vehículos con sistema de propulsión 100% eléctrico quedan totalmente excluidos del sistema y no pueden ser registrados en recepción.

| Riesgo | Estado | Épicas / Módulos afectados | Pregunta vinculada |
|---|---|---|---|
| 🟡 Medio | **Confirmado** (2026-08-18) | E1 / `vehicles`, `work-orders` | [P-12](preguntas-cliente.md#p-12), [P-15](preguntas-cliente.md#p-15) |

> **Evidencia:** El cliente afirmó que no cuenta con certificación técnica ni equipamiento para intervenir vehículos eléctricos y los deriva a otro taller.

### SUP-08
**Asumimos que** el cliente final puede realizar seguimiento del estado de su vehículo de forma pública ingresando únicamente Placa y Documento de Identidad, sin registrar credenciales ni contraseñas.

| Riesgo | Estado | Épicas / Módulos afectados | Pregunta vinculada |
|---|---|---|---|
| 🟡 Medio | **Confirmado** (2026-08-18) | E1 / `tracking-public`, `auth` | [P-17](preguntas-cliente.md#p-17) |

> **Evidencia:** El cliente confirmó que solo desea consulta mediante placa y documento, sin creación de cuentas.

### SUP-09
**Asumimos que** el personal mecánico tiene acceso exclusivo a sus órdenes asignadas y no puede ver costos de repuestos, precios de venta de mano de obra ni aplicar descuentos.

| Riesgo | Estado | Épicas / Módulos afectados | Pregunta vinculada |
|---|---|---|---|
| 🟡 Medio | **Confirmado** (2026-08-18) | E1 / `users`, `work-orders`, `settlements` | [P-16](preguntas-cliente.md#p-16), [P-20](preguntas-cliente.md#p-20) |

> **Evidencia:** El mecánico no ve precios de venta; carga los repuestos usados y las horas trabajadas. Los descuentos y anulaciones corresponden únicamente al jefe de taller.

### SUP-10
**Asumimos que** el expediente técnico y el historial de reparaciones previas de un vehículo es permanente, no se purga y debe desplegarse automáticamente al ingresar la placa.

| Riesgo | Estado | Épicas / Módulos afectados | Pregunta vinculada |
|---|---|---|---|
| 🟢 Bajo | **Confirmado** (2026-08-18) | E1 / `vehicles`, `VehicleHistory` | [P-19](preguntas-cliente.md#p-19) |

> **Evidencia:** El cliente confirmó que el historial del vehículo no se borra y debe mostrarse automáticamente al abrir el vehículo.

### SUP-11
**Asumimos que** una orden que permanece 15 días continuos sin respuesta del cliente genera una alerta visual para seguimiento y gestión de espacio físico en taller.

| Riesgo | Estado | Épicas / Módulos afectados | Pregunta vinculada |
|---|---|---|---|
| 🟢 Bajo | **Confirmado** (2026-08-18) | E1 / `work-orders`, Alertas | [P-10](preguntas-cliente.md#p-10) |

> **Evidencia:** A los quince días sin respuesta el cliente es llamado y, si no retira el vehículo, recibe un aviso por escrito. El sistema debe mostrar los días y el motivo de la detención.

### SUP-12
**Asumimos que** los repuestos sin movimiento por 2 meses o más deben ser marcados por una alerta de rotación en almacén.

| Riesgo | Estado | Épicas / Módulos afectados | Pregunta vinculada |
|---|---|---|---|
| 🟢 Bajo | **Confirmado** (2026-08-18) | E1 / `inventory`, Alertas | [P-21](preguntas-cliente.md#p-21) |

> **Evidencia:** El cliente pidió identificar qué repuestos se mueven y cuáles llevan meses en el estante. El umbral de 2 meses queda formalizado como supuesto operativo.

## Tabla de Trazabilidad: Supuestos y Reglas a Módulos

| Módulo / Dominio | Reglas de Negocio Vinculadas | Supuestos Confirmados |
|---|---|---|
| `work-orders` (Órdenes de Trabajo) | RN-01, RN-02, RN-03, RN-04, RN-05, RN-06, RN-14 | SUP-01, SUP-03, SUP-04, SUP-09, SUP-11 |
| `inventory` (Repuestos y Almacén) | RN-07, RN-08, RN-09, RN-10 | SUP-02, SUP-04, SUP-12 |
| `warranties` (Garantías y Reingresos) | RN-11, RN-12, RN-13 | SUP-05 |
| `vehicles` (Historial Vehicular) | RN-18, RN-19, RN-20 | SUP-07, SUP-10 |
| `settlements` (Cuentas y Liquidación) | RN-15, RN-16, RN-21, RN-22 | SUP-06, SUP-09 |
| `tracking-public` (Consulta Cliente) | RN-17 | SUP-08 |

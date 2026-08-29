# E1 — Recepción, seguimiento y asignación de órdenes de trabajo

## Objetivo

Formalizar el flujo operativo inicial del taller mecánico, permitiendo registrar el ingreso de vehículos con sus reglas de negocio, dar seguimiento público al estado de la atención para el cliente y gestionar la asignación interna del trabajo a los mecánicos sin exponer datos financieros.

## Origen

Requerimientos operativos del Sprint 1 y reglas de negocio de taller automotriz, incluyendo la restricción a vehículos 100% eléctricos y la confidencialidad de tarifas ante operarios.

## Prioridad de la épica

**Must**: constituye el núcleo funcional básico sin el cual no puede operar el taller mecánico ni registrarse la trazabilidad del servicio.

## Historias de usuario

| ID | Título | Prioridad | Puntos |
| --- | --- | --- | --- |
| HU-01 | Registrar ingreso del vehículo | Must | 3 |
| HU-02 | Consultar estado del vehículo | Must | 3 |
| HU-03 | Ver órdenes asignadas | Must | 3 |
| HU-04 | Asignar órdenes de trabajo | Must | 3 |

## Trazabilidad

- **Contexto de origen:** [00-contexto-problema.md](../00-contexto-problema.md)
- **Reglas generales y de negocio:** [constitution/00-general.md](../constitution/00-general.md), especialmente RN-01, RN-04, RN-14, RN-16, RN-17, RN-18, RN-19 y RN-20.
- **Reglas técnicas:** [constitution/backend.md](../constitution/backend.md), [constitution/frontend.md](../constitution/frontend.md) y [constitution/tools.md](../constitution/tools.md).
- **Preguntas pendientes de validación:** [preguntas-cliente.md](../preguntas-cliente.md)
- **Supuestos y respuestas:** [supuestos.md](../supuestos.md), [registro-respuestas-cliente.md](../registro-respuestas-cliente.md)

## HU-01: Registrar ingreso del vehículo

**Como** Recepcionista, **quiero** registrar el ingreso de un vehículo capturando sus datos y el reclamo del cliente, **para que** se inicie formalmente el flujo de atención y se genere la Orden de Trabajo.

| Prioridad | Puntos | Rol | Depende de |
| --- | --- | --- | --- |
| Must | 3 | Recepcionista | — |

### Criterios de aceptación

```gherkin
Escenario: Registro exitoso de nuevo vehículo
  Dado que llega un cliente con un vehículo a combustión o híbrido
  Cuando la recepcionista completa los datos obligatorios y el reclamo inicial
  Entonces el sistema crea el registro del cliente, del vehículo y genera una nueva Orden de Trabajo (OT)

Escenario: Autocompletado por historial técnico previo
  Dado que un vehículo ya cuenta con registros previos en el taller
  Cuando la recepcionista digita su número de placa en el formulario
  Entonces el sistema carga y despliega automáticamente su expediente e historial técnico asociado

Escenario: Bloqueo de recepción para vehículos eléctricos
  Dado que el vehículo que se intenta registrar es 100% eléctrico
  Cuando la recepcionista selecciona el tipo de motorización eléctrica e intenta guardar
  Entonces el sistema bloquea la creación de la OT
  Y muestra un mensaje indicando que el taller no cuenta con soporte para vehículos eléctricos
```

## HU-02: Consultar estado del vehículo

**Como** Cliente, **quiero** consultar el estado actual de mi vehículo desde el sistema sin necesidad de iniciar sesión, **para que** sepa en qué etapa se encuentra la atención y si ya está listo para ser retirado.

| Prioridad | Puntos | Rol | Depende de |
| --- | --- | --- | --- |
| Must | 3 | Cliente (Público) | HU-01 |

### Criterios de aceptación

```gherkin
Escenario: Consulta exitosa de estado en proceso
  Dado que el cliente cuenta con una Orden de Trabajo registrada
  Cuando ingresa los datos de identificación válidos de su orden
  Entonces el sistema muestra la etapa actual y el estado de avance de su vehículo

Escenario: Consulta de vehículo listo para entrega
  Dado que la Orden de Trabajo se encuentra en estado "Finalizado / Listo para entrega"
  Cuando el cliente realiza la consulta
  Entonces el sistema le indica de forma explícita que el vehículo puede ser retirado

Escenario: Identificador inexistente o incorrecto
  Cuando el cliente ingresa datos de consulta que no corresponden a ninguna OT activa
  Entonces el sistema informa que no se encontró una Orden de Trabajo válida
  Y evita divulgar cualquier información técnica o datos de otros clientes
```

## HU-03: Ver órdenes asignadas

**Como** Mecánico, **quiero** visualizar las órdenes de trabajo que me han sido asignadas, **para que** pueda enfocarme únicamente en las labores operativas que me corresponden.

| Prioridad | Puntos | Rol | Depende de |
| --- | --- | --- | --- |
| Must | 3 | Mecánico | HU-04 |

### Criterios de aceptación

```gherkin
Escenario: Visualización exclusiva de asignaciones propias
  Dado que un mecánico inicia sesión en el sistema
  Cuando accede a su panel de trabajo operativo
  Entonces visualiza única y exclusivamente las OTs que le han sido asignadas de forma explícita

Escenario: Confidencialidad de costos y precios
  Dado que el mecánico abre el detalle técnico de su OT asignada
  Cuando revisa los repuestos requeridos o las tareas de mano de obra
  Entonces el sistema omite y oculta cualquier importe, tarifa, costo o valor monetario
```

## HU-04: Asignar órdenes de trabajo

**Como** Jefe de Taller, **quiero** asignar una Orden de Trabajo a un mecánico específico, **para que** se distribuya el trabajo de forma organizada y balanceada en el taller.

| Prioridad | Puntos | Rol | Depende de |
| --- | --- | --- | --- |
| Must | 3 | Jefe de Taller | HU-01 |

### Criterios de aceptación

```gherkin
Escenario: Asignación exitosa de orden
  Dado que el Jefe de Taller selecciona una OT en estado inicial
  Cuando le asigna un mecánico responsable
  Entonces la OT cambia de estado
  Y se refleja inmediatamente en la lista de trabajo personal de dicho mecánico

Escenario: Restricción de permisos para asignación
  Dado que un usuario con un rol distinto a Jefe de Taller intenta reasignar una orden
  Cuando envía la solicitud
  Entonces el sistema deniega la operación
  Y mantiene la asignación sin modificaciones
```

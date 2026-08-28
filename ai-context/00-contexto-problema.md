# P04 — Sistema de gestión para un taller mecánico

> Ficha de problema del curso de Ingeniería de Software — UPB · II-2026
> Transcripción del enunciado entregado por el docente. **No modificar**: este archivo es la fuente original. Todo lo que el equipo deduzca, suponga o decida va en [supuestos.md](supuestos.md), en [preguntas-cliente.md](preguntas-cliente.md) o en el [backlog](backlog/).

| Dominio | Complejidad | Cupos |
| --- | --- | --- |
| Servicios técnicos | Media-alta | Máximo 2 equipos |

---

## Contexto

Taller Andino repara vehículos livianos. Tiene 5 mecánicos, un jefe de taller, una persona en recepción y un pequeño almacén de repuestos.

**Organización afectada:** Taller con 4 bahías de trabajo, entre 8 y 15 vehículos por día y unos 300 repuestos en almacén.

## Problema principal

Cada vehículo que entra se anota en una hoja que se pega al parabrisas. Nadie sabe en qué estado está un trabajo sin ir a preguntar al mecánico. Los clientes llaman constantemente para saber si su auto está listo y el jefe de taller no puede estimar cuándo se libera una bahía.

## Usuarios principales

| Usuario | Qué necesita |
| --- | --- |
| Recepcionista | Registrar el ingreso del vehículo y el reclamo del cliente; informar al cliente |
| Mecánico | Ver los trabajos asignados, registrar avance y repuestos usados |
| Jefe de taller | Asignar trabajos, ver la carga del taller y aprobar presupuestos |
| Cliente | Consultar el estado de su vehículo |

## Proceso actual

1. El cliente llega, describe el problema y la recepcionista llena una hoja.
2. El jefe de taller decide qué mecánico lo atiende.
3. El mecánico diagnostica, pide repuestos al almacén y repara.
4. Si el arreglo cuesta más de lo previsto, alguien llama al cliente para que autorice.
5. Al terminar, la recepcionista arma la cuenta sumando repuestos y mano de obra.

## Dificultades observadas

| # | Dificultad | Atendida por |
| --- | --- | --- |
| D1 | No se sabe en qué estado está un trabajo sin preguntar en persona | [E1](backlog/E1-recepcion-seguimiento-y-asignacion-de-ordenes-de-trabajo.md) |
| D2 | Se usan repuestos que nadie descontó del almacén | [E1](backlog/E1-recepcion-seguimiento-y-asignacion-de-ordenes-de-trabajo.md) / Inventario |
| D3 | Presupuestos aprobados por teléfono sin registro | [E1](backlog/E1-recepcion-seguimiento-y-asignacion-de-ordenes-de-trabajo.md) / Presupuestos |
| D4 | No hay historial: cuando el mismo auto vuelve, nadie recuerda qué se le hizo | [E1](backlog/E1-recepcion-seguimiento-y-asignacion-de-ordenes-de-trabajo.md) / Historial Vehicular |

## Restricciones

| # | Restricción | Atendida por |
| --- | --- | --- |
| R1 | Debe funcionar desde navegador, también en tablet dentro del taller | Decisión de arquitectura — Frontend adaptativo |
| R2 | La orden de trabajo debe recorrer estados claros y auditables | Máquina de estados de la OT |
| R3 | Debe descontar repuestos del almacén al usarlos | Módulo de Almacén e Inventario |
| R4 | Debe conservar el historial por vehículo | Expediente e Historial técnico permanente |

## Resultado esperado

Un sistema donde cada vehículo tenga una orden de trabajo con estado visible, los repuestos se descuenten al usarse, los presupuestos queden aprobados por escrito y el historial del vehículo esté disponible la próxima vez que entre.

## Complejidad aproximada

Media-alta. El valor está en la máquina de estados de la orden de trabajo y en su relación con el inventario de repuestos y con el cliente. Da mucho juego para diseño y para pruebas.

---

## La ficha está incompleta a propósito

Cita textual del enunciado:

> Lo que acaba de leer no es todo el problema. Faltan reglas de negocio, excepciones, permisos y detalles del proceso que solo el cliente conoce.
>
> En la sesión 2 el docente actúa como cliente y responde únicamente lo que se le pregunte. Lo que no se pregunte, no se sabrá — y el backlog va a nacer incompleto.

**Consecuencia directa sobre este repositorio:** el backlog inicial se redacta a partir de la ficha base y las reglas de negocio formalizadas (RN-01 a RN-22). Cada comportamiento no contemplado explícitamente se registra como supuesto `SUP-xx` en [supuestos.md](supuestos.md).

Antes de la sesión 2, leer [preguntas-cliente.md](preguntas-cliente.md).
Durante la sesión 2, llenar [registro-respuestas-cliente.md](registro-respuestas-cliente.md).
Después de la sesión 2, actualizar [supuestos.md](supuestos.md) y reescribir las US afectadas.

### Los seis escalones para preguntar

| # | Escalón | Pregunta tipo |
| --- | --- | --- |
| 1 | Contexto | ¿Quiénes son y qué hacen hoy? |
| 2 | Proceso | ¿Cómo lo hacen, paso a paso? |
| 3 | Reglas | ¿Qué está permitido y qué no? |
| 4 | Excepciones | ¿Qué pasa cuando sale mal? |
| 5 | Permisos | ¿Quién puede hacer qué? |
| 6 | Datos | ¿Qué hay que conservar y por cuánto tiempo? |

### Las seis preguntas comodín

- ¿Quién puede hacer esto?
- ¿Se puede deshacer? ¿Hasta cuándo?
- ¿Qué pasa si no hay, no existe o no alcanza?
- ¿Siempre es igual o depende de algo?
- ¿Hay algún caso en que esto no aplique?
- ¿Qué hacen hoy cuando esto falla?

> Preferir la pregunta abierta a la cerrada: la cerrada devuelve un dato, la abierta devuelve el problema. Y la más rentable de todas es **¿y qué pasa cuando sale mal?**, porque la complejidad real vive en las excepciones.

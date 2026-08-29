# ai-context

Contexto compartido del proyecto **P04 — Sistema de gestión para un taller mecánico** (Los Fratelli / Taller Andino) · Ingeniería de Software · UPB II-2026.

Este repositorio es la fuente de verdad de **qué** se construye, **por qué** y **cómo** se escribe el código. El código vive en los repositorios asociados:

- [`backend`](https://app.skynetupb.store/practica_interna_a/backend) (NestJS + Prisma + PostgreSQL)
- [`frontend`](https://app.skynetupb.store/practica_interna_a/frontend) (React + Vite + TypeScript)
- [`tools`](https://app.skynetupb.store/practica_interna_a/tools) (Docker, scripts de datos y CI)

> **Si vas a programar —o eres un agente de IA asistiendo al equipo— empieza por [constitution/00-general.md](constitution/00-general.md).** Ahí residen las reglas técnicas y de dominio obligatorias. El resto de este repositorio corresponde al análisis funcional y la trazabilidad de requerimientos.

## Contenido

### Análisis funcional — qué se construye y por qué

| Documento | Para qué sirve |
| --- | --- |
| [00-contexto-problema.md](00-contexto-problema.md) | Ficha del problema entregada por el docente. Fuente original, no se modifica |
| [backlog/](backlog/) | User Stories y criterios Gherkin agrupados por épicas `E1`, `E2`, `E3` y `E4` |
| [supuestos.md](supuestos.md) | Registro de supuestos `SUP-xx` y vacíos técnicos pendientes de validación |
| [preguntas-cliente.md](preguntas-cliente.md) | Banco de preguntas estructurado por los seis escalones para la sesión con el cliente |
| [registro-respuestas-cliente.md](registro-respuestas-cliente.md) | Registro textual de respuestas y clarificaciones del cliente |

### Épicas

- **E1:** [Recepción, seguimiento y asignación de órdenes de trabajo](backlog/E1-recepcion-seguimiento-y-asignacion-de-ordenes-de-trabajo.md)
- **E2:** [Presupuestos y Aprobación del Cliente](backlog/E2-presupuestos-y-aprobacion-del-cliente.md)
- **E3:** [Gestión de Inventario y Almacén](backlog/E3-gestion-de-inventario-y-almacen.md)
- **E4:** [Seguimiento y Comunicación](backlog/E4-seguimiento-y-comunicacion.md)

### Constitución técnica — cómo se escribe el código

| Documento | Para qué sirve |
| --- | --- |
| [constitution/00-general.md](constitution/00-general.md) | `GEN-` · Idioma, vocabulario de dominio, 22 reglas de negocio, stack general y DoD |
| [constitution/backend.md](constitution/backend.md) | `BE-` · NestJS 11, arquitectura por capas, Prisma 7, PostgreSQL, REST y seguridad |
| [constitution/frontend.md](constitution/frontend.md) | `FE-` · React 19, Vite, OpenAPI codegen, React Query y soporte para tablet/taller |
| [constitution/tools.md](constitution/tools.md) | `TL-` · Docker Compose, seeds realistas, configuraciones y CI |

## Estado de las reglas y el backlog

El análisis combina las restricciones del enunciado original y las **22 reglas de negocio confirmadas (`RN-01` a `RN-22`)**:

- **Máquina de estados estricta:** la Orden de Trabajo (OT) recorre transiciones auditables (`recibido → en diagnóstico → presupuesto enviado → aprobado → en reparación → listo → entregado`), con ramas para `rechazado` y `en espera de repuesto` (`RN-05`).
- **Control de repuestos:** las piezas se reservan con el presupuesto aprobado (`RN-07`) y se descuentan físicamente solo tras la confirmación de instalación del mecánico (`RN-08`, `RN-09`).
- **Garantía formal:** 30 días calendario (`RN-11`), con exención automática de cobro en mano de obra y repuestos (`RN-12`), y aprobación del Jefe de Taller si el reingreso ocurre después del plazo (`RN-13`).
- **Seguridad y exclusiones:** bloqueo de vehículos 100% eléctricos (`RN-18`), portal público con placa y documento (`RN-17`) y visualización restringida de precios para mecánicos (`RN-16`).

## Cómo se usa

### Antes de la sesión de aclaraciones

- Leer [00-contexto-problema.md](00-contexto-problema.md).
- Revisar los supuestos técnicos en [supuestos.md](supuestos.md).
- Preparar y priorizar las preguntas críticas en [preguntas-cliente.md](preguntas-cliente.md).

### Durante la sesión de aclaraciones

- Registrar en [registro-respuestas-cliente.md](registro-respuestas-cliente.md) las declaraciones **textuales** del docente-cliente.
- Explorar los seis escalones en orden: Contexto → Proceso → Reglas → Excepciones → Permisos → Datos.

### Después de la sesión

- Actualizar el estado de cada supuesto en [supuestos.md](supuestos.md) (`Confirmado` o `Refutado`).
- Refactorizar o crear las User Stories en `backlog/` según las decisiones tomadas.

## Convenciones de identificadores

| Prefijo | Qué identifica | Dónde vive |
| --- | --- | --- |
| `US-xx` | User Story | [backlog/](backlog/) |
| `E-x` | Épica de trabajo | [backlog/](backlog/) |
| `RN-xx` | Regla de negocio confirmada | [constitution/00-general.md](constitution/00-general.md) |
| `SUP-xx` | Supuesto o riesgo técnico | [supuestos.md](supuestos.md) |
| `P-xx` | Pregunta de relevamiento | [preguntas-cliente.md](preguntas-cliente.md) |
| `GEN-xx` | Regla arquitectónica general | [constitution/00-general.md](constitution/00-general.md) |
| `BE-xx` | Regla técnica de Backend | [constitution/backend.md](constitution/backend.md) |
| `FE-xx` | Regla técnica de Frontend | [constitution/frontend.md](constitution/frontend.md) |
| `TL-xx` | Regla técnica de Infraestructura / Tools | [constitution/tools.md](constitution/tools.md) |

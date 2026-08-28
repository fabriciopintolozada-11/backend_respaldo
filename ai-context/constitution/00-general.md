# Reglas generales — GEN (Los Fratelli - Taller Mecánico)

Aplican a todos los repositorios del proyecto. Las reglas específicas de cada repositorio están en [backend.md](backend.md), [frontend.md](frontend.md) y [tools.md](tools.md), y **nunca contradicen** lo que está aquí: si parece que lo hacen, gana este documento y hay que corregir el otro.

Niveles normativos: **MUST** es obligatorio, **SHOULD** admite excepción justificada por escrito, **MAY** es opcional.

---

## Idioma y estilo

### GEN-01
**Documentación en español, código en inglés**

**MUST.** Todo lo que se lee como documento va en español: los `.md` de este repo, las descripciones de MR y los comentarios de revisión. Todo lo que vive dentro del código va en inglés: clases, variables, funciones, nombres de archivo, tablas y columnas de base de datos, rutas de la API, comentarios en el código y mensajes de commit.

- ✅ `class WorkOrder`, `POST /api/v1/work-orders`, tabla `spare_parts`
- ❌ `class OrdenTrabajo`, `POST /api/v1/ordenes-trabajo`, tabla `repuestos`

### GEN-02
**El vocabulario del dominio se traduce una sola vez y no se vuelve a discutir**

**MUST.** Usar exactamente estos términos en el código para mantener consistencia con el análisis funcional:

| Dominio (Backlog / Taller) | Código | Descripción / Contexto |
| --- | --- | --- |
| Orden de trabajo | `WorkOrder` | Entidad central del servicio |
| Tarea / Mano de obra | `WorkOrderTask` / `Labor` | Actividad técnica realizada |
| Vehículo | `Vehicle` | Automóvil registrado (placa, modelo, etc.) |
| Historial del vehículo | `VehicleHistory` | Expediente histórico acumulado |
| Repuesto | `SparePart` | Ítem de inventario en almacén |
| Repuesto asignado/usado | `WorkOrderPart` / `UsedPart` | Repuesto reservado o consumido en la OT |
| Bahía de trabajo | `WorkBay` | Espacio físico asignado en taller |
| Presupuesto / Estimación | `Quote` / `Estimate` | Cálculo preliminar de costo |
| Aprobación de presupuesto | `QuoteApproval` | Autorización explícita del cliente |
| Recepcionista | `RECEPTIONIST` | Rol de usuario |
| Mecánico | `MECHANIC` | Rol de usuario |
| Jefe de taller | `WORKSHOP_LEAD` | Rol de usuario |
| Cliente | `Client` / `Customer` | Propietario del vehículo |
| Administrador | `ADMIN` | Rol de usuario administrativo |
| Motivo / Razón | `reason` | Justificación (pausa, anulación, descuento) |
| Cuenta de Taller / Liquidación | `WorkshopBill` / `Settlement` | Resumen final no fiscal en BOB |
| Anulación | `void` (verbo) / `voidedAt` (campo) | Anulación lógica auditable |

---

## Stack y versiones

### GEN-03
**Versiones fijadas**

**MUST.** Estas son las versiones verificadas y obligatorias para todo el ecosistema del proyecto:

| Herramienta | Versión | Nota |
| --- | --- | --- |
| Node.js | 24 LTS | Cubre los requisitos de NestJS (`>=20`), Prisma (`>=24.0`) y Vite (`>=22.12`) |
| npm | 11.x | Gestor de paquetes único, ver [GEN-04](#gen-04) |
| TypeScript | **6.0.x** | No 7.x — ver [GEN-05](#gen-05) |
| PostgreSQL | 17 o superior | Base de datos relacional |

### GEN-04
**npm como único gestor de paquetes**

**MUST.** Prohibido el uso de `yarn` o `pnpm`. El archivo `package-lock.json` se versiona siempre y se commitea junto con cualquier cambio en `package.json`.

### GEN-05
**TypeScript 6.0.x y modo `strict`, sin `any`**

**MUST.** TypeScript debe permanecer en la rama 6.0.x para preservar la compatibilidad con el Compiler API que utiliza NestJS y sus plugins de CLI.

**MUST.** `"strict": true` obligatorio en todos los `tsconfig.json`. El tipo `any` está prohibido; usar `unknown` y estrechar tipos.

**SHOULD.** Si se requiere un `any` excepcional, va con `// eslint-disable-next-line` y una justificación técnica.

---

## Git y Control de Versiones

### GEN-06
**Conventional commits en inglés**

**MUST.** Formato `<type>(<scope>): <subject>` en imperativo, minúsculas y sin punto final. Tipos permitidos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`.

### GEN-07
**Estrategia de ramas y trazabilidad de MR**

**MUST.** Las ramas usan uno de estos formatos: `feat/<us-id>-<slug>`, `fix/<slug>`, `docs/<slug>` o `chore/<slug>`.

**MUST.** Está prohibido hacer push directo a `main`. Todo cambio entra por Merge Request (MR), enlazando la US correspondiente y listando los criterios Gherkin cubiertos.

**MUST.** Ningún commit lleva trailers de coautoría (`Co-Authored-By:`) ni referencias a herramientas de IA generativa.

---

## Relación con el análisis funcional

### GEN-08
**Reglas de negocio base del taller (Los Fratelli)**

**MUST.** Toda la lógica de negocio debe respetar obligatoriamente las siguientes reglas formalizadas:

| Regla | Descripción |
| --- | --- |
| **RN-01** | Todo vehículo que ingrese al taller debe tener una Orden de Trabajo (OT) registrada antes de iniciar cualquier actividad, capturando obligatoriamente los datos del vehículo y el reclamo inicial del cliente. |
| **RN-02** | Ningún trabajo de reparación ni consumo de insumos puede iniciarse sin la aprobación previa y explícita del cliente sobre el presupuesto. No existe un monto mínimo exento de autorización. |
| **RN-03** | Si durante la reparación surgen trabajos o fallas adicionales no previstos, la OT debe suspenderse inmediatamente y retornar a estado de presupuesto hasta recibir una nueva aprobación del cliente. |
| **RN-04** | Un mecánico solo puede visualizar y trabajar en las órdenes de trabajo que le hayan sido asignadas explícitamente. |
| **RN-05** | Si un vehículo no puede continuar por falta de repuestos, la OT debe cambiar al estado *En Espera de Repuesto*, liberando temporalmente al mecánico. |
| **RN-06** | Cuando una OT permanezca 15 días continuos sin respuesta de aprobación del cliente, el sistema debe generar una alerta a Recepción. |
| **RN-07** | Los repuestos incluidos en un presupuesto aprobado quedan en estado *Reservado* exclusivamente para esa OT. |
| **RN-08** | El inventario físico solo se descuenta cuando el mecánico confirma la instalación y uso efectivo del insumo. |
| **RN-09** | Está prohibida la salida física e informática de componentes sin una OT aprobada y vinculada al mecánico solicitante. |
| **RN-10** | El sistema debe alertar sobre repuestos e insumos sin rotación durante un periodo igual o mayor a 2 meses. |
| **RN-11** | Todos los servicios de reparación cuentan con una garantía predeterminada de 30 días calendario desde la entrega del vehículo. |
| **RN-12** | Si un vehículo reingresa dentro de 30 días por una falla relacionada con un trabajo anterior, se genera una nueva OT categorizada como *Garantía*, sin cobro de mano de obra ni repuestos. |
| **RN-13** | Si el reingreso por garantía ocurre después de 30 días, se bloquea la exención automática y se requiere autorización del Jefe de Taller. |
| **RN-14** | Solo el Jefe de Taller puede asignar órdenes de trabajo a mecánicos y definir la prioridad de atención en las bahías. |
| **RN-15** | Solo el Jefe de Taller puede aplicar descuentos, anulaciones o modificaciones sobre los montos liquidados de una OT. |
| **RN-16** | Los mecánicos no pueden visualizar precios de venta de mano de obra o repuestos, ni aplicar descuentos o alterar importes. |
| **RN-17** | El cliente puede consultar el estado de su vehículo sin usuario ni contraseña, usando la placa y el documento de identidad. |
| **RN-18** | El sistema bloquea el registro o recepción de vehículos cuya propulsión sea 100% eléctrica. |
| **RN-19** | El historial técnico de servicios, piezas sustituidas, mecánicos asignados y fechas es permanente y nunca puede eliminarse. |
| **RN-20** | Al ingresar una placa en Recepción o en el módulo del Jefe de Taller, el sistema despliega automáticamente el expediente histórico previo. |
| **RN-21** | Las transacciones, montos, precios de lista y cuentas finales se gestionan exclusivamente en Bolivianos (BOB). |
| **RN-22** | El sistema no emite facturas fiscales; genera únicamente el detalle de la Cuenta de Taller con repuestos, mano de obra y total a pagar. |

### GEN-09
**Gestión de vacíos y supuestos técnicos**

**MUST.** Si al programar una US aparece una decisión que el backlog o estas reglas no cubren:

1. Registrar un supuesto `SUP-xx` en `supuestos.md`, incluyendo su riesgo y las US afectadas.
2. Agregar la pregunta correspondiente a `preguntas-cliente.md`.
3. Implementar la opción más conservadora y marcarla en el código citando el supuesto:

```ts
// SUP-NN: assumed behavior, pending client confirmation
```

### GEN-10
**Identificadores trazables en ambas direcciones**

**MUST.** Usar siempre esta nomenclatura oficial en código y documentación:

| Identificador | Significado |
| --- | --- |
| `US-xx` | User Story |
| `E-x` | Épica |
| `RN-xx` | Regla de Negocio |
| `SUP-xx` | Supuesto |
| `P-xx` | Pregunta al Cliente |
| `GEN-`, `BE-`, `FE-`, `TL-` | Reglas de arquitectura |

Los identificadores deben citarse explícitamente en el código cuando justifican una validación:

```ts
// RN-18: block 100% electric vehicles from entering the workshop
// RN-07: reserve spare parts so they cannot be taken by other work orders
```

---

## Calidad y Definition of Done (DoD)

### GEN-11
**Seguridad y variables de entorno**

**MUST.** No se almacenan credenciales, tokens ni cadenas de conexión en el repositorio. Cada repositorio versiona un `.env.example` y el archivo `.env` real debe estar ignorado en `.gitignore`.

### GEN-12
**Definition of Done (DoD)**

**MUST.** Un cambio o MR está terminado únicamente cuando cumple:

- [ ] Compila y el linter pasa sin advertencias.
- [ ] Los criterios de aceptación Gherkin de la US están cubiertos por pruebas automatizadas que pasan.
- [ ] La UI funciona correctamente en pantallas de escritorio y tablet, para uso en taller.
- [ ] No hay tipos `any` sin justificar, secretos ni `console.log` olvidados.
- [ ] El MR referencia formalmente la US asociada, según GEN-07.
- [ ] Si se asumió algún comportamiento nuevo, quedó documentado como `SUP-xx`, según GEN-09.

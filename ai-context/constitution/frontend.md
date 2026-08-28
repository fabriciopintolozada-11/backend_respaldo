# Reglas de frontend — FE (Los Fratelli - Taller Mecánico)

Repo `frontend` · React + Vite + TypeScript, SPA que consume la API REST del backend.

Requiere haber leído [00-general.md](00-general.md). Las reglas de idioma ([GEN-01](00-general.md#gen-01)), vocabulario ([GEN-02](00-general.md#gen-02)), reglas de negocio ([GEN-08](00-general.md#gen-08)) y supuestos ([GEN-09](00-general.md#gen-09)) aplican aquí sin repetirse.

---

## Stack

### FE-01
**Versiones del frontend**

**MUST.** Verificadas contra npm en agosto de 2026.

| Paquete | Versión | Propósito |
| --- | --- | --- |
| `react`, `react-dom` | 19.x | Biblioteca UI principal |
| `vite` | 8.x | Build tool y servidor de desarrollo |
| `typescript` | 6.0.x | Ver [GEN-05](00-general.md#gen-05) |
| `@tanstack/react-query` | 5.x | Estado del servidor y caché |
| `react-router` | 7.x | Enrutamiento declarativo y layouts |
| `react-hook-form` | 7.x | Manejo de formularios |
| `zod` | 4.x | Esquemas de validación tipados |
| `openapi-typescript` | 7.x | Generación de tipos desde Swagger |
| `vitest` | 4.x | Testing unitario y de componentes |
| `@testing-library/react` | última compatible | Pruebas de integración de componentes |
| `msw` | 2.x | Simulación de API |
| `zustand` | 5.x | Estado global de cliente, solo si es necesario |

## Contrato con el backend

### FE-02
**Generación automática de tipos de la API**

**MUST.** Los tipos de respuestas, esquemas y payloads se generan con `openapi-typescript` a partir del OpenAPI de NestJS ([BE-25](backend.md#be-25)) y se depositan en `src/shared/api/schema.gen.ts`. Este archivo nunca se edita manualmente.

```bash
npx openapi-typescript http://localhost:3000/api/docs-json -o src/shared/api/schema.gen.ts
```

**MUST.** Está prohibido declarar manualmente interfaces espejo para las respuestas de la API.

### FE-03
**Cliente HTTP centralizado**

**MUST.** Todas las peticiones HTTP se realizan mediante un cliente único en `src/shared/api/`, que encapsula la URL base, los headers JWT, la renovación automática de tokens y la captura tipada de errores.

### FE-04
**Traducción y visibilidad de errores del backend**

**MUST.** El cliente traduce la estructura de error estandarizada (BE-26) para mostrar mensajes comprensibles:

- `403`: falta de permisos, como intentar ver precios bajo RN-16 o cambiar asignaciones bajo RN-14.
- `404`: entidad no encontrada, como una placa inexistente.
- `422`: violación de regla de negocio, como vehículo 100% eléctrico bajo RN-18 o consumo de repuesto sin OT aprobada bajo RN-09.

## Estructura de carpetas

### FE-05
**Feature-first en espejo con el backend**

**MUST.** La organización modular refleja los dominios del taller:

```text
src/
├── features/
│   ├── work-orders/        # Listado de OTs, kanban de bahías y tracking de estados
│   │   ├── api/            # Hooks de React Query
│   │   ├── components/     # WorkOrderCard, BayStatusGrid, StatusBadge
│   │   ├── hooks/
│   │   └── pages/          # WorkOrdersPage, WorkOrderDetailPage
│   ├── vehicles/           # Expediente histórico y búsqueda por placa (RN-19, RN-20)
│   ├── quotes/             # Aprobación y re-cotización (RN-02, RN-03)
│   ├── inventory/          # Catálogo y alertas de rotación (RN-10)
│   ├── settlements/        # Cuentas de taller en BOB (RN-21, RN-22)
│   ├── tracking-public/    # Portal público para clientes (placa + DNI) (RN-17)
│   └── auth/               # Inicio de sesión interno
├── shared/
│   ├── api/                # Cliente HTTP y schema.gen.ts
│   ├── components/         # UI reutilizable y agnóstica
│   ├── hooks/
│   └── lib/
├── app/                    # Router, providers y layouts
└── main.tsx
```

### FE-06
**Convención de nombres de archivo**

**MUST.** Los componentes usan PascalCase (`WorkOrderCard.tsx`, `VehicleHistoryTable.tsx`), los hooks camelCase con prefijo `use` (`useVehicleHistory.ts`) y servicios, utilitarios y esquemas kebab-case (`work-orders-api.ts`, `quote-schema.ts`). Cada archivo exporta un solo componente.

### FE-07
**Componentes compartidos agnósticos del dominio**

**MUST.** Los elementos de `src/shared/components` no importan nada de `src/features/`. Componentes como `DataTable` o `Modal` operan exclusivamente mediante props, sin referencias a órdenes, repuestos o clientes.

## Estado

### FE-08
**Manejo estricto del estado de servidor con React Query**

**MUST.** Toda lectura del backend se gestiona mediante `@tanstack/react-query`. Está prohibido el antipatrón manual `useEffect` + `fetch` + `useState`.

```ts
const { data: vehicleHistory, isLoading } = useQuery({
  queryKey: ['vehicles', plate, 'history'],
  queryFn: () => vehiclesApi.getHistory(plate),
  enabled: plate.length >= 6,
});
```

### FE-09
**Invalidación de consultas tras mutaciones**

**MUST.** Toda mutación invalida las queries dependientes:

- Confirmar el uso de un repuesto en una OT (RN-08) invalida el detalle de la OT y el stock disponible.
- Asignar un mecánico (RN-14) invalida la vista del Jefe de Taller y la lista del mecánico (RN-04).
- Suspender una OT por trabajos adicionales (RN-03) invalida la bahía y el presupuesto.

### FE-10
**Estado de cliente acotado**

**SHOULD.** Priorizar estado local con `useState`. Usar Context API únicamente para autenticación y preferencias. Reservar Zustand para flujos de varios pasos, como el asistente de recepción y diagnóstico inicial.

## Formularios y Validación

### FE-11
**React Hook Form con esquemas Zod**

**MUST.** Toda captura de datos se gestiona con `react-hook-form` integrado a un esquema Zod. La validación del cliente proporciona retroalimentación inmediata, pero nunca sustituye las comprobaciones del backend.

### FE-12
**Validación de reglas en tiempo real y errores contextuados**

**MUST.** El formulario de recepción bloquea inmediatamente la selección de propulsión 100% eléctrica (RN-18) e informa la restricción. Los errores se muestran junto al input específico.

## Experiencia de Usuario y Diseño para Taller

### FE-13
**Manejo explícito de estados: carga, error y vacío**

**MUST.** Toda vista con datos contempla y renderiza un indicador de carga, un estado de error claro con opción de reintentar y un estado vacío descriptivo, como "El vehículo no registra servicios o reparaciones previas en el taller" para RN-20.

### FE-14
**Optimización para tablets y uso en taller**

**MUST.** La interfaz de mecánicos se adapta a pantallas táctiles de tablet. Los botones de acción tienen un área táctil mínima de `44x44 px`, especialmente para confirmar uso de repuestos (RN-08) y cambiar a *En Espera de Repuesto* (RN-05). Los precios e importes se ocultan estrictamente al rol `MECHANIC` (RN-16).

### FE-15
**Búsqueda instantánea con debounce para historial**

**MUST.** El campo de placa en Recepción y en el módulo del Jefe de Taller usa debounce de 300 a 400 ms para consultar y desplegar el historial sin recargar la página (RN-20).

### FE-16
**Notificaciones y alertas no intrusivas**

**MUST.** Las alertas, como OTs con 15 días sin respuesta (RN-06) o repuestos sin rotación por 2 meses (RN-10), se muestran mediante banners o badges informativos. No deben bloquear el flujo con modales ni `alert()` nativo.

### FE-17
**Portal de consulta pública de clientes**

**MUST.** La pantalla pública de consulta (RN-17) es simple, accesible sin login y solicita exclusivamente placa del vehículo y documento de identidad del propietario para mostrar el estado y avance de la orden.

## Seguridad y Permisos

### FE-18
**Rutas y elementos protegidos por rol**

**MUST.** La interfaz oculta enlaces, vistas y acciones que no correspondan al rol autenticado:

- Solo `WORKSHOP_LEAD` ve controles de asignación de mecánicos y bahías (RN-14), y de descuentos o anulaciones (RN-15).
- `MECHANIC` solo accede a sus OTs asignadas (RN-04) y no puede ver costos ni precios (RN-16).

### FE-19
**Manejo de tokens JWT**

**SHOULD.** Guardar el access token en memoria y usar cookies seguras para el refresh token. Si se usa `localStorage`, se deben limpiar las credenciales al detectar errores `401`.

## Testing

### FE-20
**Testing accesible con Vitest y Testing Library**

**MUST.** Las consultas en tests priorizan roles accesibles y etiquetas:

```ts
getByRole('button', { name: /confirmar uso/i });
getByLabelText(/placa del vehículo/i);
```

### FE-21
**Mockeo de endpoints con Mock Service Worker (MSW)**

**MUST.** Los tests de integración emulan respuestas mediante MSW, sin llamadas reales de red ni mocks manuales de `fetch` o `axios`.

### FE-22
**Pruebas centradas en comportamiento y reglas de negocio**

**SHOULD.** Redactar tests descriptivos en inglés centrados en las reglas:

```ts
it('blocks submission and displays warning when selecting 100% electric propulsion (RN-18)');
it('hides prices and discount controls when user is logged in as mechanic (RN-16)');
it('allows customer tracking lookup using only license plate and id number (RN-17)');
```

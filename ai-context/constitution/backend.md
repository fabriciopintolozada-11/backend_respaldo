# Reglas de backend — BE (Los Fratelli - Taller Mecánico)

Repo `backend` · NestJS + Prisma + PostgreSQL.

Requiere haber leído [00-general.md](00-general.md). Las reglas de idioma ([GEN-01](00-general.md#gen-01)), vocabulario ([GEN-02](00-general.md#gen-02)), reglas de negocio ([GEN-08](00-general.md#gen-08)) y supuestos ([GEN-09](00-general.md#gen-09)) aplican aquí sin repetirse.

---

## Stack

### BE-01
**Versiones del backend**

**MUST.** Verificadas contra npm en agosto de 2026.

| Paquete | Versión |
| --- | --- |
| `@nestjs/core`, `@nestjs/common` | 11.x |
| `@nestjs/cli` | 11.x |
| `prisma`, `@prisma/client` | 7.x |
| `@prisma/adapter-pg` | 7.x |
| `@nestjs/swagger` | 11.x |
| `class-validator` / `class-transformer` | 0.15.x / 0.5.x |
| `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt` | últimas compatibles con Nest 11 |
| TypeScript | 6.0.x — ver [GEN-05](00-general.md#gen-05) |

---

## Estructura de carpetas

### BE-02
**Feature-first: un módulo por área del taller, con sus capas dentro**

**MUST.** La estructura es esta y no se improvisa:

```text
src/
├── modules/
│   ├── work-orders/        # OTs, máquina de estados, asignación de bahías y mecánicos
│   │   ├── dto/
│   │   │   ├── create-work-order.dto.ts
│   │   │   ├── update-work-order-status.dto.ts
│   │   │   └── work-order-response.dto.ts
│   │   ├── repositories/
│   │   │   └── work-order.repository.ts
│   │   ├── work-orders.controller.ts
│   │   ├── work-orders.service.ts
│   │   └── work-orders.module.ts
│   ├── vehicles/           # Vehículos e historial técnico permanente (RN-19, RN-20)
│   ├── quotes/             # Presupuestos, aprobaciones y suspensiones (RN-02, RN-03)
│   ├── inventory/          # Repuestos, reservas, salidas y alertas de rotación (RN-07, RN-08, RN-10)
│   ├── warranties/         # Gestión de garantías y reingresos (RN-11, RN-12, RN-13)
│   ├── settlements/        # Cuentas de taller en BOB sin factura fiscal (RN-21, RN-22)
│   ├── users/              # Mecánicos, recepcionistas, jefe de taller y admin
│   └── auth/               # Autenticación interna y consulta pública de clientes (RN-17)
├── common/
│   ├── decorators/         # @Roles, @CurrentUser, @Public
│   ├── filters/            # Filtro global de excepciones
│   ├── guards/             # JwtAuthGuard, RolesGuard
│   ├── interceptors/
│   └── pipes/
├── config/                 # Configuración y validación de variables de entorno
├── prisma/
│   ├── prisma.service.ts
│   └── prisma.module.ts
├── generated/prisma/       # Cliente generado por Prisma (no se edita a mano)
├── app.module.ts
└── main.ts
```

Fuera de `src/`: `prisma/schema.prisma`, `prisma/migrations/` y `test/` para e2e.

### BE-03
**Un módulo por dominio funcional, no por tabla**

**SHOULD.** `work-orders` agrupa la orden de trabajo, la asignación de mecánicos y el tracking de bahías. `inventory` agrupa catálogo de repuestos, stock físico y reservas.

### BE-04
**Nomenclatura de archivos**

**MUST.** Usar `kebab-case` con sufijo de rol: `work-orders.controller.ts`, `work-orders.service.ts`, `work-order.repository.ts`, `create-work-order.dto.ts`, `roles.guard.ts`. Usar singular para la entidad (`vehicle.repository.ts`) y plural para el agrupador del módulo (`vehicles.service.ts`).

---

## Capas y Responsabilidades

### BE-05
**Dirección estricta de dependencias**

**MUST.** `controller → service → repository → Prisma`. Está prohibido saltarse capas o inyectar en sentido inverso.

| Capa | Responsabilidad | Prohibido |
| --- | --- | --- |
| Controller | Recibir HTTP, validar DTOs, delegar al service y retornar respuesta | Lógica de negocio e interacción con Prisma |
| Service | Orquestar reglas de negocio (RN-01 a RN-22) y transacciones | Conocer `Request`, `Response` o status HTTP |
| Repository | Consultas y persistencia en base de datos | Validaciones y reglas de negocio |

### BE-06
**El controller no contiene lógica de negocio**

**MUST.** El controller solo recibe, delega y devuelve. Toda regla, como validar si el vehículo es 100% eléctrico bajo **RN-18**, vive exclusivamente en el service.

```ts
// ✅
@Post()
create(@Body() dto: CreateWorkOrderDto): Promise<WorkOrderResponseDto> {
  return this.workOrdersService.create(dto);
}

// ❌ Lógica de negocio filtrada al controller
@Post()
async create(@Body() dto: CreateWorkOrderDto) {
  if (dto.propulsionType === PropulsionType.ELECTRIC) {
    throw new BadRequestException('RN-18: 100% electric vehicles are not accepted');
  }
  return this.prisma.workOrder.create({ data: dto });
}
```

### BE-07
**El service es agnóstico del protocolo HTTP**

**MUST.** Los services lanzan excepciones de dominio (`NotFoundException`, `ConflictException`, `UnprocessableEntityException`, `ForbiddenException`). El filtro global se encarga de traducirlas al cliente HTTP.

### BE-08
**Acceso a datos exclusivo mediante repositories**

**MUST.** `PrismaService` solo se inyecta en clases bajo `repositories/`. Un service que inyecte `PrismaService` directamente será motivo de rechazo del MR.

**Excepción:** métodos transaccionales complejos (BE-16) donde el service coordina repositorios pasándoles la instancia de transacción `Prisma.TransactionClient`.

### BE-09
**Los repositories exponen métodos con significado de dominio**

**SHOULD.** El repositorio expone operaciones semánticas (`findPendingApprovalsOlderThanDays(15)`, `findWithoutRotationSince(date)`, `findAssignedToMechanic(mechanicId)`), evitando exponer `findMany` genéricos que fuercen al service a construir cláusulas `where` de Prisma.

## DTOs y Validación

### BE-10
**Validación estricta con class-validator**

**MUST.** Todo payload entrante pasa por un DTO fuertemente tipado.

```ts
export class CreateWorkOrderDto {
  @IsString()
  @Length(6, 10)
  licensePlate: string;

  @IsString()
  @Length(3, 255)
  initialComplaint: string;

  @IsEnum(PropulsionType)
  propulsionType: PropulsionType; // RN-18 se valida en el service si es ELECTRIC
}
```

### BE-11
**ValidationPipe global estricto**

**MUST.** En `main.ts`:

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

### BE-12
**Separación estricta de DTOs y modelos de base de datos**

**MUST.** Existen tres representaciones desacopladas: DTO de entrada, modelo Prisma y DTO de respuesta.

**MUST.** La respuesta de una OT para un usuario con rol `MECHANIC` debe excluir u omitir los campos de costo y precio de repuestos y mano de obra, garantizando RN-16 desde el serializador o DTO de salida.

### BE-13
**Manejo monetario en BOB (RN-21) sin punto flotante**

**MUST.** Todos los importes en Bolivianos se almacenan como `Decimal` en Prisma o enteros en centavos. Está prohibido el uso de `Float`.

## Persistencia y Prisma 7

### BE-14
**Configuración de Prisma 7**

**MUST.** Configuración obligatoria en `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### BE-15
**PrismaService unificado**

**MUST.** Existirá un único `PrismaService`, gestionado por el ciclo de vida de Nest (`OnModuleInit`) dentro de `PrismaModule`. Está prohibido instanciar `new PrismaClient()` fuera de este servicio.

### BE-16
**Transacciones atómicas obligatorias para movimientos de stock y cambios de estado**

**MUST.** Las operaciones que involucran inventario y OTs deben ejecutarse dentro de `$transaction`:

- RN-07: reserva de repuestos al aprobarse un presupuesto.
- RN-08 / RN-09: verificación de OT aprobada, descuento de existencias físicas y confirmación de instalación por el mecánico asignado.
- RN-03: suspensión de OT y reversión a estado de presupuesto si aparecen fallas adicionales.

### BE-17
**Inmutabilidad del historial y trazabilidad (RN-19)**

**MUST.** Las tablas de historial de vehículos, cambios de estado de OTs y movimientos de repuestos son de solo inserción. Está prohibido el `DELETE` físico de registros de órdenes, servicios o vehículos.

### BE-18
**Borrado lógico para usuarios y catálogo**

**MUST.** Usuarios y repuestos del catálogo se desactivan (`isActive: false` o `deactivatedAt: DateTime`).

### BE-19
**Campos de auditoría inyectados por el backend**

**MUST.** `createdBy`, `assignedBy`, `voidedBy`, `approvedBy` y sus timestamps se obtienen exclusivamente del token JWT del usuario autenticado. Jamás se aceptan en el cuerpo del request.

### BE-20
**Migraciones versionadas**

**MUST.** Gestionar los esquemas mediante `npx prisma migrate dev --name <nombre_en_ingles>`. Está prohibido usar `prisma db push` en entornos compartidos.

### BE-21
**Convenciones del esquema e índices de rendimiento**

**MUST.** Usar modelos en PascalCase singular (`WorkOrder`, `Vehicle`, `SparePart`), campos en camelCase y tablas y columnas en snake_case mediante `@@map` y `@map`.

**MUST.** Crear índices en:

- `vehicles.license_plate`, para la búsqueda instantánea de RN-20 y la consulta pública de RN-17.
- `work_orders.vehicle_id` y `work_orders.status`, para alertas de 15 días de RN-06 y garantías de RN-11.
- `spare_parts.last_movement_at`, para la alerta de rotación de al menos 2 meses de RN-10.

## API y Seguridad

### BE-22
**Diseño RESTful en inglés**

**MUST.** Los recursos usan nombres plurales: `/api/v1/work-orders`, `/api/v1/vehicles`, `/api/v1/spare-parts`, `/api/v1/settlements`.

Acciones de dominio como sub-recursos:

- `POST /api/v1/work-orders/:id/assign-mechanic` (RN-14)
- `POST /api/v1/work-orders/:id/approve-quote` (RN-02)
- `POST /api/v1/work-orders/:id/consume-part` (RN-08)
- `GET /api/v1/public/vehicle-status` (RN-17: consulta pública sin autenticación con placa y documento)

### BE-23
**Códigos HTTP semánticos**

**MUST.** Usar `201` creado, `200` éxito, `204` sin contenido, `400` validación DTO, `401` no autenticado, `403` sin permiso según rol, `404` no encontrado, `409` conflicto de estado y `422` regla de negocio violada.

### BE-24
**Listados paginados**

**MUST.** Todo listado responde con `{ data, total, page, pageSize }`.

### BE-25
**Documentación OpenAPI / Swagger obligatoria**

**MUST.** Todo endpoint debe estar decorado con `@ApiOperation`, `@ApiResponse` y DTOs con `@ApiProperty` para permitir la generación de tipos en el frontend.

### BE-26
**Filtro global de excepciones**

**MUST.** Usar un `AllExceptionsFilter` unificado. Los códigos de error de Prisma (por ejemplo, `P2002` y `P2025`) se capturan y traducen a excepciones HTTP estándar sin exponer detalles internos de la base de datos.

### BE-27
**Autenticación JWT**

**MUST.** Los access tokens y refresh tokens se firman mediante Passport JWT. Las claves y los tiempos son configurables mediante variables de entorno.

### BE-28
**Contraseñas seguras**

**MUST.** Usar hashing mediante `argon2` o `bcrypt`. Los hashes nunca forman parte de los DTOs de salida.

### BE-29
**Autorización basada en roles (RBAC)**

**MUST.** Usar `JwtAuthGuard` global, exceptuando la ruta pública de clientes mediante `@Public()` para RN-17. Los permisos de `RECEPTIONIST`, `MECHANIC`, `WORKSHOP_LEAD` y `ADMIN` se controlan mediante `@Roles()` y `RolesGuard`.

- RN-04: el mecánico solo puede consultar o modificar sus OTs asignadas.
- RN-14 y RN-15: solo `WORKSHOP_LEAD` puede asignar OTs a mecánicos, fijar prioridades de bahías y aplicar descuentos o anulaciones a cuentas.

### BE-30
**Validación de configuración en el arranque**

**MUST.** Usar `@nestjs/config` con Joi o Zod. Si falta `DATABASE_URL` o `JWT_SECRET`, la aplicación detiene el bootstrap inmediatamente.

## Testing

### BE-31
**Testing unitario y end-to-end**

**MUST.** Los tests unitarios se escriben en Jest con repositorios mockeados para toda la lógica de negocio en services. Los tests e2e usan Supertest sobre una base de datos PostgreSQL de pruebas.

### BE-32
**Cobertura obligatoria de reglas de negocio en tests**

**MUST.** Cada una de las 22 reglas de negocio debe tener suites de prueba dedicadas, especialmente:

- RN-02 y RN-09: intento de consumo de repuestos sin presupuesto aprobado, que debe fallar con `422` o `403`.
- RN-08: reducción atómica de existencias físicas al confirmar el uso.
- RN-18: rechazo de registro de vehículos con propulsión 100% eléctrica.
- RN-11, RN-12 y RN-13: exención de cobro en reingresos de hasta 30 días y bloqueo de exención automática después de 30 días.

### BE-33
**Nomenclatura descriptiva de pruebas**

**SHOULD.** Usar nombres descriptivos en inglés, por ejemplo:

```ts
it('rejects vehicle registration when propulsion is 100% electric (RN-18)');
it('requires workshop lead authorization for warranty claim past 30 days (RN-13)');
```

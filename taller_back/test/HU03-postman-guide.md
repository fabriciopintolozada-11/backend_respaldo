# HU-03 — Ver_ordenes_asignadas — Guia de Prueba en Postman

## Pre-requisitos

1. PostgreSQL corriendo en `localhost:5432`
2. Migraciones aplicadas (`npx prisma migrate status`)
3. Seed ejecutado (`npm run prisma:seed`)
4. Backend levantado (`npm run start:dev` -> `http://localhost:3000`)
5. Postman instalado

## Datos de prueba (generados por el seed)

| Campo | Mecanico A | Mecanico B |
| --- | --- | --- |
| ID | `11111111-1111-1111-1111-111111111111` | `22222222-2222-2222-2222-222222222222` |
| OTs asignadas | 4 (EX0001, EX0004, EX0007, EX0010) | 3 (EX0002, EX0005, EX0008) |

---

## Paso 1 — Obtener el token JWT del Mecanico A

Como no hay endpoint de login, genera el token con un script rapido. Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
node -e "console.log(require('jsonwebtoken').sign({sub:'11111111-1111-1111-1111-111111111111',role:'MECHANIC'},'dev-only-secret-change-before-production-2026',{expiresIn:'1h'}))"
```

Copia el token que imprime. Vamos a llamarlo `<TOKEN_MECANICO>`.

---

## Paso 2 — Happy Path: Ver_ordenes_asignadas (lista)

### Request

| Campo | Valor |
| --- | --- |
| Method | `GET` |
| URL | `http://localhost:3000/api/v1/work-orders/assigned` |

### Query Params

| Param | Valor | Requerido |
| --- | --- | --- |
| page | `1` | No (default: 1) |
| pageSize | `20` | No (default: 20) |

### Headers

| Key | Value |
| --- | --- |
| Authorization | `Bearer <TOKEN_MECANICO>` |

### Respuesta esperada (200 OK)

```json
{
  "data": [
    {
      "id": "uuid-de-la-ot",
      "vehicleId": "uuid-del-vehiculo",
      "plate": "EX0001",
      "status": "ASIGNADA",
      "initialComplaint": "Revisión general de ejemplo 1",
      "assignedAt": "2026-08-25T14:00:00.000Z"
    }
  ],
  "total": 4,
  "page": 1,
  "pageSize": 20
}
```

### Que validar

- [ ] El `total` es 4 (solo las OTs del Mecanico A)
- [ ] Cada elemento tiene `id`, `vehicleId`, `plate`, `status`, `initialComplaint`, `assignedAt`
- [ ] NO aparecen campos de precio/costo (`price`, `cost`, `totalAmount`, `rate`)
- [ ] Si cambias el token por el del Mecanico B, el `total` cambia a 3 y los `id` son diferentes

---

## Paso 3 — Happy Path: Ver detalle de una OT asignada

### Request

| Campo | Valor |
| --- | --- |
| Method | `GET` |
| URL | `http://localhost:3000/api/v1/work-orders/assigned/{id}` |

Reemplaza `{id}` con el `id` de cualquiera de las OTs que devolvio el paso anterior. Por ejemplo: `5dab0f68-0bf6-49c7-8d58-ed7f3d2f148e`.

### Headers

| Key | Value |
| --- | --- |
| Authorization | `Bearer <TOKEN_MECANICO>` |

### Respuesta esperada (200 OK)

```json
{
  "id": "5dab0f68-0bf6-49c7-8d58-ed7f3d2f148e",
  "vehicleId": "uuid-del-vehiculo",
  "plate": "EX0001",
  "brand": "Toyota",
  "model": "Modelo 1",
  "year": 2015,
  "status": "ASIGNADA",
  "initialComplaint": "Revisión general de ejemplo 1",
  "assignedAt": "2026-08-25T14:00:00.000Z"
}
```

### Que validar

- [ ] El `id` coincide con el que consultaste
- [ ] `plate`, `brand`, `model`, `year` corresponden al vehiculo
- [ ] NO hay campos de precio/costo en la respuesta

---

## Escenarios adicionales (casos negativos)

### 401 — Sin token

| Campo | Valor |
| --- | --- |
| Method | `GET` |
| URL | `http://localhost:3000/api/v1/work-orders/assigned` |
| Headers | (vacio, sin Authorization) |

**Resultado:** `401 Unauthorized`

### 403 — Rol incorrecto (recepcionista intenta ver sus asignaciones)

Genera un token con rol RECEPTIONIST:

```bash
node -e "console.log(require('jsonwebtoken').sign({sub:'00000000-0000-0000-0000-000000000010',role:'RECEPTIONIST'},'dev-only-secret-change-before-production-2026',{expiresIn:'1h'}))"
```

| Campo | Valor |
| --- | --- |
| Method | `GET` |
| URL | `http://localhost:3000/api/v1/work-orders/assigned` |
| Headers | `Authorization: Bearer <TOKEN_RECEPCIONISTA>` |

**Resultado:** `403 Forbidden`

### 404 — Consultar OT que pertenece a otro mecanico

Usa el token del Mecanico A pero consulta una OT del Mecanico B (por ejemplo `b35cafc8-7d6c-4b93-ad69-e6a4e7d79a14`):

| Campo | Valor |
| --- | --- |
| Method | `GET` |
| URL | `http://localhost:3000/api/v1/work-orders/assigned/b35cafc8-7d6c-4b93-ad69-e6a4e7d79a14` |
| Headers | `Authorization: Bearer <TOKEN_MECANICO_A>` |

**Resultado:** `404 Not Found`

### 400 — UUID invalido

| Campo | Valor |
| --- | --- |
| Method | `GET` |
| URL | `http://localhost:3000/api/v1/work-orders/assigned/no-es-uuid` |
| Headers | `Authorization: Bearer <TOKEN_MECANICO>` |

**Resultado:** `400 Bad Request`

---

## Resumen de endpoints HU-03

| Escenario | Method | URL | Auth | Rol | Status esperado |
| --- | --- | --- | --- | --- | --- |
| Lista asignadas | GET | `/api/v1/work-orders/assigned` | JWT | MECHANIC | 200 |
| Detalle OT | GET | `/api/v1/work-orders/assigned/:id` | JWT | MECHANIC | 200 |
| Sin token | GET | `/api/v1/work-orders/assigned` | - | - | 401 |
| Rol incorrecto | GET | `/api/v1/work-orders/assigned` | JWT | RECEPTIONIST | 403 |
| OT de otro mecanico | GET | `/api/v1/work-orders/assigned/:id` | JWT | MECHANIC | 404 |
| UUID invalido | GET | `/api/v1/work-orders/assigned/no-es-uuid` | JWT | MECHANIC | 400 |

---

## Swagger (alternativa)

Toda la documentacion interactiva esta disponible en: `http://localhost:3000/api`

Desde ahi puedes probar todos los endpoints sin configurar nada manualmente.

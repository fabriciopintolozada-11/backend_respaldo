# taller_back

Backend del taller mecanico Los Fratelli basado en NestJS, Prisma y PostgreSQL 18.

## HU-01

La HU-01 fue refactorizada a una arquitectura **Feature-First** dentro de `src/modules/work-orders`, con controllers, services, repositories y DTOs agrupados por dominio.

El esquema de Prisma fue ajustado para PostgreSQL 18, usando nombres `snake_case` mediante `@map` y `@@map`, ademas de los indices requeridos para busquedas de vehiculos y ordenes de trabajo.

### Base de datos local

Desde `C:\Users\HP\pids\tools`, levantar PostgreSQL con Docker:

```bash
docker compose up -d
```

La base queda disponible en el puerto `5454` del host:


## Desarrollo

```bash
npm install
npm run prisma:generate
npm run test
```

<<<<<<< HEAD
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

```env
DATABASE_URL=postgresql://pdis:pdis_dev_password@localhost:5454/pdis
```

## Desarrollo

```bash
npm install
npm run prisma:generate
npm run test
```
=======
# Fratelli - Respaldo

Repositorio de respaldo del proyecto La Fratelli. Está dividido en cuatro directorios:

- `ai-context/` — Contexto del proyecto, backlog, constitution, preguntas y respuestas del cliente.
- `tools/` — Herramientas de soporte (docker-compose y documentación).
- `taller_back/` — Backend del taller (NestJS + Prisma).
- `taller_front/` — Frontend del taller (Vue/Vite).

> Nota: los archivos `.env` (credenciales) no se incluyen en este respaldo. Usa los `.env.example` como plantilla.
>>>>>>> 47583de9db789762dc7a13ec2fedacd06dbb5871

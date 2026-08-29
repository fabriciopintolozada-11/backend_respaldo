# Taller Mecánico "Los Fratelli" — Frontend

SPA de gestión integral para taller mecánico: recepción, consulta pública, asignación, consola del mecánico, inventario, presupuestos, liquidaciones y portal cliente.

## Ejecutar Localmente

**Prerrequisitos:** Node.js 18+

1. Instala dependencias: `npm install`
2. Copia `.env.example` a `.env`.
3. Para integración con NestJS, configura `VITE_API_TOKEN` con un JWT válido y ejecuta `npm run dev`.
4. Para trabajar sin backend, configura `VITE_DATA_SOURCE=mock` y ejecuta `npm run dev:full`.

La API integrada usa `http://localhost:3000/api/v1`; el portal público no requiere token.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Iniciar en modo desarrollo (puerto 5173) |
| `npm run dev:full` | Iniciar con mock API en paralelo |
| `npm run build` | Compilar para producción |
| `npm run lint` | Verificar tipos TypeScript |

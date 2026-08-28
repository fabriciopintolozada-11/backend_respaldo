# Reglas de tools — TL (Los Fratelli - Taller Mecánico)

Repo `tools` · infraestructura local, configuración compartida y scripts de datos.

Requiere haber leído [00-general.md](00-general.md).

**Qué NO es este repo:** no es un paquete de contratos ni de tipos compartidos. El frontend deriva sus tipos del OpenAPI expuesto por el backend ([FE-02](frontend.md#fe-02)); por tanto, aquí no vive nada que `backend` o `frontend` tengan que importar en tiempo de ejecución.

---

## Alcance

### TL-01
**Tres responsabilidades y ninguna más**

**MUST.** En `tools` vive:

1. **Infraestructura local:** `docker-compose.yml`, datos semilla realistas y scripts de arranque y reseteo.
2. **Configuración compartida:** bases de ESLint, Prettier y TypeScript, y la plantilla de CI de GitLab.
3. **Scripts de datos:** migración o carga inicial de repuestos e historial técnico y utilidades operativas.

**MUST.** No debe contener lógica de negocio. Si un script necesita validar reglas del dominio, como no admitir vehículos 100% eléctricos bajo RN-18, esas reglas residen en el backend y el script consume los endpoints de la API.

### TL-02
**Estructura del repositorio**

**MUST.** La estructura es:

```text
docker/
└── docker-compose.yml
postgres/
config/
├── eslint.base.js
├── prettier.config.js
└── tsconfig.base.json
ci/
└── gitlab-ci.template.yml
scripts/
├── seed/            # Datos semilla de taller, mecánicos, bahías, repuestos y OTs
└── migration/       # Carga inicial de inventario e historial
README.md            # Guía para levantar el entorno en menos de cinco minutos
```

---

## Entorno local

### TL-03
**PostgreSQL en Docker con versión fijada**

**MUST.** `docker-compose.yml` usa una imagen fija de PostgreSQL (`postgres:17`, nunca `postgres:latest`) y un volumen persistente con nombre.

Fijar la versión evita discrepancias de comportamiento entre entornos y asegura compatibilidad con las extensiones y tipos relacionales usados por Prisma 7.

### TL-04
**Levantar el entorno en tres comandos o menos**

**MUST.** El `README.md` debe detallar el paso a paso exacto para dejar el entorno funcional, con base de datos levantada, migraciones ejecutadas y seed cargado, en un máximo de tres comandos:

```bash
docker compose -f docker/docker-compose.yml up -d
npm run db:migrate
npm run db:seed
```

### TL-05
**Datos semilla realistas basados en la operación de Los Fratelli**

**MUST.** El seed simula la escala operativa real del taller:

- Personal: 5 mecánicos, 1 jefe de taller, recepcionistas y administradores con roles asignados.
- Instalaciones: las 4 bahías de trabajo numeradas.
- Inventario: catálogo de aproximadamente 300 repuestos con precios en BOB (RN-21), niveles de stock y fechas de rotación variadas, incluyendo casos de al menos 2 meses para validar RN-10.
- Vehículos y OTs: vehículos livianos con historial previo (RN-19, RN-20), órdenes en distintos estados y casos de garantía dentro y fuera de 30 días para validar RN-11, RN-12 y RN-13.

**MUST.** El seed es idempotente: ejecutarlo varias veces no duplica registros ni corrompe llaves primarias o foráneas.

### TL-06
**El seed respeta las reglas de negocio del taller**

**MUST.** La creación de datos semilla no inserta saldos de inventario ni estados de OTs arbitrarios:

- Ningún repuesto se asigna a una orden sin presupuesto aprobado (RN-02, RN-09).
- La confirmación de repuestos descuenta existencias reales del almacén (RN-08).
- No se generan vehículos con propulsión 100% eléctrica (RN-18).
- Todos los montos se expresan en Bolivianos (BOB) (RN-21).

## Configuración compartida

### TL-07
**Bases estandarizadas de ESLint, Prettier y TypeScript**

**MUST.** `backend` y `frontend` extienden las configuraciones base alojadas en `config/`.

**SHOULD.** Cada proyecto documenta en su README la referencia de versión de estas configuraciones para evitar divergencias de formato que ensucien los diffs de los MR.

### TL-08
**Reglas de linter críticas activas**

**MUST.** La configuración base exige como error:

- `@typescript-eslint/no-explicit-any: error` (GEN-05).
- `@typescript-eslint/no-floating-promises: error`.
- `no-unused-vars: error`.
- Ordenamiento estricto de imports.

## Integración Continua (CI)

### TL-09
**Pipeline de CI con tres etapas obligatorias**

**MUST.** `ci/gitlab-ci.template.yml` se estructura en `lint → test → build`. Se ejecuta en cada push a cualquier rama y al abrir todo MR.

**MUST.** El pipeline falla ante cualquier test fallido o advertencia de linter no resuelta.

### TL-10
**Entorno de ejecución homologado con Node 24 LTS**

**MUST.** Las imágenes de los runners de GitLab CI usan Node.js 24 LTS y npm 11.x (GEN-03).

### TL-11
**Base de datos efímera para pruebas e2e en CI**

**SHOULD.** El pipeline aprovisiona un servicio efímero de PostgreSQL durante la etapa de pruebas para ejecutar migraciones y suites e2e (BE-31), verificando concurrencia y restricciones relacionales reales.

## Scripts y Gestión de Datos

### TL-12
**Simulación previa para scripts de carga (`--dry-run`)**

**MUST.** Todo script que importe inventario inicial o registros históricos incluye el flag `--dry-run` para validar formatos y tipos sin persistir cambios en la base de datos.

### TL-13
**Trazabilidad y reporte detallado de importaciones**

**MUST.** Al finalizar un script de datos se imprime un resumen con:

- Total de registros leídos.
- Registros insertados o actualizados con éxito.
- Registros omitidos o con errores de validación, indicando fila y motivo.

### TL-14
**Protección y anonimización de datos de clientes**

**MUST.** Está prohibido versionar planillas o volcados con información real de clientes, incluidos nombres, DNIs, teléfonos o placas auténticas. Los scripts operan sobre datos de prueba o plantillas ficticias y anonimizadas.

# Medusa Norkut

E-commerce construido sobre **Medusa v2** y **Next.js**, pensado para operar en el mercado
venezolano. Este repositorio es el espacio de trabajo del proyecto: aquí viven el backend
(API + admin), el storefront, los módulos de pago/envío y las personalizaciones locales.

> Base: [`medusajs/dtc-starter`](https://github.com/medusajs/dtc-starter) con Medusa `2.22.6`.
> El monorepo del framework (`medusajs/medusa`) es un repositorio distinto y no se toca desde aquí.

---

## Qué incluye

- **Backend Medusa** (`apps/backend`): API REST, motor de workflows, módulos de comercio y
  dashboard de administración.
- **Storefront Next.js** (`apps/storefront`): catálogo, carrito, checkout, cuenta de cliente e
  historial de pedidos.
- **Seed inicial**: tienda, canal de ventas, publishable key, región, impuestos, bodega, envíos,
  categorías y productos de demostración.
- **Base para Venezuela**: país `ve`, región `Venezuela`, monedas `usd`/`ves`, almacén en Caracas.
  El detalle y el roadmap están en [`GUIA-VENEZUELA.md`](./GUIA-VENEZUELA.md).

| Componente | Puerto |
| --- | --- |
| Storefront | `http://localhost:8000/ve` |
| API Medusa | `http://localhost:9000` |
| Admin | `http://localhost:9000/app` |
| PostgreSQL | `localhost:5432` |

---

## Requisitos

| Herramienta | Versión | Nota |
| --- | --- | --- |
| Node.js | `>= 22.22` (recomendado 24 LTS) | El storefront Next.js no soporta Node 26 |
| pnpm | `10.11.1` | Se activa con Corepack |
| PostgreSQL | `>= 15` (recomendado 16) | Docker es la vía más simple |
| Git | cualquiera reciente | |

### Node y pnpm

```powershell
nvm install 24
nvm use 24
corepack enable pnpm
corepack prepare pnpm@10.11.1 --activate
```

> Cada cambio de versión de Node elimina el shim de pnpm/yarn. Si `pnpm` deja de existir:
> `corepack enable pnpm`.

### PostgreSQL con Docker

```powershell
docker run -d --name medusa-postgres `
  -e POSTGRES_USER=medusa `
  -e POSTGRES_PASSWORD=medusa `
  -e POSTGRES_DB=medusa_norkut `
  -p 5432:5432 `
  -v medusa_norkut_pgdata:/var/lib/postgresql/data `
  --restart unless-stopped `
  postgres:16-alpine
```

---

## Puesta en marcha

### 1. Dependencias

```powershell
pnpm install
```

### 2. Variables de entorno del backend

Crea `apps/backend/.env` a partir de `apps/backend/.env.template`:

```dotenv
STORE_CORS=http://localhost:8000,https://docs.medusajs.com
ADMIN_CORS=http://localhost:5173,http://localhost:9000,https://docs.medusajs.com
AUTH_CORS=http://localhost:5173,http://localhost:9000,https://docs.medusajs.com
JWT_SECRET=<cadena-aleatoria-larga>
COOKIE_SECRET=<otra-cadena-aleatoria>
DATABASE_URL=postgres://medusa:medusa@localhost:5432/medusa_norkut
DB_NAME=medusa_norkut
```

Genera los secretos, por ejemplo:

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_})
```

`REDIS_URL` es opcional en desarrollo: sin ella Medusa usa un motor de workflows en memoria.
En producción con varios procesos sí es necesaria (`@medusajs/workflow-engine-redis`).

### 3. Migraciones y datos iniciales

```powershell
cd apps/backend
pnpm medusa db:migrate
```

Crea el esquema y ejecuta los scripts de `src/migration-scripts/`, que siembran la tienda,
la región, los impuestos, la bodega, las opciones de envío y el catálogo demo.

### 4. Usuario administrador

```powershell
cd apps/backend
pnpm medusa user -e admin@norkut.local -p "TuPasswordSegura123!"
```

### 5. Backend

```powershell
cd apps/backend
pnpm dev
```

Abre `http://localhost:9000/app`, inicia sesión y copia la **publishable API key** desde
**Settings > Publishable API Key**.

### 6. Storefront

Crea `apps/storefront/.env.local` a partir de `apps/storefront/.env.template`:

```dotenv
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_DEFAULT_REGION=ve
NEXT_PUBLIC_BASE_URL=http://localhost:8000
NODE_ENV=development
```

```powershell
cd apps/storefront
pnpm dev
```

Storefront en `http://localhost:8000/ve`.

> El home lista productos **por colección**. Si aparece vacío, crea una colección en
> **Products > Collections**, asígnale productos o usa la colección `Destacados`.

### 7. Levantar todo junto

```powershell
pnpm dev        # turbo: backend + storefront
```

### 8. Demo funcional (admin → ecommerce)

Crea un producto publicado, con precio, inventario y colección, y prueba el
flujo completo hasta la orden en el admin:

```powershell
cd apps/backend
pnpm exec medusa exec ./src/scripts/seed-demo-product.ts
```

Producto: `Producto Demo Norkut` → `http://localhost:8000/ve/products/producto-demo-norkut`.
El detalle del flujo y dónde agregar lógica de negocio está en [`DEMO.md`](./DEMO.md).

---

## Comandos habituales

```powershell
pnpm install                 # instalar dependencias
pnpm dev                     # backend + storefront
pnpm build                   # build de producción
pnpm lint                    # lint del monorepo

cd apps/backend
pnpm medusa db:migrate       # migraciones + seed
pnpm medusa user -e a@b.co -p "clave"
pnpm medusa develop          # solo backend en modo dev
pnpm medusa build            # build del backend
pnpm medusa start            # backend compilado

cd apps/storefront
pnpm dev                     # solo storefront
pnpm build                   # build de Next
```

Docker:

```powershell
docker start medusa-postgres
docker stop medusa-postgres
docker logs -f medusa-postgres
```

---

## Estructura

```text
apps/
├── backend/
│   ├── src/api/                # rutas HTTP custom
│   ├── src/modules/            # módulos custom (pagos, envíos, etc.)
│   ├── src/workflows/          # workflows y steps
│   ├── src/links/              # module links
│   ├── src/subscribers/        # eventos del sistema
│   ├── src/jobs/               # tareas programadas (ej. tasa BCV)
│   ├── src/admin/              # extensiones del dashboard
│   └── src/migration-scripts/  # seed y scripts de datos
└── storefront/
    └── src/
        ├── app/[countryCode]/  # rutas por país
        ├── modules/            # componentes por dominio
        └── lib/data/           # acceso a la Store API
```

---

## Adaptación a Venezuela

Estado actual y siguientes pasos en [`GUIA-VENEZUELA.md`](./GUIA-VENEZUELA.md).

Resumen:

- [x] Región `Venezuela`, país `ve`, monedas `usd` (base) + `ves`
- [x] Almacén y zona de envío en Caracas/Venezuela
- [ ] IVA 16% como tasa por defecto
- [ ] Métodos de pago locales (Pago Móvil, transferencia, Zelle, USDT) sobre el proveedor `system`
- [ ] Tarifas de envío por estado (Zoom, MRW, Liberty Express)
- [ ] Cédula/RIF y validación de teléfono `+58`
- [ ] Job diario de tasa BCV para precios en VES
- [ ] Integración fiscal (SENIAT) en `order.placed`

---

## Problemas comunes

| Síntoma | Solución |
| --- | --- |
| `pnpm`/`yarn` no existe | `corepack enable pnpm` |
| `ECONNREFUSED 5432` | `docker start medusa-postgres` |
| `EADDRINUSE :9000` / `:8000` | `Get-NetTCPConnection -LocalPort 9000` y terminar el PID |
| Home sin productos | crear una colección y asignarle productos |
| Build roto por `EPERM` | el proyecto debe vivir fuera de OneDrive |
| `path too long` | `git config --system core.longpaths true` |

---

## Documentación

- Medusa: <https://docs.medusajs.com>
- Instalación: <https://docs.medusajs.com/learn/installation.md>
- Módulos: <https://docs.medusajs.com/learn/fundamentals/modules.md>
- Workflows: <https://docs.medusajs.com/learn/fundamentals/workflows.md>
- Payment providers: <https://docs.medusajs.com/resources/commerce-modules/payment/payment-provider.md>
- Índice para LLMs: <https://docs.medusajs.com/llms.txt>

---

## Convenciones

- Ramas por tipo: `feat/`, `fix/`, `chore/`, `docs/`.
- Nunca commitear `.env`, `.env.local` ni secretos. Solo se versionan los `.env.template`.
- Cambios de esquema en módulos: generar migración con la CLI del módulo, no a mano.

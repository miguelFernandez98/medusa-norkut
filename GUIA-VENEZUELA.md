# Guía: levantar una tienda Medusa adaptada al mercado venezolano

Documento de trabajo del proyecto. Explica qué se instaló, cómo levantarlo todos los días,
cómo publicarlo en tu propio repositorio y qué hay que adaptar para Venezuela.

---

## ESTADO ACTUAL (verificado)

Todo está levantado y funcionando en esta máquina.

| Servicio | URL | Estado |
| --- | --- | --- |
| Storefront | <http://localhost:8000/ve> | 200 |
| Medusa API | <http://localhost:9000> | `/health` = OK |
| Admin | <http://localhost:9000/app> | 200 |
| PostgreSQL | `localhost:5432` (contenedor `medusa-postgres`) | 16.15 |

Credenciales y datos generados:

| Dato | Valor |
| --- | --- |
| Admin | `admin@tienda.local` / contraseña definida en 5.2 |
| Región | `Venezuela`, moneda `usd`, país `ve` (`reg_01M731751Q8955F8NVZXGS93NZ`) |
| Monedas del store | `usd` (base) y `ves` |
| Publishable key | `pk_23a96d4761b13fb8c36d03f5d24c5110b9e65c37632231073d112fb3e394e82d` |
| Colección home | `Destacados` (`/ve/collections/destacados`) con los 4 productos demo |

Prueba rápida de que todo está vivo:

```powershell
Invoke-RestMethod http://localhost:9000/health
docker ps --filter name=medusa-postgres --format "{{.Names}} {{.Status}}"
```

### Arrancar / apagar todos los días

```powershell
# 1. Base de datos
docker start medusa-postgres

# 2. Backend + storefront (dos terminales, o una sola con el comando de abajo)
cd C:\dev\tienda-ve
pnpm dev
```

Si `pnpm dev` desde la raíz falla, levanta cada app por separado:

```powershell
cd C:\dev\tienda-ve\apps\backend;    pnpm dev   # :9000
cd C:\dev\tienda-ve\apps\storefront; pnpm dev   # :8000
```

Para apagar: `Ctrl + C` en cada terminal y `docker stop medusa-postgres` si no lo necesitas.

### Avisos que NO son errores

- `GET /store/locales 404`: el starter consulta el módulo de traducciones, que no está
  instalado. Es opcional; se silencia instalando `@medusajs/translation`.
- `Image ... quality "50" ... qualities [75]`: warning cosmético de Next. Se corrige agregando
  `50` a `images.qualities` en `apps/storefront/next.config.js`.
- `The "middleware" file convention is deprecated`: Next 16 sugiere renombrar a `proxy`.
- `redisUrl not found. A fake redis instance will be used` y `Local Event Bus installed`:
  esperado en desarrollo sin Redis.

---

## 0. Lo primero: el fork correcto

Hay dos repositorios distintos y conviene no mezclarlos:

| Repositorio | Qué es | Para qué sirve |
| --- | --- | --- |
| `medusajs/medusa` (el monorepo que tienes clonado) | Código fuente del framework: 35+ paquetes (`core/*`, `modules/*`, `admin/*`, `cli/*`) | Solo si vas a modificar el core de Medusa o contribuir al framework |
| Tu proyecto (este repo, basado en `medusajs/dtc-starter`) | Aplicación de e-commerce real: backend Medusa + admin + storefront Next.js | Aquí vive tu tienda, tus módulos, tus pagos, tus envíos |

**Regla práctica:** una tienda no se construye dentro del monorepo del framework. Se construye en
un proyecto que consume `@medusajs/*` como dependencias. Por eso:

- `C:\Users\migue\OneDrive\Documents\GitHub\medusa` queda intacto como referencia del framework.
- `C:\dev\tienda-ve` es tu proyecto, y ese es el que haces fork/push a tu cuenta de GitHub.

Si en el futuro necesitas parchar el core, ese es el único caso donde tiene sentido forkear
`medusajs/medusa` y enlazarlo con `resolutions`/`overrides` o publicando tu propio paquete.

### Por qué el proyecto NO está dentro de OneDrive

Yarn/pnpm crean decenas de miles de archivos con hardlinks en `node_modules`. OneDrive intenta
sincronizarlos y produce `EPERM`, archivos bloqueados, builds que fallan de forma aleatoria y
consumo de CPU constante. Por eso el proyecto vive en `C:\dev\tienda-ve`.
GitHub Desktop / `gh` / `git` funcionan igual desde cualquier ruta.

---

## 1. Prerrequisitos (lo que ya quedó instalado)

| Componente | Versión | Nota |
| --- | --- | --- |
| Node.js | 24.22.2 (LTS) | Instalado con nvm-windows. Medusa pide >= 22.22.0; el storefront Next.js pide <= 24 LTS |
| nvm-windows | 1.2.2 | `nvm use 24.22.2` / `nvm use 26.4.0` |
| pnpm | 10.11.1 | vía Corepack, fijado por el `packageManager` del proyecto |
| Docker Desktop | 29.8.1 | contenedor de PostgreSQL |
| PostgreSQL | 16.15 (contenedor `medusa-postgres`) | puerto `5432` |
| Git | 2.54.0 | |
| GitHub CLI | 2.97.0 | para crear el repo remoto |

### 1.1 Cambiar de versión de Node

```powershell
nvm list
nvm use 24.22.2   # recomendado para este proyecto
```

Cada vez que cambies de versión de Node hay que re-habilitar Corepack, porque el shim de
`pnpm`/`yarn` vive dentro de la instalación de Node:

```powershell
corepack enable pnpm
```

### 1.2 PostgreSQL en Docker

El contenedor ya está creado y configurado con `--restart unless-stopped`:

```powershell
docker run -d --name medusa-postgres `
  -e POSTGRES_USER=medusa `
  -e POSTGRES_PASSWORD=medusa `
  -e POSTGRES_DB=medusa_norkut `
  -p 5432:5432 `
  -v medusa_pgdata:/var/lib/postgresql/data `
  --restart unless-stopped `
  postgres:16-alpine
```

Verificar que está arriba:

```powershell
docker ps --filter name=medusa-postgres
docker exec medusa-postgres psql -U medusa -d medusa_norkut -c "select 1;"
```

Comandos útiles:

```powershell
docker stop medusa-postgres      # apagar
docker start medusa-postgres     # encender
docker logs -f medusa-postgres   # ver logs
```

> No borres el volumen `medusa_pgdata`: ahí están tus datos. Si necesitas empezar de cero,
> `docker rm -f medusa-postgres` y `docker volume rm medusa_pgdata` (esto borra todo).

---

## 2. Estructura del proyecto

```text
C:\dev\tienda-ve\
├── apps\
│   ├── backend\      # Medusa: API en :9000, admin en :9000/app
│   │   ├── src\api\          # rutas HTTP custom
│   │   ├── src\modules\      # módulos custom (pagos, envíos, etc.)
│   │   ├── src\workflows\    # workflows y steps
│   │   ├── src\links\        # module links
│   │   ├── src\subscribers\  # eventos
│   │   ├── src\jobs\         # tareas programadas (ej. actualizar tasa BCV)
│   │   └── src\migration-scripts\  # seed inicial
│   └── storefront\   # Next.js en :8000
├── package.json      # scripts turbo del monorepo (pnpm)
└── pnpm-workspace.yaml
```

---

## 3. Variables de entorno

### 3.1 Backend: `apps/backend/.env`

Ya está creado. Contenido:

```dotenv
STORE_CORS=http://localhost:8000,https://docs.medusajs.com
ADMIN_CORS=http://localhost:5173,http://localhost:9000,https://docs.medusajs.com
AUTH_CORS=http://localhost:5173,http://localhost:9000,https://docs.medusajs.com
JWT_SECRET=<aleatorio>
COOKIE_SECRET=<aleatorio>
DATABASE_URL=postgres://medusa:medusa@localhost:5432/medusa_norkut
DB_NAME=medusa_norkut
```

- `JWT_SECRET` y `COOKIE_SECRET` deben ser distintos en producción y no se commitean.
- No se configuró `REDIS_URL`: sin ella Medusa usa el motor de workflows en memoria, que es
  válido para desarrollo. En producción (varios procesos) sí necesitas Redis y el módulo
  `@medusajs/workflow-engine-redis`.
- `.env` está en `.gitignore`; nunca lo subas.

### 3.2 Storefront: `apps/storefront/.env.local`

```dotenv
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=      # se llena en el paso 5.3
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_DEFAULT_REGION=ve
NEXT_PUBLIC_BASE_URL=http://localhost:8000
NODE_ENV=development
```

`NEXT_PUBLIC_DEFAULT_REGION` se cambió de `dk` a `ve` (el valor por defecto del starter es
Dinamarca). Si aún no existe la región `ve`, el storefront falla al cargar el país.

---

## 4. Instalación de dependencias

```powershell
cd C:\dev\tienda-ve
pnpm install
```

Si se interrumpe, se puede volver a lanzar: pnpm reutiliza lo descargado (store global en
`%LOCALAPPDATA%\pnpm\store`).

---

## 5. Puesta en marcha (primera vez)

### 5.1 Migraciones + seed inicial

```powershell
cd C:\dev\tienda-ve\apps\backend
pnpm medusa db:migrate
```

Esto crea el esquema y ejecuta `src/migration-scripts/initial-data-seed.ts`, que deja listos:
store, sales channel, publishable API key, región, impuestos, bodega, opciones de envío,
categorías y productos de demo.

### 5.2 Usuario administrador

```powershell
pnpm medusa user -e admin@tienda.local -p "TuPasswordSegura123!"
```

Cambia el correo y la contraseña. Se puede crear otro usuario después desde el admin.

### 5.3 Levantar el backend

```powershell
pnpm dev
```

- API: <http://localhost:9000>
- Admin: <http://localhost:9000/app>

Entra al admin y ve a **Settings > Publishable API Key**. Copia la key `pk_...` en
`apps/storefront/.env.local` (`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`).

### 5.4 Levantar el storefront

```powershell
cd C:\dev\tienda-ve\apps\storefront
pnpm dev
```

Storefront: <http://localhost:8000>

> El home lista productos **por colección**, no por categoría. Si el home sale vacío, crea una
> colección en el admin (**Products > Collections**) y asígnale productos, o usa la colección
> `Destacados` que ya quedó creada. Las páginas `/ve/store`, `/ve/categories/<handle>` y
> `/ve/collections/<handle>` sí listan por categoría/colección directamente.

### 5.5 Levantar todo junto

```powershell
cd C:\dev\tienda-ve
pnpm dev        # turbo levanta backend + storefront
```

Detener con `Ctrl + C`.

---

## 6. Publicar en TU repositorio de GitHub

El repo clonado apunta a `medusajs/dtc-starter`. Lo correcto es:

```powershell
cd C:\dev\tienda-ve

# 1) Quitar el remoto del template
git remote rename origin template
git remote set-url --push template DISABLED   # evita pushes accidentales al template

# 2) Crear tu repo y subir
gh auth status
gh repo create medusa-norkut --private --source=. --remote=origin --push
```

Si prefieres que sea derivado explícitamente del starter (aparece el badge "forked from"):

```powershell
gh repo fork medusajs/dtc-starter --clone=false --remote=false
# luego, en tu repo:
git remote add upstream https://github.com/medusajs/dtc-starter.git
git remote add origin https://github.com/<tu-usuario>/<tu-repo>.git
git push -u origin main
```

Flujo diario recomendado:

```powershell
git checkout -b feat/region-venezuela
# ... cambios ...
git add -A
git commit -m "feat: region Venezuela, IVA 16% y metodos de pago locales"
git push -u origin feat/region-venezuela
```

Branches por tipo: `feat/`, `fix/`, `chore/`, `docs/`.

---

## 7. Adaptación al mercado venezolano

Orden recomendado: primero región/moneda/impuestos, luego pagos, luego envíos, y al final
facturación y contenido.

### 7.1 Región, país y moneda

En `apps/backend/src/migration-scripts/initial-data-seed.ts` el seed viene con Europa:

```ts
const countries = ["gb", "de", "dk", "se", "fr", "es", "it"];
```

y una región `"Europe"` con `currency_code: "eur"`.

Para Venezuela:

```ts
const countries = ["ve"];
```

y en `createRegionsWorkflow`:

```ts
{
  name: "Venezuela",
  currency_code: "ves",       // o "usd" si vas a cobrar en divisas
  countries,
  payment_providers: ["pp_system_default"],
  metadata: DEFAULT_REGION_STORE_POLICIES,
}
```

Y en `supported_currencies` del store, deja al menos `ves` y `usd`.

**Decisión importante sobre la moneda.** El bolívar se devalúa y la tasa BCV cambia a diario.
Dos estrategias válidas:

1. **Precios base en USD, región VE en VES** con *price lists* actualizadas a diario por un
   `src/jobs/` que consulte la tasa BCV y regenere los precios. Es lo más cercano a cómo venden
   muchas tiendas venezolanas.
2. **Cobrar en USD** y mostrar el equivalente en VES solo como referencia visual en el storefront.

No hardcodees la tasa: Medusa calcula precios con lo que tengas en `price`/`price_list`. El
storefront no convierte monedas por sí solo.

> Al cambiar el seed, si ya corriste `db:migrate`, la forma limpia de re-sembrar es recrear la
> base (`docker rm -f medusa-postgres` + volumen) o escribir un script de migración de datos.
> En desarrollo, recrear suele ser lo más rápido.

### 7.2 Impuestos

- **IVA general: 16%** (verifica la alícuota vigente y las exenciones con tu contador; hay
  alícuotas reducidas y bienes exentos).
- En el admin: **Settings > Tax Regions > Venezuela > Create** una tasa por defecto `IVA 16%`
  con `rate: 16`. También se puede sembrar con `createTaxRegionsWorkflow` + `createTaxRatesWorkflow`.
- Los precios de Medusa pueden ser *tax inclusive* o *tax exclusive* por región; define cuál
  usas antes de cargar el catálogo (`is_tax_inclusive` en el precio). Para retail en Venezuela
  lo normal es mostrar el precio con IVA incluido.
- **IGTF (3%)**: es un impuesto sobre pagos en divisas, no un impuesto de producto. Medusa no
  tiene un hook nativo "por método de pago", así que se implementa como:
  - una línea adicional calculada en un *workflow* de checkout, o
  - una opción de envío/promoción específica para pagos en divisa, o
  - un registro contable posterior (lo más simple y auditable).
  Elige una y documéntala; no lo mezcles con el IVA.

### 7.3 Métodos de pago

El seed ya trae `pp_system_default`, el proveedor **system**: no procesa pagos, actúa como
*contra entrega* y deja la confirmación en manos del comercio. Con eso ya puedes vender con:

- Pago Móvil
- Transferencia bancaria (BDV, Banesco, Mercantil, Provincial...)
- Zelle
- Binance Pay / USDT
- Efectivo contra entrega

Flujo: el cliente elige el método, la orden queda `pending`, subes/compartes los datos de pago,
y el admin marca el pago como capturado al verificarlo.

Para algo más automático hay que escribir un **payment provider** propio: un módulo cuyo
servicio extienda `AbstractPaymentProvider` de `@medusajs/framework/utils`, registrado en
`medusa-config.ts` dentro de las `providers` del módulo de pagos, y luego habilitado por región.
Docs: `https://docs.medusajs.com/resources/references/payment/provider` y
`https://docs.medusajs.com/resources/commerce-modules/payment/payment-provider.md`.

Notas de realidad del mercado:

- Stripe y PayPal no están disponibles de forma estándar para comercios venezolanos.
- Pasarelas locales (p. ej. Megasoft, Credicard/Credicard) requieren contrato y su propio API.
- **Cashea** (BNPL muy usado en Venezuela) no tiene integración oficial en Medusa: requeriría
  un módulo propio y acuerdo comercial.
- Cripto: BTCPay Server o CoinGate se integran razonablemente bien vía payment provider custom.
- Cumplimiento: al cobrar en divisas aplican reglas cambiarias y de prevención de legitimación
  de capitales. Valida el esquema con un abogado/contador antes de producción.

### 7.4 Envíos y entregas

El seed trae una bodega "European Warehouse" y una zona "Europe" con `manual_manual`
(fulfillment provider manual). Para Venezuela:

- Bodega: `Caracas`, `address_1`, `province: "Distrito Capital"`, `country_code: "ve"`.
- Zonas: Medusa soporta *geo zones* por `country`, `province`, `city` y `zip`. Crea una
  `service_zone` por estado (Amazonas, Anzoátegui, Apure, Aragua, Barinas, Bolívar, Carabobo,
  Cojedes, Delta Amacuro, Falcón, Guárico, Lara, Mérida, Miranda, Monagas, Nueva Esparta,
  Portuguesa, Sucre, Táchira, Trujillo, Vargas, Yaracuy, Zulia, Distrito Capital y
  Dependencias Federales) para poder tarifar distinto.
- Courier: Zoom, MRW, Liberty Express, Tealca y delivery urbano (Yummy, Ridery). La integración
  automática con sus APIs requiere un **fulfillment provider** custom; para arrancar, el
  proveedor manual con tarifas planas por zona es suficiente.
- Define si el precio de envío es fijo por zona, gratis sobre un monto, o calculado por peso.

### 7.5 Direcciones, teléfono y datos fiscales

Medusa maneja `first_name`, `last_name`, `company`, `address_1`, `address_2`, `city`,
`province`, `postal_code`, `country_code`, `phone`. Mapeo sugerido para Venezuela:

| Campo Medusa | Uso en Venezuela |
| --- | --- |
| `province` | Estado |
| `city` | Municipio / parroquia |
| `address_1` | Calle / avenida y número |
| `address_2` | Punto de referencia (muy usado en entregas) |
| `company` | Razón social |
| `postal_code` | Código postal (opcional; no lo hagas obligatorio) |

Ajustes necesarios en el storefront:

- Validación de teléfono con formato `+58` (E.164). Revisa `apps/storefront/src/lib/**` y los
  componentes de checkout.
- **No exigir `postal_code`**: en Venezuela no se usa de forma consistente y el checkout del
  starter puede bloquear la compra.
- Agregar **cédula/RIF** como campo extra (metadata del cliente o del pedido). Medusa permite
  `metadata` en customer/order/address; es la vía menos invasiva.
- Mostrar el estado como lista cerrada (los 24 estados + Distrito Capital).

### 7.6 Facturación y cumplimiento (SENIAT)

Medusa genera órdenes y facturas internas, **no** comprobantes fiscales venezolanos. Para
facturar legalmente necesitas:

- RIF de la empresa y numeración de facturas según normativa.
- IVA discriminado y libro de ventas.
- Proveedor de facturación digital autorizado (hay varios en el mercado; verifica con tu
  contador cuál está habilitado y si aplica a tu tipo de contribuyente).
- Retenciones de IVA/ISLR si vendes a contribuyentes especiales.

Camino práctico: mantener Medusa como fuente de la orden y enviar los datos a tu sistema
fiscal (integración en un `subscriber` de `order.placed` o en un job), en lugar de intentar
que Medusa emita el documento fiscal.

### 7.7 Catálogo y contenido

- Traduce el admin: `apps/backend/src/admin/i18n/` (el starter trae la estructura).
- Traduce el storefront (textos en `apps/storefront/src/**`, formato de moneda `es-VE`).
- Categorías reales del negocio en lugar de `Shirts/Sweatshirts/Pants/Merch`.
- Imágenes: en desarrollo, file provider local; en producción, S3/MinIO/Cloudinary.
- Moneda formateada con `Intl.NumberFormat("es-VE", { currency: "VES" })`.

### 7.8 Búsqueda

El starter trae `src/search/product.ts`. Para catálogos grandes, evalúa Meilisearch,
Algolia o el módulo `@medusajs/index`. Para empezar, la búsqueda por defecto es suficiente.

---

## 8. Roadmap sugerido por fases

**Fase 1 - Tienda funcionando (1-2 días)**
- [x] Backend + admin + storefront corriendo
- [ ] Región Venezuela, moneda y precios
- [ ] IVA 16%
- [ ] Payment provider `system` con Pago Móvil / transferencia / Zelle
- [ ] Envío manual por zona (Caracas + interior)
- [ ] Catálogo real cargado

**Fase 2 - Operación (1-2 semanas)**
- [ ] Job diario de tasa BCV y price lists
- [ ] Emails transaccionales (Resend/SendGrid) en español
- [ ] Campos cédula/RIF y validación de teléfono
- [ ] Políticas de devolución, envío y privacidad
- [ ] Analítica y píxeles

**Fase 3 - Producción**
- [ ] Postgres administrado + Redis
- [ ] File storage S3
- [ ] Deploy (Railway/Render/VPS o Medusa Cloud) con dominio y TLS
- [ ] Integración fiscal en `order.placed`
- [ ] Backups y monitoreo

---

## 9. Problemas típicos en Windows

| Síntoma | Causa | Solución |
| --- | --- | --- |
| `yarn`/`pnpm` no se reconoce | cambiaste de Node y el shim se perdió | `corepack enable pnpm` |
| `EPERM` o archivos bloqueados | proyecto dentro de OneDrive/antivirus | mantener el repo en `C:\dev`, excluir de OneDrive |
| `path too long` | rutas anidadas | `git config --system core.longpaths true` |
| `ECONNREFUSED 5432` | contenedor apagado | `docker start medusa-postgres` |
| `EADDRINUSE :9000` | proceso anterior vivo | `Get-NetTCPConnection -LocalPort 9000` y matar el PID |
| Admin en blanco tras build | assets cacheados | borrar `.medusa` y `apps/backend/.medusa/client` |
| pnpm instala lento | Windows Defender escaneando `node_modules` | excluir `C:\dev` de Defender |
| Docker no arranca | WSL2 no inicializado | abrir Docker Desktop, `wsl --update` |

---

## 10. Checklist de "está listo"

```powershell
# 1. Base de datos
docker ps --filter name=medusa-postgres

# 2. Backend responde
Invoke-RestMethod http://localhost:9000/health

# 3. Admin abre
Start-Process http://localhost:9000/app

# 4. Storefront abre
Start-Process http://localhost:8000

# 5. Región correcta
Invoke-RestMethod "http://localhost:9000/store/regions" -Headers @{ "x-publishable-api-key" = "<pk_...>" }
```

Si los cinco pasan, tienes una tienda Medusa operativa lista para adaptar.

---

## 11. Referencias

- Instalación: <https://docs.medusajs.com/learn/installation.md>
- Regiones y monedas: <https://docs.medusajs.com/resources/commerce-modules/region.md>
- Impuestos: <https://docs.medusajs.com/resources/commerce-modules/tax.md>
- Payment providers: <https://docs.medusajs.com/resources/commerce-modules/payment/payment-provider.md>
- Crear un payment provider: <https://docs.medusajs.com/resources/references/payment/provider>
- Fulfillment: <https://docs.medusajs.com/resources/commerce-modules/fulfillment.md>
- Workflows: <https://docs.medusajs.com/learn/fundamentals/workflows.md>
- Módulos: <https://docs.medusajs.com/learn/fundamentals/modules.md>
- Storefront starter: <https://docs.medusajs.com/resources/nextjs-starter.md>
- Índice completo para LLMs: <https://docs.medusajs.com/llms.txt>

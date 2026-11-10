# Demo funcional: del admin al ecommerce

Este documento describe el producto demo que se puede crear con el script
`apps/backend/src/scripts/seed-demo-product.ts` y el flujo completo que ya está
operativo en Medusa: catálogo, precio, inventario, carrito, envío, pago manual y
orden visible en el admin.

## Qué incluye el demo

| Pieza | Valor |
| --- | --- |
| Producto | `Producto Demo Norkut` (`producto-demo-norkut`) |
| Variante / SKU | `Unidad` / `DEMO-NORKUT-001` |
| Precio | USD 25.00 |
| Inventario | 50 unidades en `Almacen Caracas` |
| Colección | `Destacados` |
| Estado | `published` |

El script es idempotente: si el producto ya existe, no lo duplica y solo asegura
el nivel de inventario.

## Crear el producto

```powershell
cd apps/backend
pnpm exec medusa exec ./src/scripts/seed-demo-product.ts
```

## Dónde verlo

| Lugar | URL |
| --- | --- |
| Admin > Productos | <http://localhost:9000/app/products> |
| Admin > Inventario | <http://localhost:9000/app/inventory> |
| Admin > Órdenes | <http://localhost:9000/app/orders> |
| Producto en el storefront | <http://localhost:8000/ve/products/producto-demo-norkut> |
| Colección Destacados | <http://localhost:8000/ve/collections/destacados> |
| Home del storefront | <http://localhost:8000/ve> |

El home es `force-static` con `revalidate = 60`, así que un producto nuevo puede
tardar hasta 60 segundos en aparecer ahí. Las páginas de producto y colección se
actualizan de inmediato.

## Flujo de compra que ya funciona

1. **Admin / catálogo**: el producto se publica en el canal de ventas por
   defecto, con precio en USD y perfil de envío.
2. **Inventario**: la variante administra inventario. Al comprar se reserva una
   unidad; el stock disponible pasa de 50 a 49.
3. **Carrito**: el storefront crea el carrito con la región `Venezuela` y agrega
   la variante.
4. **Envío**: se ofrecen `Standard Shipping` y `Express Shipping` (USD 10).
5. **Pago**: el proveedor `pp_system_default` crea una sesión de pago manual
   (`pending`). En desarrollo el storefront muestra el botón de pago de prueba.
6. **Orden**: al completar el carrito se crea una orden en estado `pending`, con
   pago `authorized` y fulfillment `not_fulfilled`.
7. **Admin**: la orden aparece en **Orders**, con sus líneas, envío, dirección y
   total.

## Cómo probarlo desde la interfaz

1. Entra al admin en <http://localhost:9000/app>.
2. Ve a **Products** y abre `Producto Demo Norkut`.
3. Abre el storefront en <http://localhost:8000/ve/products/producto-demo-norkut>.
4. Agrega el producto al carrito y ve a **Checkout**.
5. Completa dirección, envío y elige **Manual Payment**.
6. Pulsa **Place order**.
7. Vuelve al admin > **Orders** y verifica la orden nueva.

## Dónde va la lógica de negocio propia

El flujo anterior usa los workflows de `@medusajs/medusa/core-flows`. Para
agregar reglas del negocio sin romper inventario, links ni eventos:

| Necesidad | Dónde |
| --- | --- |
| Impuestos, precios, promociones | Workflows/steps en `apps/backend/src/workflows/` |
| Reglas al crear una orden (SENIAT, ERP, notificaciones) | Subscriber de `order.placed` en `apps/backend/src/subscribers/` |
| Sincronizar catálogo/stock desde otra base SQL | Job en `apps/backend/src/jobs/` + módulo custom en `apps/backend/src/modules/` |
| Métodos de pago locales | Payment provider custom + configuración en `medusa-config.ts` |
| Envíos por estado | Fulfillment sets/zones y shipping options por región |
| Pantallas o widgets del admin | `apps/backend/src/admin/` |

Regla práctica: mutar datos de comercio (productos, precios, inventario,
órdenes) siempre a través de workflows de `core-flows`; las rutas HTTP y los
subscribers solo orquestan.

/**
 * Demo end-to-end: crea un producto publicado, con precio en USD, coleccion
 * "Destacados" e inventario en el almacen de Caracas.
 *
 *   pnpm exec medusa exec ./src/scripts/seed-demo-product.ts
 *
 * Es idempotente: si el producto ya existe, no lo duplica y solo asegura el
 * nivel de inventario. Nada del resto de la app depende de este script.
 */
import {
  createCollectionsWorkflow,
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  ContainerRegistrationKeys,
  MedusaError,
  ProductStatus,
} from "@medusajs/framework/utils"
import type { ExecArgs } from "@medusajs/framework/types"

const HANDLE = "producto-demo-norkut"
const SKU = "DEMO-NORKUT-001"
const STOCKED_QUANTITY = 50

export default async function seedDemoProduct({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title"],
    filters: { handle: HANDLE },
  })

  let product = existingProducts[0]

  if (!product) {
    const { data: salesChannels } = await query.graph({
      entity: "sales_channel",
      fields: ["id", "name"],
    })
    const { data: stockLocations } = await query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
    })
    const { data: shippingProfiles } = await query.graph({
      entity: "shipping_profile",
      fields: ["id"],
    })
    let { data: collections } = await query.graph({
      entity: "product_collection",
      fields: ["id", "handle", "title"],
      filters: { handle: "destacados" },
    })

    const salesChannel = salesChannels[0]
    const stockLocation = stockLocations[0]
    const shippingProfile = shippingProfiles[0]

    if (!salesChannel || !stockLocation || !shippingProfile) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Faltan datos base (sales channel, stock location o shipping profile). Ejecuta medusa db:migrate primero."
      )
    }

    if (!collections.length) {
      const { result } = await createCollectionsWorkflow(container).run({
        input: { collections: [{ title: "Destacados", handle: "destacados" }] },
      })
      collections = result
    }

    const collection = collections[0]

    const { result } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "Producto Demo Norkut",
            subtitle: "Demo end-to-end",
            description:
              "Producto de demostración creado para validar el flujo completo: admin, catálogo, carrito, checkout y orden.",
            handle: HANDLE,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: shippingProfile.id,
            collection_id: collection.id,
            sales_channels: [{ id: salesChannel.id }],
            images: [
              {
                url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png",
              },
            ],
            thumbnail:
              "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png",
            options: [{ title: "Presentación", values: ["Unidad"] }],
            variants: [
              {
                title: "Unidad",
                sku: SKU,
                manage_inventory: true,
                allow_backorder: false,
                options: { Presentación: "Unidad" },
                prices: [{ currency_code: "usd", amount: 25 }],
              },
            ],
            metadata: { demo: true, source: "seed-demo-product" },
          },
        ],
      },
    })

    product = result[0]
    logger.info(`Producto demo creado: ${product.id} (${HANDLE})`)
  } else {
    logger.info(`Producto demo ya existe: ${product.id} (${HANDLE})`)
  }

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku", "location_levels.id", "location_levels.location_id"],
    filters: { sku: SKU },
  })
  const inventoryItem = inventoryItems[0]

  if (!inventoryItem) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No se encontró el inventory item para el SKU ${SKU}`
    )
  }

  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const stockLocation = stockLocations[0]

  if (!stockLocation) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No hay stock location configurado"
    )
  }

  const alreadyStocked = (inventoryItem.location_levels ?? []).some(
    (level: { location_id: string }) => level.location_id === stockLocation.id
  )

  if (!alreadyStocked) {
    await createInventoryLevelsWorkflow(container).run({
      input: {
        inventory_levels: [
          {
            inventory_item_id: inventoryItem.id,
            location_id: stockLocation.id,
            stocked_quantity: STOCKED_QUANTITY,
          },
        ],
      },
    })
    logger.info(
      `Inventario creado: ${STOCKED_QUANTITY} unidades en ${stockLocation.name}`
    )
  } else {
    logger.info(`Inventario ya existe en ${stockLocation.name}`)
  }

  logger.info(
    `Demo listo. Producto: /app/products/${product.id} | Storefront: /ve/products/${HANDLE}`
  )
}

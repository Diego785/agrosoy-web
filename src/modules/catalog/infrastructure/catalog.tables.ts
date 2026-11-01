import { boolean, numeric, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { campaigns } from "@/modules/campaigns/infrastructure/campaigns.table";
import { zones } from "@/modules/customers/infrastructure/customers.tables";
import { id, timestamps } from "@/shared/infrastructure/db/columns";

export const PRODUCT_NAME_KEY = "products_comparison_name_key";
export const PRESENTATION_KEY = "presentations_product_content_key";
export const PRESENTATION_CODE_KEY = "presentations_code_key";

export const products = pgTable(
  "products",
  {
    id: id(),
    name: text().notNull(),
    comparisonName: text().notNull(),
    line: text({ enum: ["agrochemicals", "fertilizers"] }).notNull(),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex(PRODUCT_NAME_KEY).on(table.comparisonName)],
);

export const presentations = pgTable(
  "presentations",
  {
    id: id(),
    productId: uuid()
      .notNull()
      .references(() => products.id),
    /** Agrosoil's number for this product in this container ("001"), D23. */
    code: text().notNull(),
    content: numeric({ precision: 12, scale: 3 }).notNull(),
    unit: text({ enum: ["l", "ml", "kg", "g", "u"] }).notNull(),
    saleUnit: text({ enum: ["container", "measure"] }).notNull(),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex(PRESENTATION_KEY).on(table.productId, table.content, table.unit),
    uniqueIndex(PRESENTATION_CODE_KEY).on(table.code),
  ],
);

/** US$ per sale unit. A null zone is the general price, used where a zone has none of its own. */
export const referencePrices = pgTable(
  "reference_prices",
  {
    id: id(),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id),
    zoneId: uuid().references(() => zones.id),
    presentationId: uuid()
      .notNull()
      .references(() => presentations.id),
    price: numeric({ precision: 14, scale: 2 }).notNull(),
    updatedBy: text().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("reference_prices_scope_key")
      .on(table.campaignId, table.zoneId, table.presentationId)
      .nullsNotDistinct(),
  ],
);

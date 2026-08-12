import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const inventoryTypeEnum = pgEnum("inventory_type", [
  "BELT_9MM",
  "BELT_15MM",
  "GEAR",
  "SPROCKET",
]);

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inventoryType: inventoryTypeEnum("inventory_type").notNull(),
    size: integer("size").notNull(),
    quantity: integer("quantity").notNull().default(0),
    barcode: varchar("barcode", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("inventory_items_type_size_unique").on(table.inventoryType, table.size),
    uniqueIndex("inventory_items_barcode_unique").on(table.barcode),
    index("inventory_items_type_index").on(table.inventoryType),
    check("inventory_items_size_positive", sql`${table.size} > 0`),
    check("inventory_items_quantity_nonnegative", sql`${table.quantity} >= 0`),
  ],
);

export const inventoryEvents = pgTable(
  "inventory_events",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 16 }).notNull(),
    delta: integer("delta").notNull(),
    beforeQuantity: integer("before_quantity").notNull(),
    afterQuantity: integer("after_quantity").notNull(),
    actor: varchar("actor", { length: 100 }).notNull().default("team"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("inventory_events_item_time_index").on(table.itemId, table.createdAt),
    check(
      "inventory_events_action_check",
      sql`${table.action} IN ('CHECKIN', 'CHECKOUT', 'SYNC')`,
    ),
check(
  "inventory_events_delta_check",
  sql`(
    (${table.action} IN ('CHECKIN', 'CHECKOUT') AND ${table.delta} IN (-1, 1))
    OR
    (${table.action} = 'SYNC' AND ${table.delta} <> 0)
  )`,
),
    check("inventory_events_before_nonnegative", sql`${table.beforeQuantity} >= 0`),
    check("inventory_events_after_nonnegative", sql`${table.afterQuantity} >= 0`),
  ],
);

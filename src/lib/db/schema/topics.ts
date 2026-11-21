import { pgTable, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { materials } from "./materials";

export const topics = pgTable(
  "topics",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("topics_material_id_idx").on(table.materialId),
  ]
);

export const topicsRelations = relations(topics, ({ one }) => ({
  material: one(materials, {
    fields: [topics.materialId],
    references: [materials.id],
  }),
}));

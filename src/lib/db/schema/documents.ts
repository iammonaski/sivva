import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { materials } from "./materials";

export const documents = pgTable("documents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  materialId: text("material_id")
    .notNull()
    .references(() => materials.id, { onDelete: "cascade" }),
  rawText: text("raw_text").notNull(),
  pageCount: integer("page_count").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const documentsRelations = relations(documents, ({ one, many }) => ({
  material: one(materials, {
    fields: [documents.materialId],
    references: [materials.id],
  }),
}));

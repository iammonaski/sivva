import { pgTable, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";
import { documents } from "./documents";
import { materials } from "./materials";

export const chunks = pgTable(
  "chunks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    pageNumber: integer("page_number"),
    sectionHeading: text("section_heading"),
    chunkIndex: integer("chunk_index").notNull(),
    tokenCount: integer("token_count"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("chunks_material_id_idx").on(table.materialId),
    index("chunks_document_id_idx").on(table.documentId),
    index("chunks_search_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.content})`
    ),
  ]
);

export const chunksRelations = relations(chunks, ({ one }) => ({
  document: one(documents, {
    fields: [chunks.documentId],
    references: [documents.id],
  }),
  material: one(materials, {
    fields: [chunks.materialId],
    references: [materials.id],
  }),
}));

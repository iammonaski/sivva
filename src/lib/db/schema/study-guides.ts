import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { materials } from "./materials";

export interface KeyConcept {
  term: string;
  definition: string;
}

export const studyGuides = pgTable(
  "study_guides",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    overview: text("overview").notNull(),
    keyConcepts: jsonb("key_concepts")
      .$type<KeyConcept[]>()
      .notNull()
      .default([]),
    keyTerms: jsonb("key_terms")
      .$type<string[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("study_guides_material_id_idx").on(table.materialId),
  ]
);

export const studyGuidesRelations = relations(studyGuides, ({ one }) => ({
  material: one(materials, {
    fields: [studyGuides.materialId],
    references: [materials.id],
  }),
}));

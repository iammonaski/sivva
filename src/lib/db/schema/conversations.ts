import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { materials } from "./materials";
import { user } from "./auth";

export interface Citation {
  sourceId?: string;
  pageNumber?: number;
  sectionHeading?: string;
  chunkId?: string;
  text?: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  grounding?: "source-grounded" | "unsupported";
  createdAt: string;
}

export const conversations = pgTable(
  "conversations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title"),
    messages: jsonb("messages")
      .$type<ConversationMessage[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("conversations_material_id_idx").on(table.materialId),
    index("conversations_user_id_idx").on(table.userId),
  ]
);

export const conversationsRelations = relations(conversations, ({ one }) => ({
  material: one(materials, {
    fields: [conversations.materialId],
    references: [materials.id],
  }),
  user: one(user, {
    fields: [conversations.userId],
    references: [user.id],
  }),
}));

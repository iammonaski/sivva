import { pgTable, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

export const materials = pgTable("materials", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // 'pdf' | 'docx'
  fileSize: integer("file_size").notNull(),
  storageId: text("storage_id").notNull(), // Cloudinary public_id
  storageUrl: text("storage_url"),
  status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'extracted' | 'analyzing' | 'ready' | 'error'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastStudyTab: text("last_study_tab"),
  lastTopicId: text("last_topic_id"),
  lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [index("materials_user_last_opened_idx").on(table.userId, table.lastOpenedAt.desc().nullsLast())]);

export const materialsRelations = relations(materials, ({ one, many }) => ({
  user: one(user, {
    fields: [materials.userId],
    references: [user.id],
  }),
}));

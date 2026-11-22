import { vi } from "vitest";

// Isolated test configuration; no real cloud credentials or production data.
export const testDatabaseName = `sivva_ingestion_test_${process.pid}`;
export const testAdminUrl = "postgresql://sivva:sivva_dev_password@localhost:5432/postgres";
vi.stubEnv("NODE_ENV", "test");
vi.stubEnv("DATABASE_URL", `postgresql://sivva:sivva_dev_password@localhost:5432/${testDatabaseName}`);
vi.stubEnv("BETTER_AUTH_SECRET", "isolated_test_auth_secret_32_chars");
vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
vi.stubEnv("GOOGLE_CLIENT_ID", "test_google_client_id");
vi.stubEnv("GOOGLE_CLIENT_SECRET", "test_google_client_secret");
vi.stubEnv("GEMINI_API_KEY", "test_gemini_key");
vi.stubEnv("CLOUDINARY_CLOUD_NAME", "test-cloud");
vi.stubEnv("CLOUDINARY_API_KEY", "test-key");
vi.stubEnv("CLOUDINARY_API_SECRET", "test-secret");

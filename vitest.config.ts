import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    setupFiles: ["./mocks/test-env.ts"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/*.integration.test.ts"],
  },
});

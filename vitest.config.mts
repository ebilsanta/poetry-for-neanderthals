import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true, // Enables global `describe`, `it`, `expect`, etc.
    environment: "node", // For server-side tests
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@server": path.resolve(__dirname, "./src/server"),
      "@lib": path.resolve(__dirname, "./src/lib"),
    },
  },
});

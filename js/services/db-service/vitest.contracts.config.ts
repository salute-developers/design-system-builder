import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/routes/route-manifest.test.ts"],
    environment: "node",
  },
});

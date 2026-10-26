import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  "@test": fileURLToPath(new URL("./test", import.meta.url)),
  "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    // Lets CI pass while a project has no tests yet; each layer adds its own.
    passWithNoTests: true,
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.int.test.ts"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["src/**/*.int.test.ts"],
          environment: "node",
          globalSetup: ["./test/integration-global-setup.ts"],
          setupFiles: ["./test/integration-setup.ts"],
          // Files share one database, so they run one after another.
          fileParallelism: false,
        },
      },
    ],
  },
});

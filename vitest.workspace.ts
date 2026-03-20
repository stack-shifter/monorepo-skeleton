import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "shared",
      root: "./shared",
      include: ["src/**/__tests__/**/*.test.ts"],
      environment: "node",
      globals: true,
    },
  },
  {
    test: {
      name: "api",
      root: "./api",
      include: ["src/**/__tests__/**/*.test.ts"],
      environment: "node",
      globals: true,
    },
  },
]);

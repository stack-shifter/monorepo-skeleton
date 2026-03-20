import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "shared",
      root: "./shared",
      include: ["test/**/*.test.ts"],
      environment: "node",
      globals: true,
    },
  },
  {
    test: {
      name: "api",
      root: "./api",
      include: ["test/**/*.test.ts"],
      environment: "node",
      globals: true,
    },
  },
]);

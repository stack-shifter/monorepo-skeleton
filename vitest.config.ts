import { defineConfig, defineProject } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: "shared",
          root: "./shared",
          include: ["test/**/*.test.ts"],
          environment: "node",
          globals: true,
        },
      }),
      defineProject({
        test: {
          name: "api",
          root: "./api",
          include: ["test/**/*.test.ts"],
          environment: "node",
          globals: true,
        },
      }),
    ],
  },
});

import { defineConfig, defineProject } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: "lib",
          root: "./lib",
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

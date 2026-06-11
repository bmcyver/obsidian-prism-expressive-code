import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/hast.ts"),
      name: "hast",
      formats: ["es"],
      fileName: () => "hast.js",
    },
    rollupOptions: {
      external: [
        "@ctrl/tinycolor",
        "hast-util-select",
        "hast-util-to-html",
        "hast-util-to-text",
        "hastscript",
        "stylis",
        "unist-util-visit",
        "unist-util-visit-parents",
        "culori",
        "djb2a",
        "shiki",
        "strip-json-comments",
        "node:path",
        "node:fs",
        "node:url",
        "node:module",
      ],
    },
    sourcemap: true,
    minify: false,
    emptyOutDir: false,
  },
});

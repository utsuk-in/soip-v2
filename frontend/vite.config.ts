import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  publicDir: "../public",
  preview: {
    allowedHosts: ["soip-v2-ui-new.onrender.com"],
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});

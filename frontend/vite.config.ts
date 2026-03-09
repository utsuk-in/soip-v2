import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  publicDir: "../public",
  preview: {
    allowedHosts: [
      "soip-v2-ui-new.onrender.com",
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
    ],
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});

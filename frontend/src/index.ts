import homepage from "./index.html";

const port = Number(process.env.PORT) || 3000;
const isDev = process.env.NODE_ENV !== "production";

Bun.serve({
  port,
  hostname: "0.0.0.0",
  routes: {
    "/*": homepage,
  },
  development: isDev
    ? {
        hmr: true,
        console: true,
      }
    : undefined,
});

console.log(`Steppd frontend running on port ${port}`);
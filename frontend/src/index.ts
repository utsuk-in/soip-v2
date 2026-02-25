import homepage from "./index.html";

Bun.serve({
  port: 3000,
  routes: {
    "/*": homepage,
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log("SOIP frontend running on http://localhost:3000");

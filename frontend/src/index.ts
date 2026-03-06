import homepage from "./index.html";

const port = Number(process.env.PORT) || 3000;

Bun.serve({
  port: port,
  routes: {
    "/*": homepage,
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`SOIP frontend running on port ${port}`);

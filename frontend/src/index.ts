import homepage from "./index.html";

const port = Number(process.env.PORT) || 3000;
const API_BASE = process.env.VITE_API_BASE || "http://localhost:8000";

Bun.serve({
  port,
  hostname: "0.0.0.0",
  routes: {
    "/*": new Response(
      homepage.replace(
        "</head>",
        `<script>window.VITE_API_BASE="${API_BASE}"</script></head>`
      ),
      {
        headers: { "Content-Type": "text/html" },
      }
    ),
  },
});

console.log(`SOIP frontend running on port ${port}`);
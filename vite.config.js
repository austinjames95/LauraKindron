import { defineConfig } from "vite";

export default defineConfig({
  server: {
    /* Two servers are running while you develop:
         - Vite  on :5173  → serves your HTML, CSS, JS
         - node server.js  on :3000  → serves your data

       Without this proxy the browser would treat :3000 as a different site
       and block the request (CORS). The proxy makes Vite quietly forward
       anything starting with /api over to :3000, so from the browser's point
       of view there is only ever one origin — and your frontend can fetch the
       plain relative path "/api/articles" instead of a hardcoded localhost URL.
       That's why this code won't need to change when you deploy. */
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});

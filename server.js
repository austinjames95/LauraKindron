/* =====================================================================
   THE BACKEND
   ---------------------------------------------------------------------
   This is a separate program from your website. Vite serves the HTML/CSS/JS
   to the browser; this serves *data* over HTTP. They talk to each other only
   through the URLs defined below — that boundary is the whole lesson.

   Run it with:  npm run server        (http://localhost:3000)

   Every route follows the same shape:
     1. read the request  (what did the browser send?)
     2. do something      (read or change articles.json)
     3. send a response   (a status code + JSON)
   ===================================================================== */

import express from "express";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "data", "articles.json");
const PORT = 3000;

const app = express();

// Teaches Express to parse a JSON request body into `req.body`.
// Without this, every POST would arrive as `undefined`.
app.use(express.json());

/* ---------------------------------------------------------------------
   STORAGE
   A JSON file standing in for a database. Same idea as a real one: read
   the current state, change it, write it back. Swapping this for Postgres
   or Supabase later means rewriting only these two functions — the routes
   below and the entire frontend stay exactly as they are.
   ------------------------------------------------------------------- */

async function readArticles() {
  try {
    return JSON.parse(await readFile(DATA_FILE, "utf8"));
  } catch (err) {
    // First run: the file may not exist yet. An empty list is the right answer.
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeArticles(articles) {
  await writeFile(DATA_FILE, JSON.stringify(articles, null, 2), "utf8");
}

/* ---------------------------------------------------------------------
   VALIDATION
   Never trust the browser. A user can bypass your form entirely and POST
   whatever they want straight at this URL, so the server checks again.
   ------------------------------------------------------------------- */

function validate(body) {
  const errors = [];
  const title = (body?.title ?? "").trim();
  const text = (body?.text ?? "").trim();
  const link = (body?.link ?? "").trim();

  if (!title) errors.push("Title is required.");
  if (!text) errors.push("Your write-up is required.");
  if (!link) {
    errors.push("A link to the article is required.");
  } else {
    try {
      const url = new URL(link);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors.push("The link must start with http:// or https://");
      }
    } catch {
      errors.push("That link isn't a valid URL.");
    }
  }

  return { errors, clean: { title, text, link } };
}

/* ---------------------------------------------------------------------
   ROUTES — the four things the dashboard can ask for
   ------------------------------------------------------------------- */

// READ — hand back every article. Used by both the dashboard and (later)
// the public research page.
app.get("/api/articles", async (req, res) => {
  const articles = await readArticles();
  // Newest first, so the dashboard and research page agree on order.
  articles.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(articles);
});

// CREATE — the dashboard form posts here.
app.post("/api/articles", async (req, res) => {
  const { errors, clean } = validate(req.body);
  // 400 = "you sent me something wrong". The frontend reads this status
  // to decide whether to show errors or celebrate.
  if (errors.length) return res.status(400).json({ errors });

  const articles = await readArticles();
  const article = {
    id: crypto.randomUUID(),
    ...clean,
    createdAt: new Date().toISOString(),
  };
  articles.push(article);
  await writeArticles(articles);

  // 201 = "created". Send the finished object back, because the server
  // added fields (id, createdAt) the browser had no way to know.
  res.status(201).json(article);
});

// UPDATE — replace one article's fields.
app.put("/api/articles/:id", async (req, res) => {
  const { errors, clean } = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const articles = await readArticles();
  const index = articles.findIndex((a) => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ errors: ["No article with that id."] });

  articles[index] = { ...articles[index], ...clean };
  await writeArticles(articles);
  res.json(articles[index]);
});

// DELETE — remove one article.
app.delete("/api/articles/:id", async (req, res) => {
  const articles = await readArticles();
  const remaining = articles.filter((a) => a.id !== req.params.id);
  if (remaining.length === articles.length) {
    return res.status(404).json({ errors: ["No article with that id."] });
  }

  await writeArticles(remaining);
  // 204 = "done, and there's nothing to send back."
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}/api/articles`);
});

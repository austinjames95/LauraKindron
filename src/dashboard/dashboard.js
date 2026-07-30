/* =====================================================================
   THE FRONTEND
   ---------------------------------------------------------------------
   This file never touches articles.json. It can't — it runs inside the
   browser, on someone else's computer. The only thing it can do is send
   HTTP requests to the server and react to what comes back.

   The whole client/server link comes down to one browser function: fetch().
   Everything below is either (a) calling fetch, or (b) turning the result
   into DOM.
   ===================================================================== */

/* ---------------------------------------------------------------------
   1. GRAB THE ELEMENTS WE'LL TOUCH
   Done once up front so we're not re-querying the DOM on every keystroke.
   ------------------------------------------------------------------- */
const form = document.getElementById("article-form");
const idField = document.getElementById("article-id");
const titleField = document.getElementById("title");
const linkField = document.getElementById("link");
const textField = document.getElementById("text");
const errorBox = document.getElementById("form-errors");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const formTitle = document.getElementById("form-title");
const listEl = document.getElementById("article-list");
const countEl = document.getElementById("count");
const logEl = document.getElementById("request-log");

/* ---------------------------------------------------------------------
   2. THE ONE FUNCTION THAT TALKS TO THE BACKEND

   Every request in this app goes through here. Wrapping fetch like this is
   a habit worth forming — the moment you need auth headers, a base URL, or
   error handling, there's exactly one place to add it.

   Note the URL is a plain "/api/articles" — no http://localhost:3000. The
   Vite proxy (see vite.config.js) forwards it. That's why this code works
   unchanged in production.
   ------------------------------------------------------------------- */
async function api(method, path, body) {
  const response = await fetch(path, {
    method,
    // Tells the server "the body I'm sending is JSON". Without this header
    // express.json() ignores the body and req.body comes out empty.
    headers: body ? { "Content-Type": "application/json" } : {},
    // A request body must be a string. Objects have to be serialized.
    body: body ? JSON.stringify(body) : undefined,
  });

  logRequest(method, path, response.status);

  // IMPORTANT: fetch only rejects if the network itself failed. A 404 or a
  // 500 is a *successful* round-trip as far as fetch is concerned, so you
  // have to check response.ok yourself. This trips up almost everyone once.
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data.errors || ["Something went wrong."]).join(" "));
  }

  // 204 No Content (our DELETE) has an empty body — calling .json() on it
  // would throw, so bail out early.
  if (response.status === 204) return null;

  // Reading the body is itself async: the response headers can arrive
  // before the body has finished downloading.
  return response.json();
}

/* ---------------------------------------------------------------------
   3. READ — ask the server for everything, then draw it

   This is the pattern to internalize: the server is the single source of
   truth, and the page is just a picture of it. After any change we re-ask
   rather than trying to keep a local copy in sync.
   ------------------------------------------------------------------- */
async function loadArticles() {
  try {
    const articles = await api("GET", "/api/articles");
    render(articles);
  } catch (err) {
    listEl.innerHTML = `<p class="state-msg error">Couldn't reach the server. Is <code>npm run server</code> running?</p>`;
    console.error(err);
  }
}

/* ---------------------------------------------------------------------
   4. RENDER — data in, DOM out

   render() is deliberately "dumb": hand it an array and it rebuilds the
   list from scratch. No clever patching. At this scale that's both faster
   to write and impossible to get out of sync.
   ------------------------------------------------------------------- */
function render(articles) {
  countEl.textContent = articles.length ? `(${articles.length})` : "";

  if (!articles.length) {
    listEl.innerHTML = `<p class="state-msg">Nothing published yet. Your first article will show up here.</p>`;
    return;
  }

  listEl.innerHTML = articles
    .map(
      (article) => `
      <article class="dash-item">
        <div class="dash-item-main">
          <div class="meta">${formatDate(article.createdAt)}</div>
          <h3>${escapeHtml(article.title)}</h3>
          <p class="dash-text">${escapeHtml(article.text)}</p>
          <a class="dash-link" href="${escapeHtml(article.link)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(shortenUrl(article.link))} &nearr;
          </a>
        </div>
        <div class="dash-item-actions">
          <button class="link-btn" data-action="edit" data-id="${article.id}">Edit</button>
          <button class="link-btn danger" data-action="delete" data-id="${article.id}">Delete</button>
        </div>
      </article>`
    )
    .join("");
}

/* ---------------------------------------------------------------------
   5. CREATE / UPDATE — the form

   One form does both jobs. If the hidden id field is empty we're creating
   (POST to the collection); if it has an id we're editing (PUT to that one
   item). Same idea, different verb and URL.
   ------------------------------------------------------------------- */
form.addEventListener("submit", async (event) => {
  // Without this the browser does its default thing: a full page reload.
  // Nearly every "my JS runs and then the page flashes" bug is a missing
  // preventDefault.
  event.preventDefault();

  const id = idField.value;
  const payload = {
    title: titleField.value,
    link: linkField.value,
    text: textField.value,
  };

  setBusy(true);
  hideErrors();

  try {
    if (id) {
      await api("PUT", `/api/articles/${id}`, payload);
    } else {
      await api("POST", "/api/articles", payload);
    }
    resetForm();
    // Re-read from the server rather than assuming our write landed the way
    // we expect. If the two ever disagree, the server wins.
    await loadArticles();
  } catch (err) {
    showErrors(err.message);
  } finally {
    // finally runs whether or not it threw, so the button can never get
    // stuck in its disabled state.
    setBusy(false);
  }
});

/* ---------------------------------------------------------------------
   6. EDIT / DELETE — one listener for the whole list

   The buttons don't exist when this runs; render() creates them later. So
   instead of binding to each button, we listen on the container and check
   what was clicked. This is "event delegation" — it keeps working no matter
   how many times the list is redrawn.
   ------------------------------------------------------------------- */
listEl.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "delete") {
    if (!confirm("Delete this article? This can't be undone.")) return;
    try {
      await api("DELETE", `/api/articles/${id}`);
      // If we were mid-edit on the row we just deleted, clear the form.
      if (idField.value === id) resetForm();
      await loadArticles();
    } catch (err) {
      alert(err.message);
    }
  }

  if (action === "edit") {
    // We already have the text on screen, but re-reading from the server
    // guarantees we're editing what's actually stored.
    const articles = await api("GET", "/api/articles");
    const article = articles.find((a) => a.id === id);
    if (!article) return loadArticles();

    idField.value = article.id;
    titleField.value = article.title;
    linkField.value = article.link;
    textField.value = article.text;

    formTitle.textContent = "Edit article";
    submitBtn.textContent = "Save changes";
    cancelBtn.hidden = false;
    hideErrors();
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }
});

cancelBtn.addEventListener("click", resetForm);

/* ---------------------------------------------------------------------
   7. SMALL HELPERS
   ------------------------------------------------------------------- */

function resetForm() {
  form.reset();
  idField.value = "";
  formTitle.textContent = "New article";
  submitBtn.textContent = "Publish";
  cancelBtn.hidden = true;
  hideErrors();
}

function setBusy(busy) {
  submitBtn.disabled = busy;
  submitBtn.textContent = busy ? "Saving…" : idField.value ? "Save changes" : "Publish";
}

function showErrors(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function hideErrors() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

/* The server sends back plain text that a person typed. Dropping it straight
   into innerHTML would let a <script> tag in a title actually run — that's an
   XSS hole. Escaping the five HTML-significant characters closes it. */
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function shortenUrl(link) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

/* Purely a teaching aid — mirrors what the browser's Network tab shows. */
function logRequest(method, path, status) {
  const ok = status >= 200 && status < 300;
  const item = document.createElement("li");
  item.className = ok ? "log-ok" : "log-bad";
  item.innerHTML = `<span class="log-method">${method}</span>
    <span class="log-path">${escapeHtml(path)}</span>
    <span class="log-status">${status}</span>`;

  logEl.querySelector(".log-empty")?.remove();
  logEl.prepend(item);
  while (logEl.children.length > 12) logEl.lastElementChild.remove();
}

/* ---------------------------------------------------------------------
   8. GO
   Nothing on the page has data until this runs.
   ------------------------------------------------------------------- */
loadArticles();

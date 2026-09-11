// Client Tracker — UI logic.
const $ = (id) => document.getElementById(id);

const authView = $("auth-view");
const appView = $("app-view");
const authForm = $("auth-form");
const authTitle = $("auth-title");
const authSubmit = $("auth-submit");
const authToggle = $("auth-toggle");
const authStatus = $("auth-status");
const nameField = $("auth-name");
const nameLabel = $("name-label");

const STATUS_LABELS = { lead: "Lead", active: "Active", past: "Past", lost: "Lost" };

let authMode = "login";
let editingId = null;

function showAuth() {
  authView.hidden = false;
  appView.hidden = true;
}

function showApp() {
  authView.hidden = true;
  appView.hidden = false;
}

function setAuthStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.hidden = false;
  authStatus.style.color = isError ? "#dc2626" : "";
}

// --- Auth ---
authToggle.addEventListener("click", () => {
  authMode = authMode === "login" ? "register" : "login";
  authTitle.textContent = authMode === "login" ? "Sign In" : "Create Account";
  authSubmit.textContent = authMode === "login" ? "Sign In" : "Create Account";
  nameField.hidden = nameLabel.hidden = authMode !== "register";
  authStatus.hidden = true;
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  try {
    if (authMode === "register") {
      const name = nameField.value.trim();
      if (!name) return setAuthStatus("Please enter your name.", true);
      const { token } = await API.register(name, email, password);
      API.setToken(token);
    } else {
      const { token } = await API.login(email, password);
      API.setToken(token);
    }
    authForm.reset();
    enterApp();
  } catch (err) {
    setAuthStatus(err.message, true);
  }
});

$("logout-button").addEventListener("click", () => {
  API.setToken(null);
  showAuth();
});

function enterApp() {
  showApp();
  loadClients();
}

// --- Clients ---
let searchTimer = null;
$("search").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadClients, 250);
});
$("status-filter").addEventListener("change", loadClients);

async function loadClients() {
  const list = $("client-list");
  try {
    const clients = await API.listClients({
      search: $("search").value.trim(),
      status: $("status-filter").value,
    });
    renderClients(clients);
  } catch (err) {
    list.innerHTML = `<li class="empty">${escapeHtml(err.message)}</li>`;
  }
}

function renderClients(clients) {
  const list = $("client-list");
  if (clients.length === 0) {
    list.innerHTML = '<li class="empty">No clients found.</li>';
    return;
  }

  list.innerHTML = clients
    .map(
      (c) => `
      <li class="client-row">
        <div class="client-main">
          <strong>${escapeHtml(c.name)}</strong>
          ${c.company ? `<span class="muted"> · ${escapeHtml(c.company)}</span>` : ""}
          <span class="badge badge-${escapeHtml(c.status)}">${STATUS_LABELS[c.status] || escapeHtml(c.status)}</span>
          ${c.tags ? `<span class="tags">${escapeHtml(c.tags)}</span>` : ""}
          <div class="muted small">
            ${c.email ? escapeHtml(c.email) : ""}${c.email && c.phone ? " · " : ""}${c.phone ? escapeHtml(c.phone) : ""}
          </div>
          ${c.notes ? `<div class="notes">${escapeHtml(c.notes)}</div>` : ""}
        </div>
        <div class="client-actions">
          <button type="button" class="secondary small" data-edit="${c.id}">Edit</button>
          <button type="button" class="danger small" data-delete="${c.id}">Delete</button>
        </div>
      </li>`
    )
    .join("");

  list.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openEditor(Number(btn.dataset.edit)))
  );
  list.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => deleteClient(Number(btn.dataset.delete)))
  );
}

// --- Editor dialog ---
const dialog = $("client-dialog");
const clientForm = $("client-form");

$("new-client-button").addEventListener("click", () => openEditor(null));
$("client-cancel").addEventListener("click", () => dialog.close());

function openEditor(id) {
  editingId = id;
  $("client-form-title").textContent = id ? "Edit Client" : "New Client";
  clientForm.reset();
  if (id) {
    API.getClient(id)
      .then((c) => {
        $("client-name").value = c.name || "";
        $("client-company").value = c.company || "";
        $("client-email").value = c.email || "";
        $("client-phone").value = c.phone || "";
        $("client-status").value = c.status || "lead";
        $("client-tags").value = c.tags || "";
        $("client-notes").value = c.notes || "";
      })
      .catch((err) => alert(err.message));
  }
  dialog.showModal();
}

clientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    name: $("client-name").value.trim(),
    company: $("client-company").value.trim() || null,
    email: $("client-email").value.trim() || null,
    phone: $("client-phone").value.trim() || null,
    status: $("client-status").value,
    tags: $("client-tags").value.trim() || null,
    notes: $("client-notes").value.trim() || null,
  };
  try {
    if (editingId) await API.updateClient(editingId, payload);
    else await API.createClient(payload);
    dialog.close();
    loadClients();
  } catch (err) {
    alert(err.message);
  }
});

async function deleteClient(id) {
  if (!confirm("Delete this client?")) return;
  try {
    await API.deleteClient(id);
    loadClients();
  } catch (err) {
    alert(err.message);
  }
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

// --- Boot ---
if (API.token) enterApp();
else showAuth();
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
const STATUS_ORDER = ["lead", "active", "past", "lost"];

let authMode = "login";
let editingId = null;
let editingFieldId = null;
let customFields = [];
let currentView = "board";

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

$("logout-button").addEventListener("click", async () => {
  await API.logout();
  API.setToken(null);
  showAuth();
});

// --- View toggle ---
$("view-board").addEventListener("click", () => setView("board"));
$("view-list").addEventListener("click", () => setView("list"));

function setView(view) {
  currentView = view;
  $("view-board").classList.toggle("active", view === "board");
  $("view-list").classList.toggle("active", view === "list");
  $("board-view").hidden = view !== "board";
  $("list-view").hidden = view !== "list";
}

// --- Boot / data loading ---
function enterApp() {
  showApp();
  loadCustomFields().then(loadClients);
}

async function loadCustomFields() {
  try {
    customFields = await API.listCustomFields();
  } catch {
    customFields = [];
  }
}

let searchTimer = null;
$("search").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadClients, 250);
});

async function loadClients() {
  try {
    const clients = await API.listClients({ search: $("search").value.trim() });
    renderBoard(clients);
    renderList(clients);
  } catch (err) {
    $("client-list").innerHTML = `<li class="empty">${escapeHtml(err.message)}</li>`;
  }
}

// --- Kanban board ---
function renderBoard(clients) {
  const byStatus = { lead: [], active: [], past: [], lost: [] };
  for (const c of clients) {
    (byStatus[c.status] || byStatus.lead).push(c);
  }

  for (const status of STATUS_ORDER) {
    const col = document.querySelector(`.column-cards[data-drop="${status}"]`);
    const count = $(`count-${status}`);
    count.textContent = byStatus[status].length;
    col.innerHTML =
      byStatus[status].length === 0
        ? '<div class="column-empty">No clients</div>'
        : byStatus[status].map(cardHtml).join("");
  }

  attachDragAndDrop();
}

function cardHtml(c) {
  const meta = [c.company, c.email, c.phone].filter(Boolean).join(" · ");
  return `
    <div class="board-card" draggable="true" data-id="${c.id}" data-status="${escapeAttr(c.status)}">
      <div class="board-card-name">${escapeHtml(c.name)}</div>
      ${meta ? `<div class="board-card-meta">${escapeHtml(meta)}</div>` : ""}
      ${c.tags ? `<div class="board-card-tags">${escapeHtml(c.tags)}</div>` : ""}
    </div>`;
}

function attachDragAndDrop() {
  document.querySelectorAll(".board-card").forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", card.dataset.id);
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
    card.addEventListener("click", () => openEditor(Number(card.dataset.id)));
  });

  document.querySelectorAll(".column-cards").forEach((col) => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      col.classList.add("drag-over");
    });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      const id = Number(e.dataTransfer.getData("text/plain"));
      const status = col.dataset.drop;
      if (!id || !status) return;
      try {
        await API.updateClient(id, { status });
        loadClients();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

// --- List view ---
function renderList(clients) {
  const list = $("client-list");
  if (clients.length === 0) {
    list.innerHTML = '<li class="empty">No clients found.</li>';
    return;
  }

  list.innerHTML = clients
    .map(
      (c) => `
      <li class="client-row" data-edit="${c.id}">
        <div class="client-main">
          <strong>${escapeHtml(c.name)}</strong>
          ${c.company ? `<span class="muted"> · ${escapeHtml(c.company)}</span>` : ""}
          <span class="badge badge-${escapeHtml(c.status)}">${STATUS_LABELS[c.status] || escapeHtml(c.status)}</span>
          ${c.tags ? `<span class="tags">${escapeHtml(c.tags)}</span>` : ""}
          <div class="muted small">
            ${c.email ? escapeHtml(c.email) : ""}${c.email && c.phone ? " · " : ""}${c.phone ? escapeHtml(c.phone) : ""}
          </div>
        </div>
        <div class="client-actions">
          <button type="button" class="secondary small" data-edit-btn="${c.id}">Edit</button>
          <button type="button" class="danger small" data-delete="${c.id}">Delete</button>
        </div>
      </li>`
    )
    .join("");

  list.querySelectorAll("[data-edit]").forEach((row) =>
    row.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      openEditor(Number(row.dataset.edit));
    })
  );
  list.querySelectorAll("[data-edit-btn]").forEach((btn) =>
    btn.addEventListener("click", () => openEditor(Number(btn.dataset.editBtn)))
  );
  list.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => deleteClient(Number(btn.dataset.delete)))
  );
}

async function deleteClient(id) {
  if (!confirm("Delete this client?")) return;
  try {
    await API.deleteClient(id);
    loadClients();
  } catch (err) {
    alert(err.message);
  }
}

// --- Client editor dialog ---
const dialog = $("client-dialog");
const clientForm = $("client-form");

$("new-client-button").addEventListener("click", () => openEditor(null));
$("client-cancel").addEventListener("click", () => dialog.close());

function openEditor(id) {
  editingId = id;
  $("client-form-title").textContent = id ? "Edit Client" : "New Client";
  clientForm.reset();
  $("notes-section").hidden = !id;
  buildCustomFieldInputs({});

  if (id) {
    API.getClient(id)
      .then((c) => {
        $("client-name").value = c.name || "";
        $("client-company").value = c.company || "";
        $("client-email").value = c.email || "";
        $("client-phone").value = c.phone || "";
        $("client-status").value = c.status || "lead";
        $("client-tags").value = c.tags || "";
        buildCustomFieldInputs(c.customValues || {});
        loadNotes(id);
      })
      .catch((err) => alert(err.message));
  }
  dialog.showModal();
}

function buildCustomFieldInputs(values) {
  const container = $("custom-fields-container");
  if (customFields.length === 0) {
    container.innerHTML =
      '<p class="muted small">No custom fields defined. <a href="#" id="add-fields-link">Manage fields</a></p>';
    container.querySelector("#add-fields-link").addEventListener("click", (e) => {
      e.preventDefault();
      openFieldsDialog();
    });
    return;
  }

  container.innerHTML = customFields
    .map((f) => {
      const value = (values && values[String(f.id)]) || "";
      let input;
      if (f.type === "date") {
        input = `<input type="date" id="cf-${f.id}" value="${escapeAttr(value)}" />`;
      } else if (f.type === "number") {
        input = `<input type="number" id="cf-${f.id}" value="${escapeAttr(value)}" step="any" />`;
      } else {
        input = `<input type="text" id="cf-${f.id}" value="${escapeAttr(value)}" />`;
      }
      return `<label for="cf-${f.id}">${escapeHtml(f.name)}${f.required ? " *" : ""}</label>${input}`;
    })
    .join("");
}

clientForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const customValues = {};
  for (const f of customFields) {
    const el = $(`cf-${f.id}`);
    if (el && el.value !== "") customValues[String(f.id)] = el.value;
  }

  const payload = {
    name: $("client-name").value.trim(),
    company: $("client-company").value.trim() || null,
    email: $("client-email").value.trim() || null,
    phone: $("client-phone").value.trim() || null,
    status: $("client-status").value,
    tags: $("client-tags").value.trim() || null,
    customValues,
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

// --- Notes ---
$("note-add-button").addEventListener("click", () => addNote(editingId));
$("note-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addNote(editingId);
  }
});

async function loadNotes(clientId) {
  const list = $("note-list");
  try {
    const notes = await API.listNotes(clientId);
    if (notes.length === 0) {
      list.innerHTML = '<li class="muted small">No notes yet.</li>';
      return;
    }
    list.innerHTML = notes
      .map(
        (n) => `
        <li class="note">
          <div class="note-body">${escapeHtml(n.body)}</div>
          <div class="note-meta">
            ${formatTimestamp(n.created_at)}
            <button type="button" class="danger small" data-note-delete="${n.id}">Delete</button>
          </div>
        </li>`
      )
      .join("");
    list.querySelectorAll("[data-note-delete]").forEach((btn) =>
      btn.addEventListener("click", () => deleteNote(Number(btn.dataset.noteDelete)))
    );
  } catch (err) {
    list.innerHTML = `<li class="muted small">${escapeHtml(err.message)}</li>`;
  }
}

async function addNote(clientId) {
  const input = $("note-input");
  const body = input.value.trim();
  if (!body || !clientId) return;
  try {
    await API.addNote(clientId, body);
    input.value = "";
    loadNotes(clientId);
  } catch (err) {
    alert(err.message);
  }
}

async function deleteNote(noteId) {
  if (!confirm("Delete this note?")) return;
  try {
    await API.deleteNote(noteId);
    loadNotes(editingId);
  } catch (err) {
    alert(err.message);
  }
}

// --- Custom fields dialog ---
const fieldsDialog = $("fields-dialog");
const fieldForm = $("field-form");

$("fields-button").addEventListener("click", openFieldsDialog);
$("fields-done").addEventListener("click", () => fieldsDialog.close());

function openFieldsDialog() {
  editingFieldId = null;
  fieldForm.reset();
  $("field-save").textContent = "Add";
  renderFieldList();
  fieldsDialog.showModal();
}

function renderFieldList() {
  const list = $("field-list");
  if (customFields.length === 0) {
    list.innerHTML = '<li class="muted small">No custom fields yet.</li>';
    return;
  }
  list.innerHTML = customFields
    .map(
      (f) => `
      <li>
        <span><strong>${escapeHtml(f.name)}</strong> <span class="muted small">(${f.type}${f.required ? ", required" : ""})</span></span>
        <span class="field-actions">
          <button type="button" class="secondary small" data-field-edit="${f.id}">Edit</button>
          <button type="button" class="danger small" data-field-delete="${f.id}">Delete</button>
        </span>
      </li>`
    )
    .join("");
  list.querySelectorAll("[data-field-edit]").forEach((btn) =>
    btn.addEventListener("click", () => editField(Number(btn.dataset.fieldEdit)))
  );
  list.querySelectorAll("[data-field-delete]").forEach((btn) =>
    btn.addEventListener("click", () => deleteField(Number(btn.dataset.fieldDelete)))
  );
}

function editField(id) {
  const f = customFields.find((x) => x.id === id);
  if (!f) return;
  editingFieldId = id;
  $("field-name").value = f.name;
  $("field-type").value = f.type;
  $("field-required").checked = !!f.required;
  $("field-save").textContent = "Update";
}

fieldForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    name: $("field-name").value.trim(),
    type: $("field-type").value,
    required: $("field-required").checked,
  };
  try {
    if (editingFieldId) await API.updateCustomField(editingFieldId, payload);
    else await API.createCustomField(payload);
    fieldForm.reset();
    editingFieldId = null;
    $("field-save").textContent = "Add";
    await loadCustomFields();
    renderFieldList();
  } catch (err) {
    alert(err.message);
  }
});

async function deleteField(id) {
  if (!confirm("Delete this field? Its values will be removed from all clients.")) return;
  try {
    await API.deleteCustomField(id);
    await loadCustomFields();
    renderFieldList();
  } catch (err) {
    alert(err.message);
  }
}

// --- Helpers ---
function formatTimestamp(sqliteUtc) {
  const d = new Date(sqliteUtc.replace(" ", "T") + "Z");
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

// --- Boot ---
async function boot() {
  if (API.token) {
    try {
      await API.me();
      enterApp();
    } catch {
      API.setToken(null);
      showAuth();
    }
  } else {
    showAuth();
  }
}
boot();
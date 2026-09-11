// Client Tracker — starter app logic.
// Clients are stored in localStorage so they survive page reloads.

const STORAGE_KEY = "client-tracker.clients";

function loadClients() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveClients(clients) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

function renderClients() {
  const list = document.getElementById("client-list");
  const clients = loadClients();

  if (clients.length === 0) {
    list.innerHTML = '<li class="empty">No clients yet.</li>';
    return;
  }

  list.innerHTML = clients
    .map(
      (client) =>
        `<li><strong>${escapeHtml(client.name)}</strong> — ${escapeHtml(
          client.email || "no email"
        )} <span class="badge">${escapeHtml(client.status)}</span></li>`
    )
    .join("");
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

document.getElementById("client-form").addEventListener("submit", (event) => {
  event.preventDefault();

  const client = {
    name: document.getElementById("client-name").value.trim(),
    email: document.getElementById("client-email").value.trim(),
    status: document.getElementById("client-status").value,
    createdAt: new Date().toISOString(),
  };

  const clients = loadClients();
  clients.push(client);
  saveClients(clients);

  const status = document.getElementById("status");
  status.textContent = `Added ${client.name} as ${client.status}.`;
  status.hidden = false;

  event.target.reset();
  renderClients();
});

renderClients();
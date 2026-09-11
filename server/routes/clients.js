// Client CRUD API. This is the integration surface other tools will call.
const express = require("express");
const db = require("../db");

const router = express.Router();

const VALID_STATUSES = ["lead", "active", "past", "lost"];

function parseTags(tags) {
  if (Array.isArray(tags)) return tags.join(",");
  if (typeof tags === "string") return tags.trim() || null;
  return null;
}

// GET /api/clients?search=&status= — list (filtered, newest first)
router.get("/", (req, res) => {
  const { search = "", status } = req.query;
  const params = [req.user.id];
  let sql = "SELECT * FROM clients WHERE user_id = ?";

  if (status && VALID_STATUSES.includes(status)) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (search) {
    sql += " AND (name LIKE ? OR company LIKE ? OR email LIKE ? OR tags LIKE ?)";
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  sql += " ORDER BY updated_at DESC";

  res.json(db.prepare(sql).all(...params));
});

// GET /api/clients/:id — one client
router.get("/:id", (req, res) => {
  const client = db
    .prepare("SELECT * FROM clients WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);
  if (!client) return res.status(404).json({ error: "Client not found" });
  res.json(client);
});

// POST /api/clients — create
router.post("/", (req, res) => {
  const { name, company, email, phone, status = "lead", notes, tags } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
  }

  const result = db
    .prepare(
      `INSERT INTO clients (user_id, name, company, email, phone, status, notes, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      String(name).trim(),
      company || null,
      email || null,
      phone || null,
      status,
      notes || null,
      parseTags(tags)
    );

  const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(Number(result.lastInsertRowid));
  res.status(201).json(client);
});

// PUT /api/clients/:id — update (partial updates allowed)
router.put("/:id", (req, res) => {
  const existing = db
    .prepare("SELECT * FROM clients WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Client not found" });

  const { name, company, email, phone, status, notes, tags } = req.body || {};
  const next = {
    name: name !== undefined ? String(name).trim() : existing.name,
    company: company !== undefined ? company : existing.company,
    email: email !== undefined ? email : existing.email,
    phone: phone !== undefined ? phone : existing.phone,
    status: status !== undefined ? status : existing.status,
    notes: notes !== undefined ? notes : existing.notes,
    tags: tags !== undefined ? parseTags(tags) : existing.tags,
  };

  if (!next.name) return res.status(400).json({ error: "name cannot be empty" });
  if (!VALID_STATUSES.includes(next.status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
  }

  db.prepare(
    `UPDATE clients
     SET name = ?, company = ?, email = ?, phone = ?, status = ?, notes = ?, tags = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(next.name, next.company, next.email, next.phone, next.status, next.notes, next.tags, existing.id);

  res.json(db.prepare("SELECT * FROM clients WHERE id = ?").get(existing.id));
});

// DELETE /api/clients/:id
router.delete("/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM clients WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: "Client not found" });
  res.status(204).end();
});

module.exports = router;
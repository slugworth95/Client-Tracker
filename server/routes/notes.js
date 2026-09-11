// Timestamped notes attached to clients.
const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /api/clients/:clientId/notes — list notes (newest first)
router.get("/clients/:clientId/notes", async (req, res) => {
  const client = await db
    .prepare("SELECT id FROM clients WHERE id = ? AND user_id = ?")
    .get(req.params.clientId, req.user.id);
  if (!client) return res.status(404).json({ error: "Client not found" });

  const rows = await db
    .prepare("SELECT * FROM notes WHERE client_id = ? ORDER BY created_at DESC, id DESC")
    .all(client.id);
  res.json(rows);
});

// POST /api/clients/:clientId/notes — add a note
router.post("/clients/:clientId/notes", async (req, res) => {
  const client = await db
    .prepare("SELECT id FROM clients WHERE id = ? AND user_id = ?")
    .get(req.params.clientId, req.user.id);
  if (!client) return res.status(404).json({ error: "Client not found" });

  const { body } = req.body || {};
  if (!body || !String(body).trim()) {
    return res.status(400).json({ error: "body is required" });
  }

  const result = await db
    .prepare("INSERT INTO notes (client_id, user_id, body) VALUES (?, ?, ?)")
    .run(client.id, req.user.id, String(body).trim());
  const row = await db.prepare("SELECT * FROM notes WHERE id = ?").get(Number(result.lastInsertRowid));
  res.status(201).json(row);
});

// DELETE /api/notes/:id — delete a note
router.delete("/notes/:id", async (req, res) => {
  const result = await db
    .prepare("DELETE FROM notes WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: "Note not found" });
  res.status(204).end();
});

module.exports = router;